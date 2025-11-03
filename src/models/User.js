import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, minlength: 2 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role:     { type: String, enum: ['user','admin'], default: 'user' },

  // 💰 Moneda fake del sistema
  balance: { type: Number, default: 1000 },

  // 🚫 Moderación
  isBanned: { type: Boolean, default: false },              // ban global (login/uso)
  chatBannedUntil: { type: Date, default: null },           // veto temporal del chat

}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function(pwd) {
  return bcrypt.compare(pwd, this.password);
};

export const User = mongoose.model('User', UserSchema);
