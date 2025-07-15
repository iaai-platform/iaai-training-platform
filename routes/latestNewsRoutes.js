//latestNewsRoutes.js
const express = require('express');
const router = express.Router();
const NewsController = require('../controllers/NewsController');

// ✅ Route to Fetch News Details Page
router.get('/NewsDetails', NewsController.getAllNewsDetails);

module.exports = router;