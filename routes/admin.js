const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const router = express.Router();
// const crypto = require('crypto');
const dotenv = require("dotenv");
dotenv.config();

// Middleware to verify API Key
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["lenz-api-key"];
  const authorizedApiKey = process.env.AUTHORIZED_API_KEY;

  if (!apiKey) {
    return res
      .status(401)
      .json({ error: "API key is missing.", confirmation: false });
  }

  if (apiKey === authorizedApiKey) {
    next();
  } else {
    return res
      .status(403)
      .json({ error: "Access denied. Invalid API key.", confirmation: false });
  }
};

router.post("/login", verifyApiKey, async (req, res) => {
  const { adminId, password } = req.body;

  try {
    // Check if the admin exists
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res
        .status(401)
        .json({ message: "Admin Not Found", confirmation: false });
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Invalid Password", confirmation: false });
    }

    // Generate JWT
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ message: "Login Successful", confirmation: true, token, admin });
  } catch (error) {
    res.status(500).json({ message: "Server error during login" });
  }
});

// Function to generate unique adminId
const generateUniqueAdminId = async () => {
  let adminId;
  let isUnique = false;

  while (!isUnique) {
    adminId = Math.floor(100000 + Math.random() * 900000); // Generate a 6-digit ID
    const existingAdmin = await Admin.findOne({ adminId });
    if (!existingAdmin) {
      isUnique = true;
    }
  }

  return adminId;
};

// Signup route
router.post("/signup", verifyApiKey, async (req, res) => {
  const { name, email, phone, password, address } = req.body;

  try {
    // Check if the admin already exists
    const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });
    if (existingAdmin) {
      return res.status(401).json({
        error: "Admin with this email or phone already exists",
        confirmation: false,
      });
    }

    // Validate address fields
    if (
      !address ||
      !address.line1 ||
      !address.city ||
      !address.state ||
      !address.pinCode
    ) {
      return res
        .status(400)
        .json({ error: "Address fields are incomplete", confirmation: false });
    }

    // Generate a unique adminId
    const adminId = await generateUniqueAdminId();

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the admin
    const admin = new Admin({
      name,
      email,
      phone,
      password: hashedPassword,
      adminId,
      address: {
        line1: address.line1,
        line2: address.line2 || "",
        landmark: address.landmark || "",
        city: address.city,
        state: address.state,
        pinCode: address.pinCode,
      },
    });
    await admin.save();

    res.status(201).json({
      message: "Admin created successfully",
      confirmation: true,
      adminId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during signup" });
  }
});

router.get("/", verifyApiKey, async (req, res) => {
  try {
    const admin = await Admin.find();
    res.status(200).json({ admin, confirmation: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", confirmation: false });
  }
});

module.exports = router;
