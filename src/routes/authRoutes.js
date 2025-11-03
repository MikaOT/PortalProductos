import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config.js';

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role, username: user.username }, config.jwtSecret, { expiresIn: '2h' });
}

// Registro -> SIEMPRE role 'user'
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body; // ❗ sin 'role'
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email ya registrado' });

    const user = new User({ username, email, password, role: 'user' });
    await user.save();

    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, username: user.username, email: user.email, role: user.role, balance: user.balance } });
  } catch (e) {
    res.status(400).json({ message: 'Error al registrar', error: e.message });
  }
});

// Login (igual que tenías)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
    if (user.isBanned) return res.status(403).json({ message: 'Usuario baneado' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = signToken(user);
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, role: user.role, balance: user.balance } });
  } catch (e) {
    res.status(500).json({ message: 'Error en login', error: e.message });
  }
});

// 🔹 Obtener perfil actual del usuario logueado
import { authenticateJWT } from '../middleware/authenticateJWT.js';

router.get('/me', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: user.balance
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener usuario', error: err.message });
  }
});

export default router;
