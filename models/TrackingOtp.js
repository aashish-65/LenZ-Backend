const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  groupOrder_id: { type: mongoose.Schema.Types.ObjectId, ref: "GroupOrder" },
  order_key: { type: String },
  otp_code: { type: String, required: true },
  purpose: {
    type: String,
    enum: ["shop_pickup", "admin_delivery", "admin_pickup", "shop_delivery"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TrackingOtp", otpSchema);
