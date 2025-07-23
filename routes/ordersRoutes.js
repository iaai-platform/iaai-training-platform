// routes/ordersRoutes.js - REQUIRED FOR ORDER PAGE DISPLAY
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const isAuthenticated = require("../middlewares/isAuthenticated");
const ordersController = require("../controllers/ordersController");

console.log("📋 Loading orders routes...");

// ========================================
// ORDERS DISPLAY ROUTE (REQUIRED)
// ========================================

// Orders page shows cart items with linked course support
router.get("/orders", isAuthenticated, ordersController.getCartPage);

console.log("✅ Orders routes loaded successfully");

module.exports = router;
