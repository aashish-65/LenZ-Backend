const mongoose = require("mongoose");

const chargesSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const Charge = mongoose.model("Charge", chargesSchema);

module.exports = Charge;
