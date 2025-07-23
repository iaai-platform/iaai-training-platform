// routes/checkoutRoutes.js - Updated with CCAvenue Integration & Linked Course Support
const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/checkoutController");
const isAuthenticated = require("../middlewares/isAuthenticated");

// ========================================
// EXISTING CHECKOUT ROUTES (Keep these)
// ✅ These already handle linked courses through the controller
// ========================================

// ✅ Route to display the checkout page (handles linked courses automatically)
router.get("/checkout", isAuthenticated, checkoutController.getCheckoutPage);

// ✅ Route to apply promo codes and update the price
router.post(
  "/apply-promo-code",
  isAuthenticated,
  checkoutController.applyPromoCode
);

// ✅ Route to decide if user should go to payment or success (checks total price)
router.post("/checkout", isAuthenticated, checkoutController.processCheckout);

// ✅ Route to process payment (for users who need to pay)
router.get("/payment", isAuthenticated, checkoutController.processPayment);

// ✅ Route to complete registration (for 100% discount users) - BOTH POST AND GET
router.post(
  "/complete-registration",
  isAuthenticated,
  checkoutController.completeRegistration
);
router.get(
  "/complete-registration",
  isAuthenticated,
  checkoutController.completeRegistration
);

// ========================================
// NEW CCAVENUE ROUTES (Add these to existing file)
// ========================================

// ✅ NEW: Route to initiate CCAvenue payment (handles linked courses automatically)
router.post(
  "/payment/initiate",
  isAuthenticated,
  checkoutController.proceedToPayment
);

// ✅ NEW: CCAvenue response handler (NO authentication needed - this is a webhook)
router.post("/payment/response", checkoutController.handlePaymentResponse);

// ✅ NEW: CCAvenue cancellation handler
router.get("/payment/cancel", checkoutController.handlePaymentCancel);
router.post("/payment/cancel", checkoutController.handlePaymentCancel); // Some gateways use POST

// ========================================
// PAYMENT RESULT PAGES (Add these)
// ========================================

// Payment success page
router.get("/payment/success", isAuthenticated, (req, res) => {
  const { order_id, amount, ref } = req.query;

  console.log(
    `🎉 Payment success page: Order ${order_id}, Amount $${amount}, Ref ${ref}`
  );

  res.render("payment/success", {
    order_id: order_id,
    amount: amount,
    referenceNumber: ref,
    user: req.user,
    title: "Payment Successful - IAAI Training",
  });
});

// Payment failure page
router.get("/payment/failure", (req, res) => {
  const { order_id, reason } = req.query;

  console.log(`❌ Payment failure: Order ${order_id}, Reason: ${reason}`);

  res.render("payment/failure", {
    order_id: order_id,
    reason: reason || "Payment could not be processed",
    user: req.user || null,
    title: "Payment Failed - IAAI Training",
  });
});

// Payment error page
router.get("/payment/error", (req, res) => {
  const { message } = req.query;

  console.log(`⚠️ Payment error: ${message}`);

  res.render("payment/error", {
    message: message || "An error occurred during payment processing",
    user: req.user || null,
    title: "Payment Error - IAAI Training",
  });
});

// Payment cancelled page
router.get("/payment/cancelled", (req, res) => {
  console.log(`❌ Payment cancelled by user`);

  res.render("payment/cancelled", {
    user: req.user || null,
    title: "Payment Cancelled - IAAI Training",
  });
});

// ✅ Route to display success page after successful registration (EXISTING)
router.get("/success", isAuthenticated, (req, res) => {
  const referenceNumber = req.query.ref;
  console.log(`🎉 Success page accessed with reference: ${referenceNumber}`);
  res.render("success", {
    referenceNumber: referenceNumber,
    user: req.user || null,
    title: "Registration Successful",
  });
});

// ✅ EXISTING policies route
router.get("/policies", (req, res) => {
  res.render("policies", {
    user: req.user || null,
    title: "Policies - IAAI",
  });
});

module.exports = router;
