const mongoose = require("mongoose");

const riderOrderHistorySchema = new mongoose.Schema(
  {
    rider_id: { type: mongoose.Schema.Types.ObjectId, ref: "Rider" },
    delivery_type: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },
    order_key: { type: String, required: true },
    paymentAmount: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RIDERORDERHISTORY", riderOrderHistorySchema);
