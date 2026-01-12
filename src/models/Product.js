import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 }, // Importante para el E-commerce
  imageUrl: String,
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true }, // Para borrado lógico

}, { timestamps: true });

export const Product = mongoose.model('Product', ProductSchema);