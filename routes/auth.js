const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// User Signup
router.post('/signup', async (req, res) => {
  const { name, email, phone, password, plan } = req.body;

  try {

    // Check if the user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
        if (existingUser) {
            return res.status(401).json({ error: 'Email or phone number already exists' });
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

    // Create a new user
    const newUser = new User({
      userId,
      name,
      email,
      phone,
      password: hashedPassword,
      plan,
    });

    await newUser.save();

    res.status(201).json({ message: 'Signup successful', userId });
  } catch (error) {
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// User Login
router.post('/login', async (req, res) => {
  const { userId, password } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({ message: 'Login successful', token, user });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Verify Token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

module.exports = router;
