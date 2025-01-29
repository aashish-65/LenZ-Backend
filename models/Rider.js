const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  available: { type: Boolean, default: true }, // To track rider availability
}, { timestamps: true });

module.exports = mongoose.model("Rider", riderSchema);