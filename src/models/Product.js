import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 }, // 🔢 stock numérico
  imageUrl: String,

  // 🧾 tipo de ítem
  kind: { type: String, enum: ['physical','digital','service'], default: 'physical' },

  // 👤 dueño del producto
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Moderación de productos
  isActive: { type: Boolean, default: true },
  deletionReason: { type: String, default: null },

}, { timestamps: true });

export const Product = mongoose.model('Product', ProductSchema);
