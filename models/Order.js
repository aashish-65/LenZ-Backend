const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Reference to the User
    customerDetails: Object,
    frameOptions: Object,
    shiftingOrFitting: String,
    purchaseLens: String,
    glassType: String,
    lensDetails: Object,
    materialDetails: Object,
    coatingDetails: Object,
    powerDetails: Object,
    powerType: String,
    powerEntryType: String,
    fittingCharge: Number,
    shiftingCharge: Number,
    totalAmount: Number,
    paymentType: String,
    orderPlaced: Boolean,
    // New fields for group orders and payment
    isGroupOrder: { type: Boolean, default: false }, // Indicates if this order is part of a group order
    groupOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "GroupOrder" }, // Reference to the GroupOrder
    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "completed"],
      default: "unpaid",
    }, // Payment status
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
