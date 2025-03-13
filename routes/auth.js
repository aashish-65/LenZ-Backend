const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const Admin = require("../models/Admin");
require("dotenv").config();

const router = express.Router();

// Configure nodemailer for email
const transporter = nodemailer.createTransport({
  service: "Gmail", // Replace with your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// User Signup
router.post("/signup", async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    plan,
    shopName,
    alternatePhone,
    address,
    adminId,
    authToken,
  } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(401).json({ error: "Email already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let userId;
    let isUnique = false;
    // Generate a unique 10-digit ID
    while (!isUnique) {
      userId = Math.floor(100000 + Math.random() * 900000);
      const existingUser = await User.findOne({ userId });
      if (!existingUser) {
        isUnique = true;
      }
    }

    // Validate the address
    if (
      !address ||
      !address.line1 ||
      !address.city ||
      !address.state ||
      !address.pinCode
    ) {
      return res.status(400).json({ error: "Incomplete address details" });
    }

    const emailTemplate = `
          <div style="font-family: 'Roboto', sans-serif; background-color: #f4f4f7; padding: 20px; margin: 0;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
    
    <!-- Header Section -->
    <tr style="background-color: #007BFF; text-align: center;">
      <td style="padding: 20px;">
        <img src="https://lenz-booking.netlify.app/web-app-manifest-192x192.png" alt="LenZ Logo" style="height: 60px; max-width: 100%; margin-bottom: 10px;">
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">Welcome to LenZ, ${name}!</h1>
        <p style="color: #dce6f1; font-size: 14px; margin-top: 8px;">Your journey to smarter eyewear solutions begins here.</p>
      </td>
    </tr>

    <!-- Body Section -->
    <tr>
      <td style="padding: 20px; color: #333333;">
        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
          Thank you for signing up with <strong>LenZ</strong>. We are thrilled to have you onboard! Below are your account details for quick reference:
        </p>

        <!-- User Details -->
        <table style="width: 100%; background-color: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e3e6ea; margin: 20px 0;">
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>User ID:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${userId}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Email:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${email}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Phone:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${phone}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Plan:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${plan}</td>
          </tr>
          <tr>
            <td style="font-size: 14px; padding: 8px 0;"><strong>Shop Name:</strong></td>
            <td style="font-size: 14px; padding: 8px 0;">${shopName}</td>
          </tr>
        </table>

        <p style="font-size: 16px; line-height: 1.6; margin: 0;">
          You can now log in to your account to manage your subscription, create orders, and explore our features.
        </p>
      </td>
    </tr>

    <!-- Call to Action -->
    <tr>
      <td style="text-align: center; padding: 20px;">
        <a href="https://lenz-booking.netlify.app/login" 
           style="display: inline-block; padding: 14px 24px; font-size: 16px; color: #ffffff; background-color: #007BFF; border-radius: 8px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 6px rgba(0, 123, 255, 0.4); max-width: 90%; width: auto;">
          Login to Your Account
        </a>
      </td>
    </tr>

    <!-- Footer Section -->
    <tr style="background-color: #f1f3f5;">
      <td style="text-align: center; padding: 20px; color: #777777; font-size: 14px;">
        <p style="margin: 0;">LenZ © ${new Date().getFullYear()} | All Rights Reserved.</p>
        <p style="margin: 10px 0;">
          <a href="https://lenz-booking.netlify.app/terms" style="color: #007BFF; text-decoration: none;">Terms of Service</a> | 
          <a href="https://lenz-booking.netlify.app/privacy" style="color: #007BFF; text-decoration: none;">Privacy Policy</a>
        </p>
      </td>
    </tr>
  </table>
</div>
`;

    const mailOptions = {
      from: `"LenZ" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to LenZ!",
      html: emailTemplate,
    };

    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    let correctAdminKey = admin.authToken;
    if (authToken !== correctAdminKey) {
      return res.status(401).json({ error: "Invalid Admin Key" });
    }

    // Create a new user
    const newUser = new User({
      userId,
      name,
      email,
      phone,
      alternatePhone,
      shopName,
      password: hashedPassword,
      plan,
      lenzAdminId: adminId,
      address: {
        line1: address.line1,
        line2: address.line2 || "",
        landmark: address.landmark || "",
        city: address.city,
        state: address.state,
        pinCode: address.pinCode,
      },
    });

    await newUser.save();
    await transporter.sendMail(mailOptions);

    const newAuthToken = Math.floor(100000 + Math.random() * 900000);
    admin.authToken = newAuthToken;
    await admin.save();

    res.status(201).json({ message: "Signup successful", userId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "5d",
    });

    res.json({ message: "Login successful", token, user });
  } catch (error) {
    res.status(500).json({ error: "Server error during login" });
  }
});

// Verify Token
router.get("/verify", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization token missing or malformed" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
