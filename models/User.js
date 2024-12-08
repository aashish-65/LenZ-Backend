const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  plan: { type: String, required: true },
  userId: { type: Number, required: true, unique: true },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);