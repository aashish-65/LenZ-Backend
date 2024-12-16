const mongoose = require("mongoose");
const Charge = require("./models/Charge"); // Path to your Charge model
const dotenv = require('dotenv');
dotenv.config();

const shiftingCharges = {
  "Full Frame": 15,
  Supra: 20,
  Rimless: 40,
};

const fittingCharges = {
  "Full Frame": {
    Normal: {
      low: { Single: 15, Double: 25 },
      high: { Single: 20, Double: 35 },
    },
    PR: {
      low: { Single: 50, Double: 100 },
      high: { Single: 60, Double: 120 },
    },
    Sunglass: {
      low: { Single: 20, Double: 40 },
      high: { Single: 20, Double: 40 },
    },
  },
  Supra: {
    Normal: {
      low: { Single: 20, Double: 35 },
      high: { Single: 25, Double: 45 },
    },
    PR: {
      low: { Single: 50, Double: 100 },
      high: { Single: 60, Double: 120 },
    },
    Sunglass: {
      low: { Single: 25, Double: 50 },
      high: { Single: 25, Double: 50 },
    },
  },
  Rimless: {
    Normal: {
      low: { Single: 40, Double: 80 },
      high: { Single: 50, Double: 100 },
    },
    PR: {
      low: { Single: 60, Double: 120 },
      high: { Single: 75, Double: 150 },
    },
    Poly: {
      low: { Single: 50, Double: 100 },
      high: { Single: 60, Double: 120 },
    },
    PolyPR: {
      low: { Single: 75, Double: 150 },
      high: { Single: 90, Double: 180 },
    },
    Sunglass: {
      low: { Single: 60, Double: 120 },
      high: { Single: 60, Double: 120 },
    },
  },
};

const insertData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Insert shiftingCharges
    await Charge.create({ type: "shiftingCharges", data: shiftingCharges });

    // Insert fittingCharges
    await Charge.create({ type: "fittingCharges", data: fittingCharges });

    console.log("Data inserted successfully!");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error inserting data:", error);
    mongoose.connection.close();
  }
};

insertData();
