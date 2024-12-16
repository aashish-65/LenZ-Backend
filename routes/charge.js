const express = require("express");
const router = express.Router();
const Charges = require("../models/Charge");

router.get("/:type", async (req, res) => {
  const { type } = req.params;

  try {
    const charges = await Charges.findOne({ type });
    if (!charges) {
      return res.status(404).json({ message: "Data not found" });
    }
    res.json(charges);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch data", error });
  }
});

router.get("/", async (req, res) => {
  try {
    const charges = await Charges.find();
    res.status(200).json(charges);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch data", error });
  }
});

module.exports = router;
