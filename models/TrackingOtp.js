const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  groupOrder_id: { type: mongoose.Schema.Types.ObjectId, ref: "GroupOrder" },
  otp_code: { type: String, required: true },
  purpose: {
    type: String,
    enum: ["pickup", "admin_receipt", "delivery"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now, expires: 1800 },
});

module.exports = mongoose.model("TRACKINGOTP", otpSchema);
