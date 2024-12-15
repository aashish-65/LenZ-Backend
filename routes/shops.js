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
        return res.status(401).json({ error: "API key is missing.", confirmation: false });
    }

    if (apiKey === authorizedApiKey) {
        next();
    } else {
        return res.status(403).json({ error: "Access denied. Invalid API key.", confirmation: false });
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

module.exports = router;