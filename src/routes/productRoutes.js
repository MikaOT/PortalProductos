import express from 'express';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { Product } from '../models/Product.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';

const router = express.Router();

// Listado público (solo activos)
router.get('/', async (_req, res) => {
  const items = await Product.find({ isActive: true }).sort({ createdAt: -1 }).lean();
  res.json(items);
});

// Crear producto (cualquier user autenticado)
router.post('/', authenticateJWT, async (req, res) => {
  const { name, description, price, stock, imageUrl, kind } = req.body;
  const product = await Product.create({
    name, description, price, stock, imageUrl, kind,
    owner: req.user.id
  });
  res.status(201).json(product);
});

// Editar (solo dueño o admin)
router.put('/:id', authenticateJWT, async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'No encontrado' });
  const isOwner = p.owner.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Sin permisos' });

  const { name, description, price, stock, imageUrl, kind } = req.body;
  Object.assign(p, { name, description, price, stock, imageUrl, kind });
  await p.save();
  res.json(p);
});

// Eliminar (dueño o admin). Si es admin, mejor usar el endpoint con motivo (adminRoutes)
router.delete('/:id', authenticateJWT, async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'No encontrado' });
  const isOwner = p.owner.toString() === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Sin permisos' });

  await p.deleteOne();
  res.json({ ok: true });
});

// 🛒 Comprar producto (resta stock, transfiere saldo)
router.post('/:id/buy', authenticateJWT, async (req, res) => {
  const qty = Math.max(1, Number(req.body.quantity || 1));
  const product = await Product.findById(req.params.id).populate('owner');
  if (!product || !product.isActive) return res.status(404).json({ message: 'Producto no disponible' });
  if (product.stock < qty) return res.status(400).json({ message: 'Stock insuficiente' });
  if (product.owner._id.toString() === req.user.id) return res.status(400).json({ message: 'No puedes comprar tu propio producto' });

  const buyer = await User.findById(req.user.id);
  const seller = product.owner;

  const total = product.price * qty;
  if (buyer.balance < total) return res.status(400).json({ message: 'Saldo insuficiente' });

  // Transacción “atómica” simple (para la práctica es suficiente)
  buyer.balance -= total;
  seller.balance += total;
  product.stock -= qty;

  await Promise.all([ buyer.save(), seller.save(), product.save() ]);
  await Transaction.create({
    product: product._id,
    buyer: buyer._id,
    seller: seller._id,
    quantity: qty,
    amount: total,
    status: 'completed'
  });

  res.json({ ok: true, balance: buyer.balance, stock: product.stock });
});

export default router;
