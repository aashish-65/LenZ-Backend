const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  available: { type: Boolean, default: true }, // To track rider availability
  totalOrders: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  dailyEarnings: { type: Number, default: 0 },
  dailyOrders: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Rider", riderSchema);