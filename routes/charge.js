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

// Endpoint to update shifting charges
router.put("/update-shifting-charges", verifyApiKey, async (req, res) => {
  try {
    const { FullFrame, Supra, Rimless } = req.body;

    if (
      typeof FullFrame !== "number" ||
      typeof Supra !== "number" ||
      typeof Rimless !== "number"
    ) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const updatedShiftingCharges = await Charges.findOneAndUpdate(
      { type: "shiftingCharges" },
      {
        $set: {
          "data.Full Frame": FullFrame,
          "data.Supra": Supra,
          "data.Rimless": Rimless,
        },
      },
      { new: true }
    );

    if (!updatedShiftingCharges) {
      return res.status(404).json({ error: "Shifting charges not found" });
    }

    res.status(200).json({
      message: "Shifting charges updated successfully",
      confirmation: true,
    });
  } catch (error) {
    console.error("Error updating shifting charges:", error);
    res.status(500).json({ error: "Internal server error", confirmation: false });
  }
});

// Endpoint to update the entire fitting charges
router.put('/update-fitting-charges', verifyApiKey, async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing data' });
    }

    const updatedFittingCharges = await Charges.findOneAndUpdate(
      { type: 'fittingCharges' },
      { $set: { data: data } },
      { new: true }
    );

    if (!updatedFittingCharges) {
      return res.status(404).json({ error: 'Fitting charges not found' });
    }

    res.status(200).json({
      message: 'Fitting charges updated successfully',
      confirmation: true,
    });
  } catch (error) {
    console.error('Error updating fitting charges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
