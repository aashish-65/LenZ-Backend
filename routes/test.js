const express = require('express');
const router = express.Router();
const Test = require('../models/test'); 

router.get('/', (req, res) => {
    Test.find().then(tests => {
        res.json(tests);
    });
});

module.exports = router;