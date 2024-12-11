const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const router = express.Router();
// const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

// Create api key route
// router.post('/create-api-key', async (req, res) => {
//     const apiKey = crypto.randomBytes(16).toString('hex');
// console.log(apiKey);
//     res.json({ apiKey });
// });

router.post('/login', async (req, res) => {
    const { adminId, password } = req.body;

    try {
        // Check if the admin exists
        const admin = await Admin.findOne({ adminId });
        if (!admin) {
            return res.status(400).json({ error: 'Admin not found' });
        }

        // Check the password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Generate JWT
        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ message: 'Login successful', token, admin });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Middleware to verify API Key
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const authorizedApiKey = process.env.AUTHORIZED_API_KEY;
  
    if (apiKey === authorizedApiKey) {
      next();
    } else {
      return res.status(403).json({ error: 'Access denied. Invalid API key.' });
    }
  };
  
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
  router.post('/signup', verifyApiKey, async (req, res) => {
    const { name, email, phone, password } = req.body;
  
    try {
      // Check if the admin already exists
      const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });
      if (existingAdmin) {
        return res
          .status(400)
          .json({ error: 'Admin with this email or phone already exists' });
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
      });
      await admin.save();
  
      res.status(201).json({
        message: 'Admin created successfully',
        adminId,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error during signup' });
    }
  });

module.exports = router;