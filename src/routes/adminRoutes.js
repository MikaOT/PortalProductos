import express from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';

const router = express.Router();

// helper: solo admin real
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Solo administradores' });
  next();
}

// 🔴 Promover a admin
router.post('/users/:id/promote', authenticateJWT, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { role: 'admin' }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true, user });
});

// 🚫 Ban global (impide login/uso)
router.post('/users/:id/ban', authenticateJWT, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true, user });
});

// ♻️ Unban
router.post('/users/:id/unban', authenticateJWT, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: false }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true, user });
});

// 🔇 Veto de chat temporal
router.post('/users/:id/chat-mute', authenticateJWT, requireAdmin, async (req, res) => {
  const { minutes = 60, reason } = req.body;
  const until = new Date(Date.now() + minutes*60*1000);
  const user = await User.findByIdAndUpdate(req.params.id, { chatBannedUntil: until }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true, user, reason: reason || null });
});

router.post('/users/:id/chat-unmute', authenticateJWT, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { chatBannedUntil: null }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true, user });
});

// 💸 Dar moneda (airdrop)
router.post('/wallet/grant', authenticateJWT, requireAdmin, async (req, res) => {
  const { userId, amount } = req.body;
  if (!userId || !Number.isFinite(amount)) return res.status(400).json({ message: 'userId y amount requeridos' });
  const user = await User.findByIdAndUpdate(userId, { $inc: { balance: Math.floor(amount) } }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true, balance: user.balance });
});

// 🧹 Eliminar producto con motivo (soft-delete)
router.post('/products/:id/delete', authenticateJWT, requireAdmin, async (req, res) => {
  const { reason = 'Incumplimiento de normas' } = req.body;
  const p = await Product.findByIdAndUpdate(req.params.id, { isActive: false, deletionReason: reason }, { new: true });
  if (!p) return res.status(404).json({ message: 'Producto no encontrado' });
  res.json({ ok: true, product: p });
});

// 🧹 Eliminar (ocultar) mensaje del chat
router.post('/chat/:id/delete', authenticateJWT, requireAdmin, async (req, res) => {
  const msg = await ChatMessage.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
  if (!msg) return res.status(404).json({ message: 'Mensaje no encontrado' });
  res.json({ ok: true, msg });
});

export default router;
