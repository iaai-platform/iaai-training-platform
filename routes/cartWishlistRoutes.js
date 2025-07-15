// routes/cartWishlistRoutes.js
const express = require('express');
const router = express.Router();
const cartWishlistController = require('../controllers/cartWishlistController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.post('/add-to-cart', isAuthenticated, cartWishlistController.addToCart);
router.post('/add-to-wishlist', isAuthenticated, cartWishlistController.addToWishlist);


// In routes/cartWishlistRoutes.js, add:
router.post('/remove-from-cart', isAuthenticated, cartWishlistController.removeFromCart);

module.exports = router;