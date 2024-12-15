const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
const shopRoutes = require('./routes/shops');
const adminRoutes = require('./routes/admin');
const app = express();

dotenv.config();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/admin', adminRoutes);
// app.use('/api/orders', require('./routes/orders')); // Frame orders

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
