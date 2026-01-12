import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  products: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true } // Guardamos precio al momento de compra
    }
  ],

  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'completed' },
  
}, { timestamps: true });

export const Order = mongoose.model('Order', OrderSchema);