const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
  {
    riderId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    vehicleNumber: { type: String, required: true, unique: true },
    lenzAdminId: { type: String },
    password: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
    isWorking: { type: Boolean, default: false },
    totalOrders: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    dailyEarnings: { type: Number, default: 0 },
    dailyOrders: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rider", riderSchema);
