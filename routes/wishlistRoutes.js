// routes/wishlistRoutes.js
const express = require("express");
const router = express.Router();
const wishlistController = require("../controllers/wishlistController");
const isAuthenticated = require("../middlewares/isAuthenticated");

console.log("❤️ Loading wishlist page routes...");

// ✅ Display Wishlist Page (use different path to avoid conflicts)
router.get("/my-wishlist", isAuthenticated, wishlistController.getWishlistPage);

// Alternative: you can also use this if you want to keep /wishlist
// Just make sure this route file is loaded BEFORE cartWishlistRoutes.js in your main app
// router.get('/wishlist', isAuthenticated, wishlistController.getWishlistPage);

// ✅ Remove Course from Wishlist (page-specific)
router.post(
  "/wishlist/remove",
  isAuthenticated,
  wishlistController.removeFromWishlist
);

// ✅ Move Course from Wishlist to Cart (page-specific)
router.post(
  "/wishlist/move-to-cart",
  isAuthenticated,
  wishlistController.moveToCart
);

console.log("✅ Wishlist page routes loaded successfully");

module.exports = router;
