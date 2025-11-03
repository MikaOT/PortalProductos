import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema({
  // Room: 'global' o 'dm:<userAId>:<userBId>' (ordenado)
  room: { type: String, required: true, index: true },

  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  text:       { type: String, required: true, maxlength: 1000 },
  isDeleted: { type: Boolean, default: false }


}, { timestamps: true });

export const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
