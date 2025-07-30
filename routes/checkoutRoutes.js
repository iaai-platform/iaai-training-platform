// routes/checkoutRoutes.js - FULLY CORRECTED VERSION
const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/checkoutController");
const isAuthenticated = require("../middlewares/isAuthenticated");

// ========================================
// CHECKOUT FLOW ROUTES
// ========================================

// ✅ Display checkout page
router.get("/checkout", isAuthenticated, checkoutController.getCheckoutPage);

// ✅ Apply promo codes
router.post(
  "/apply-promo-code",
  isAuthenticated,
  checkoutController.applyPromoCode
);

// ✅ Process checkout - decides between free registration or payment
router.post("/checkout", isAuthenticated, checkoutController.processCheckout);

// ✅ Payment page (only for paid courses)
router.get("/payment", isAuthenticated, checkoutController.processPayment);

// ✅ Complete registration for FREE courses (promo codes, linked courses, $0 total)
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
// CCAVENUE PAYMENT ROUTES (Only for paid courses)
// ========================================

// ✅ CRITICAL FIX: Initiate CCAvenue payment (only called for paid courses)
router.post(
  "/payment/initiate",
  isAuthenticated,
  checkoutController.proceedToPayment
);

// ✅ CCAvenue response handler (webhook - no authentication)
router.post("/payment/response", checkoutController.handlePaymentResponse);

// ✅ CCAvenue cancellation handlers
router.get("/payment/cancel", checkoutController.handlePaymentCancel);
router.post("/payment/cancel", checkoutController.handlePaymentCancel);

// ========================================
// SUCCESS/RESULT PAGES
// ========================================

// ✅ UNIFIED SUCCESS PAGE - handles both free and paid courses with session recovery
router.get("/payment/success", async (req, res) => {
  const { order_id, amount, ref, userId } = req.query;

  // MINIMAL SESSION RECOVERY - Add this block
  if (!req.user && userId) {
    try {
      const User = require("../models/user");
      const user = await User.findById(userId);
      if (user && user.accountStatus.isActive) {
        req.login(user, () => {});
        console.log("✅ Session recovered for user:", user.email);
      }
    } catch (error) {
      console.error("❌ Session recovery failed:", error);
    }
  }
  // END SESSION RECOVERY

  // Determine if this was a free registration or paid transaction
  const isFreeRegistration = amount === "0.00" || order_id === "FREE";

  console.log(`🎉 Success page accessed:`, {
    order_id,
    amount,
    ref,
    isFree: isFreeRegistration,
  });

  res.render("payment/success", {
    order_id: order_id || "FREE",
    amount: amount || "0.00",
    referenceNumber: ref,
    user: req.user || null,
    isFreeRegistration: isFreeRegistration,
    title: isFreeRegistration
      ? "Registration Successful - IAAI Training"
      : "Payment Successful - IAAI Training",
  });
});

// ✅ LEGACY SUCCESS ROUTE - redirect to unified success page
router.get("/success", (req, res) => {
  const { order_id, amount, ref } = req.query;

  // Redirect to the unified success page
  res.redirect(
    `/payment/success?order_id=${order_id || "FREE"}&amount=${
      amount || "0.00"
    }&ref=${ref || ""}`
  );
});

// ✅ Payment failure page
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

// ✅ Payment error page
router.get("/payment/error", (req, res) => {
  const { message } = req.query;

  console.log(`⚠️ Payment error: ${message}`);

  res.render("payment/error", {
    message: message || "An error occurred during payment processing",
    user: req.user || null,
    title: "Payment Error - IAAI Training",
  });
});

// ✅ Payment cancelled page
router.get("/payment/cancelled", (req, res) => {
  console.log(`❌ Payment cancelled by user`);

  res.render("payment/cancelled", {
    user: req.user || null,
    title: "Payment Cancelled - IAAI Training",
  });
});

// ✅ Policies page
router.get("/policies", (req, res) => {
  res.render("policies", {
    user: req.user || null,
    title: "Policies - IAAI",
  });
});

module.exports = router;
