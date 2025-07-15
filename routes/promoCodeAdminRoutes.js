const express = require('express');
const router = express.Router();
const promoCodeAdminController = require('../controllers/promoCodeAdminController');
const isAdmin = require('../middlewares/isAdmin'); // Ensure the user is an admin

// ✅ Route: Display the Promo Code Management Page
router.get('/admin-promo-codes', isAdmin, promoCodeAdminController.getPromoCodes);

// ✅ Route: Add a New Promo Code
router.post('/admin-promo-codes/add', isAdmin, promoCodeAdminController.addPromoCode);

// ✅ Route: Delete a Promo Code
router.post('/admin-promo-codes/delete/:id', isAdmin, promoCodeAdminController.deletePromoCode);

module.exports = router;    