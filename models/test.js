const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
    notification: { type: Boolean },
});

module.exports = mongoose.model('Test', testSchema);