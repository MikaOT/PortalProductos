import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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

// App + HTTP + Socket.IO
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: config.clientOrigin, credentials: true }
});

// Middlewares
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
// app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Conexión a Mongo + seed admin
console.log('🔍 Intentando conectar a:', config.mongoUri);
async function connectDatabase() {
  if (config.mongoUri === 'disabled') {
    console.warn('⚠️ Modo demo: conexión MongoDB deshabilitada en producción');
    return;
  }

  try {
    console.log(`🔍 Intentando conectar a: ${config.mongoUri}`);
    await mongoose.connect(config.mongoUri);
    console.log('✅ MongoDB conectado correctamente');

    // Seed admin
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

// --- Socket.IO handlers ---
io.on('connection', async (socket) => {
  const me = await User.findById(socket.user.id);
  if (!me || me.isBanned) {
    socket.disconnect(true);
    return;
  }

   // ✅ Enviar info básica del usuario conectado al cliente
  socket.on('getUserInfo', () => {
    socket.emit('userInfo', { id: socket.user.id, username: socket.user.username, role: socket.user.role });
  });

  // Rooms
  socket.join('global');
  socket.join(`user:${socket.user.id}`);

  // Historial global (50)
  const history = await ChatMessage.find({ room: 'global' })
    .sort({ createdAt: -1 }).limit(50).lean();
  socket.emit('history', history.reverse());

  // Mensaje global
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

  // typing
  socket.on('chat:typing', () => {
    socket.to('global').emit('chat:typing', socket.user.username);
  });

  // DM: enviar
  socket.on('dm:message', async ({ toUserId, text }) => {
    if (!toUserId || !text) return;
    const a = socket.user.id;
    const b = toUserId;
    const room = `dm:${[a,b].sort().join(':')}`;

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

  // DM: historial
  socket.on('dm:history', async ({ withUserId }) => {
    if (!withUserId) return;
    const room = `dm:${[socket.user.id, withUserId].sort().join(':')}`;
    const hist = await ChatMessage.find({ room })
      .sort({ createdAt: -1 }).limit(50).lean();
    socket.emit('dm:history', { withUserId, messages: hist.reverse() });
  });
});

// (opcional) proteger acceso a /chat.html desde el servidor
app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Arranque
server.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});
