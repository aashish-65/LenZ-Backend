const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const testRoutes = require("./routes/test");
const shopRoutes = require("./routes/shops");
const adminRoutes = require("./routes/admin");
const chargeRoutes = require("./routes/charge");
const orderRoutes = require("./routes/orders");
const profileRoutes = require("./routes/profile");
const otpRoutes = require("./routes/otp");
const paymentRoutes = require("./routes/payment");
const riderRoutes = require("./routes/rider");
const compression = require("compression");
// const {startPing} = require("./pingServices");

const app = express();

app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/charges", chargeRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/riders", riderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {console.log(`Server running on port ${PORT}`);
// startPing("https://lenz-backend.onrender.com/api/test/");
});