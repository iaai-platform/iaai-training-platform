// routes/cartRoutes.js (renamed from ordersRoutes.js)
const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middlewares/isAuthenticated');
const ordersController = require('../controllers/ordersController');

// Cart routes
router.get('/orders', isAuthenticated, ordersController.getCartPage); // Orders page shows cart items
router.post('/remove-from-cart', isAuthenticated, ordersController.removeFromCart);
router.get('/checkout', isAuthenticated, ordersController.checkout);

// If you need a purchase history page later, you can add:
// router.get('/purchase-history', isAuthenticated, ordersController.getPurchaseHistory);

module.exports = router;