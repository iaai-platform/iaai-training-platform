// routes/checkoutRoutes.js
const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// ✅ Route to display the checkout page
router.get('/checkout', isAuthenticated, checkoutController.getCheckoutPage);

// ✅ Route to apply promo codes and update the price
router.post('/apply-promo-code', isAuthenticated, checkoutController.applyPromoCode);

// ✅ Route to decide if user should go to payment or success (checks total price)
router.post('/checkout', isAuthenticated, checkoutController.processCheckout);

// ✅ Route to process payment (for users who need to pay)
router.get('/payment', isAuthenticated, checkoutController.processPayment);

// ✅ NEW: Route to confirm payment and send email (after payment is processed)
router.post('/process-payment-confirmation', isAuthenticated, checkoutController.processPaymentConfirmation);

// ✅ Route to complete registration (for 100% discount users) - BOTH POST AND GET
router.post('/complete-registration', isAuthenticated, checkoutController.completeRegistration);
router.get('/complete-registration', isAuthenticated, checkoutController.completeRegistration);

// ✅ Route to display success page after successful registration
router.get('/success', isAuthenticated, (req, res) => {
  const referenceNumber = req.query.ref;
  console.log(`🎉 Success page accessed with reference: ${referenceNumber}`);
  res.render('success', { 
    referenceNumber: referenceNumber,
    user: req.user || null,
    title: 'Registration Successful'
  });
});


//new
router.get('/policies', (req, res) => {
  res.render('policies', { 
    user: req.user || null,
    title: 'Policies - IAAI'
  });
});




module.exports = router;