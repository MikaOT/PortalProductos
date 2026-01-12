import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import OpenAI from 'openai'; 

// 🔹 LIBRERÍAS GRAPHQL (NUEVO)
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';

import { config } from './config.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';

import { ChatMessage } from './models/ChatMessage.js';
import { User } from './models/User.js';

// __dirname en ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 CONFIGURACIÓN OPENAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// --- App + HTTP + Socket.IO ---
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: config.clientOrigin, credentials: true }
});

// --- Middlewares ---
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json()); // Necesario para que GraphQL lea el body
app.use(express.static(path.join(__dirname, 'public')));

// 🔹 INICIO DE APOLLO SERVER (GRAPHQL) - NUEVO
// Usamos una función autoejecutable o top-level await para iniciar Apollo
const apollo = new ApolloServer({ typeDefs, resolvers });
await apollo.start();

app.use('/graphql', expressMiddleware(apollo, {
  context: async ({ req }) => {
    // 1. Buscamos el token en el header
    const token = req.headers.authorization || '';
    // 2. Limpiamos el string "Bearer "
    const cleanToken = token.replace('Bearer ', '');
    
    // 3. Si no hay token, devolvemos usuario null
    if (!cleanToken) return { user: null };

    try {
      // 4. Verificamos token y devolvemos el usuario decodificado
      const user = jwt.verify(cleanToken, config.jwtSecret);
      return { user };
    } catch (err) {
      return { user: null };
    }
  },
}));
console.log('🔮 GraphQL endpoint listo en /graphql');


// --- Rutas API REST (Legacy) ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// 🔹 Variable global para guardar el ID del usuario Bot
let BOT_USER_ID = null;

// --- Conexión a MongoDB ---
async function connectDatabase() {
  if (config.mongoUri === 'disabled') {
    console.warn('⚠️ Modo demo: conexión MongoDB deshabilitada');
    return;
  }

  console.log('🔍 Intentando conectar a:', config.mongoUri);
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB conectado correctamente');

    // --- Seed Admin ---
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    const adminExists = await User.findOne({ email: adminEmail });
    if (!adminExists) {
      await User.create({
        username: 'Admin',
        email: adminEmail,
        password: adminPass,
        role: 'admin',
        balance: 999999
      });
      console.log(`🔑 Admin seed creado -> ${adminEmail}`);
    } else {
      console.log(`🔑 Admin seed OK (${adminEmail})`);
    }

    // --- 🔹 Seed BOT ---
    const botEmail = 'bot@system.ai';
    let botUser = await User.findOne({ email: botEmail });
    
    if (!botUser) {
      botUser = await User.create({
        username: '🤖 Asistente IA',
        email: botEmail,
        password: 'bot_secure_password_' + Date.now(),
        role: 'user', 
        isBanned: false
      });
      console.log('🤖 Usuario Bot creado exitosamente');
    }
    
    BOT_USER_ID = botUser._id; 

  } catch (err) {
    console.error('❌ Error al conectar con MongoDB:', err.message);
  }
}

await connectDatabase();

// --- Middleware de Socket.IO (Auth) ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.warn('❌ Conexión rechazada: sin token');
    return next(new Error('No token'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    socket.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn('⚠️ Token expirado para socket (id:', socket.id, ')');
      return next(new Error('jwt expired'));
    }
    console.error('❌ Error de autenticación en socket:', err.message);
    next(new Error('Auth error'));
  }
});

// --- Socket.IO handlers ---
io.on('connection', async (socket) => {
  console.log(`🟢 Usuario conectado: ${socket.user?.username} (${socket.user?.id})`);

  const me = await User.findById(socket.user.id);
  if (!me || me.isBanned) {
    console.warn(`⚠️ Usuario bloqueado o no encontrado (${socket.user?.id})`);
    socket.disconnect(true);
    return;
  }

  // Enviar info básica del usuario conectado
  socket.on('getUserInfo', () => {
    socket.emit('userInfo', {
      id: socket.user.id,
      username: socket.user.username,
      role: socket.user.role
    });
  });

  // Rooms global + personal
  socket.join('global');
  socket.join(`user:${socket.user.id}`);

  // Historial global (50 últimos)
  const history = await ChatMessage.find({ room: 'global' })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  socket.emit('history', history.reverse());

  // --- 🔹 Mensaje global ---
  socket.on('chat:message', async (text) => {
    const user = await User.findById(socket.user.id);
    if (!user) return;
    if (user.chatBannedUntil && user.chatBannedUntil > new Date()) return;

    const textString = String(text).slice(0, 1000);

    const msg = await ChatMessage.create({
      room: 'global',
      senderId: user._id,
      senderName: user.username,
      text: textString
    });

    io.to('global').emit('chat:message', msg.toObject());

    // 4. 🔹 Detectar si llama al bot (@bot)
    if (textString.startsWith('@bot')) {
      const prompt = textString.replace('@bot', '').trim();
      io.to('global').emit('chat:typing', '🤖 Asistente IA');

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Eres un asistente simpático de chat.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
        });

        const botResponse = completion.choices[0].message.content;

        if (BOT_USER_ID) {
          const botMsg = await ChatMessage.create({
            room: 'global',
            senderId: BOT_USER_ID,
            senderName: '🤖 Asistente IA',
            text: botResponse
          });
          io.to('global').emit('chat:message', botMsg.toObject());
        } 
      } catch (error) {
        console.error('❌ Error IA:', error.message);
      }
    }
  });

  socket.on('chat:typing', () => {
    socket.to('global').emit('chat:typing', socket.user.username);
  });

  socket.on('dm:message', async ({ toUserId, text }) => {
    if (!toUserId || !text) return;
    const a = socket.user.id;
    const b = toUserId;
    const room = `dm:${[a, b].sort().join(':')}`;

    const msg = await ChatMessage.create({
      room,
      senderId: a,
      senderName: socket.user.username,
      text: String(text).slice(0, 1000)
    });

    const payload = msg.toObject();
    io.to(`user:${toUserId}`).emit('dm:message', payload);
    io.to(`user:${a}`).emit('dm:message', payload);
  });

  socket.on('dm:history', async ({ withUserId }) => {
    if (!withUserId) return;
    const room = `dm:${[socket.user.id, withUserId].sort().join(':')}`;
    const hist = await ChatMessage.find({ room })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    socket.emit('dm:history', { withUserId, messages: hist.reverse() });
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Usuario desconectado: ${socket.user?.username}`);
  });
});

app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

server.listen(config.port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${config.port}`);
  console.log(`🔮 GraphQL disponible en http://localhost:${config.port}/graphql`);
});