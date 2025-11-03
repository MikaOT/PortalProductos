import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  buyer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  quantity: { type: Number, required: true, min: 1 },
  amount:   { type: Number, required: true, min: 0 },

  status: { type: String, enum: ['completed','failed'], default: 'completed' },

}, { timestamps: true });

export const Transaction = mongoose.model('Transaction', TransactionSchema);
