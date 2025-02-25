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
      type: Object,
      default: null,
    },
    grouped_orders: { type: Array, default: [] },
    isPickupVerified: { type: Boolean, default: false },
    isDropVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiderOrderHistory", riderOrderHistorySchema);
