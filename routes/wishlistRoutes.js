// routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// ✅ 1️⃣ Display Wishlist Page
router.get('/wishlist', isAuthenticated, wishlistController.getWishlistPage);



// ✅ 3️⃣ Remove Course from Wishlist
router.post('/remove-from-wishlist', isAuthenticated, wishlistController.removeFromWishlist);

// ✅ 4️⃣ Move Course from Wishlist to Cart
router.post('/move-to-cart', isAuthenticated, wishlistController.moveToCart);

module.exports = router;