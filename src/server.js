import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

import { config } from './config.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';

import { ChatMessage } from './models/ChatMessage.js';
import { User } from './models/User.js';

// __dirname en ESModules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- App + HTTP + Socket.IO ---
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: config.clientOrigin, credentials: true }
});

// --- Middlewares ---
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Rutas API ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
      console.log(`🔑 Admin seed creado -> ${adminEmail} / ${adminPass}`);
    } else {
      console.log(`🔑 Admin seed OK (${adminEmail})`);
    }
  } catch (err) {
    console.error('❌ Error al conectar con MongoDB:', err.message);
  }
}

await connectDatabase();

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
      return next(new Error('jwt expired')); // mensaje claro al cliente
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

  // --- Mensaje global ---
  socket.on('chat:message', async (text) => {
    const user = await User.findById(socket.user.id);
    if (!user) return;

    if (user.chatBannedUntil && user.chatBannedUntil > new Date()) return;

    const msg = await ChatMessage.create({
      room: 'global',
      senderId: user._id,
      senderName: user.username,
      text: String(text).slice(0, 1000)
    });

    io.to('global').emit('chat:message', msg.toObject());
  });

  // --- Typing ---
  socket.on('chat:typing', () => {
    socket.to('global').emit('chat:typing', socket.user.username);
  });

  // --- Mensajes privados (DM) ---
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

  // --- Historial DM ---
  socket.on('dm:history', async ({ withUserId }) => {
    if (!withUserId) return;
    const room = `dm:${[socket.user.id, withUserId].sort().join(':')}`;
    const hist = await ChatMessage.find({ room })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    socket.emit('dm:history', { withUserId, messages: hist.reverse() });
  });

  // --- Desconexión ---
  socket.on('disconnect', () => {
    console.log(`🔴 Usuario desconectado: ${socket.user?.username}`);
  });
});

// --- Servir el chat protegido ---
app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// --- Arranque ---
server.listen(config.port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${config.port}`);
});
