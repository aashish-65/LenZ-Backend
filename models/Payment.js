// models/Payment.js // Have to work on it.
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, unique: true },
  amount: { type: Number, required: true }, // in paise
  currency: { type: String, default: "INR" },
  status: { 
    type: String, 
    enum: ['created', 'attempted', 'captured', 'failed'],
    default: 'created'
  },
  method: { type: String },
  groupOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupOrder" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  paymentOption: { type: String, enum: ['full', 'delivery'], required: true }
}, { timestamps: true });

// Indexes
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ groupOrderId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);