const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    address: {
      line1: { type: String, required: true },
      line2: { type: String },
      landmark: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
    },
    password: { type: String, required: true },
    adminId: { type: Number, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
