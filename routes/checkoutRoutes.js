// routes/checkoutRoutes.js - Updated with proper free course handling
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

// ✅ Initiate CCAvenue payment (only called for paid courses)
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

// ✅ UNIFIED SUCCESS PAGE - handles both free and paid courses
router.get("/payment/success", (req, res) => {
  const { order_id, amount, ref } = req.query;

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

// Add this temporary route to clean up malformed transactions
// Add to your routes file temporarily

router.get("/clear-transactions", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    console.log(
      `Clearing ${user.paymentTransactions.length} transactions for user ${user.email}`
    );

    // Clear all transactions
    user.paymentTransactions = [];
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `Cleared transactions for ${user.email}`,
    });
  } catch (error) {
    console.error("Error clearing transactions:", error);
    res
      .status(500)
      .json({ success: false, message: "Error clearing transactions" });
  }
});
module.exports = router;
