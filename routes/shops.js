const express = require("express");
const router = express.Router();
const Shop = require("../models/User");
const dotenv = require("dotenv");
dotenv.config();

// Middleware to verify the API key
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

router.get("/", verifyApiKey, async (req, res) => {
  try {
    const shops = await Shop.find();
    res.status(200).json(shops);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:userId", verifyApiKey, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await Shop.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Shop not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:userId/edit-distance", verifyApiKey, async (req, res) => {
  const { userId } = req.params;
  const { newDistance } = req.body;

  try {
    if (!newDistance) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const user = await Shop.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "Shop not found" });
    }

    let delCharge = 0;
    if(newDistance > 0 && newDistance <= 5){
      delCharge = 100;
    }else if(newDistance > 5 && newDistance <= 7){
      delCharge = 125;
    }else if(newDistance > 7 && newDistance <= 10){
      delCharge = 150;
    }

    user.distance = newDistance;
    user.deliveryCharge = delCharge;
    await user.save();

    res
      .status(200)
      .json({ message: "Distance updated successfully", confirmation: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// update credit balance
router.put("/:userId/edit-credit-bal", verifyApiKey, async (req, res) => {
  const { userId } = req.params;
  const { newCreditAmt } = req.body;

  try {
    const user = await Shop.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "Shop not found" });
    }

    user.creditBalance = newCreditAmt;
    await user.save();

    res
      .status(200)
      .json({
        message: "Credit Amount updated successfully",
        confirmation: true,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
