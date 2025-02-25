const mongoose = require("mongoose");

const riderOrderHistorySchema = new mongoose.Schema(
  {
    rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    delivery_type: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },
    group_order_ids: [
      { type: mongoose.Schema.Types.ObjectId, ref: "GroupOrder" },
    ],
    order_key: { type: String, required: true },
    paymentAmount: { type: Number, required: true },
    isCompleted: { type: Boolean, default: false },
    shop_details: {
      shopName: { type: String },
      dealerName: { type: String },
      address: { type: Object },
      phone: { type: String },
      alternatePhone: { type: String },
    },
    grouped_orders: { type: Array, default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiderOrderHistory", riderOrderHistorySchema);
