//latestNewsRoutes.js

//routes/newsDetailsRoutes.js - New routes for news details
const express = require("express");
const router = express.Router();
const newsDetailsController = require("../controllers/NewsController");

console.log("📰 Loading news details routes...");

// News details page with upcoming courses
router.get("/NewsDetails", newsDetailsController.getNewsDetails);
router.get("/news-details", newsDetailsController.getNewsDetails);
router.get("/news", newsDetailsController.getNewsDetails); // Alternative route

console.log("✅ News details routes loaded successfully");

module.exports = router;
