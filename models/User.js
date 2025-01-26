const mongoose = require("mongoose");
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    alternatePhone: { type: String },
    password: { type: String, required: true },
    shopName: { type: String, required: true },
    plan: { type: String, required: true },
    userId: { type: Number, required: true, unique: true },
    address: {
      line1: { type: String, required: true },
      line2: { type: String },
      landmark: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model("User", userSchema);
