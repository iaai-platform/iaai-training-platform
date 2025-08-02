// routes/checkoutRoutes.js - ENHANCED VERSION WITH BILLING API
const express = require("express");
const router = express.Router();
const checkoutController = require("../controllers/checkoutController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const User = require("../models/user");

// ========================================
// CHECKOUT FLOW ROUTES (EXISTING)
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
// 🆕 BILLING API ROUTES (NEW - ADDED TO EXISTING FILE)
// ========================================

// ✅ GET user billing information for checkout
// ✅ GET user billing information for checkout
router.get("/api/user/billing-info", isAuthenticated, async (req, res) => {
  try {
    console.log("📋 Fetching billing info for user:", req.user.email);

    const user = await User.findById(req.user._id).select(
      "firstName lastName email phoneNumber country addressInfo professionalInfo"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ⭐ FIX: Return data in the format the HTML expects
    const billingData = {
      success: true,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      country: user.country || "",

      // Professional info
      professionalInfo: {
        title: user.professionalInfo?.title || "",
      },

      // Address info
      addressInfo: {
        address: user.addressInfo?.address || "",
        city: user.addressInfo?.city || "",
        state: user.addressInfo?.state || "",
        zipCode: user.addressInfo?.zipCode || "",
        country: user.addressInfo?.country || user.country || "",
        alternativePhone: user.addressInfo?.alternativePhone || "",
        isComplete: user.addressInfo?.isComplete || false,
      },
    };

    console.log("✅ Billing data retrieved successfully");
    res.json(billingData);
  } catch (error) {
    console.error("❌ Error fetching billing info:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching billing information",
    });
  }
});

// ✅ UPDATE user billing information from checkout
// ✅ UPDATE user billing information from checkout
router.post(
  "/api/user/update-billing-info",
  isAuthenticated,
  async (req, res) => {
    try {
      console.log("💾 Updating billing info for user:", req.user.email);
      console.log("📋 Billing data received:", req.body);

      const {
        title,
        firstName,
        lastName,
        email,
        phoneNumber,
        address,
        city,
        state,
        zipCode,
        country,
        alternativePhone,
      } = req.body;

      // Validate required fields
      const requiredFields = {
        firstName,
        lastName,
        email,
        phoneNumber,
        address,
        city,
        country,
      };
      const missingFields = [];

      Object.keys(requiredFields).forEach((field) => {
        if (!requiredFields[field] || requiredFields[field].trim() === "") {
          missingFields.push(field);
        }
      });

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
          missingFields: missingFields,
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      // Phone validation (basic)
      if (phoneNumber.length < 10) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid phone number (minimum 10 digits)",
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Update basic information
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.email = email.trim().toLowerCase();
      user.phoneNumber = phoneNumber.trim();
      user.country = country.trim();

      // Update professional info (title)
      if (!user.professionalInfo) {
        user.professionalInfo = {};
      }
      if (title && title.trim() !== "") {
        user.professionalInfo.title = title.trim();
      }

      // ⭐ COMPLETE FIX: Update address information manually
      if (!user.addressInfo) {
        user.addressInfo = {};
      }

      user.addressInfo.address = address.trim();
      user.addressInfo.city = city.trim();
      user.addressInfo.state = state ? state.trim() : "";
      user.addressInfo.zipCode = zipCode ? zipCode.trim() : "";
      user.addressInfo.country = country.trim();
      user.addressInfo.alternativePhone = alternativePhone
        ? alternativePhone.trim()
        : "";
      user.addressInfo.lastUpdated = new Date();

      // ⭐ NEW: Calculate completion status
      const requiredAddressFields = [
        user.addressInfo.address,
        user.addressInfo.city,
        user.addressInfo.country,
      ];
      user.addressInfo.isComplete = requiredAddressFields.every(
        (field) => field && field.trim() !== ""
      );

      // ⭐ NEW: Calculate overall profile completion percentage
      const profileFields = {
        basicInfo: !!(
          user.firstName &&
          user.lastName &&
          user.email &&
          user.phoneNumber
        ),
        addressInfo: user.addressInfo.isComplete,
        professionalInfo: !!user.professionalInfo?.title,
        country: !!user.country,
      };

      const completedFields =
        Object.values(profileFields).filter(Boolean).length;
      const totalFields = Object.keys(profileFields).length;
      const profileCompletionPercentage = Math.round(
        (completedFields / totalFields) * 100
      );

      // ⭐ NEW: Update profile completion status if it exists
      if (user.profileData && user.profileData.completionStatus) {
        user.profileData.completionStatus.basicInfo = profileFields.basicInfo;
        user.profileData.completionStatus.addressInfo =
          profileFields.addressInfo;
        user.profileData.completionStatus.professionalInfo =
          profileFields.professionalInfo;
        user.profileData.completionStatus.overallPercentage =
          profileCompletionPercentage;
        user.profileData.completionStatus.lastUpdated = new Date();
      }

      // ⭐ NEW: Update payment readiness
      const isPaymentReady = !!(
        user.firstName &&
        user.lastName &&
        user.email &&
        user.phoneNumber &&
        user.addressInfo.address &&
        user.addressInfo.city &&
        user.addressInfo.country
      );

      // Save user with validation disabled to avoid conflicts
      await user.save({ validateBeforeSave: false });

      console.log("✅ Billing information updated successfully");
      console.log("📊 Profile completion:", profileCompletionPercentage + "%");
      console.log("💳 Payment ready:", isPaymentReady);

      // ⭐ COMPLETE RESPONSE: Return all data the frontend expects
      res.json({
        success: true,
        message: "Billing information updated successfully",
        profileCompletionPercentage: profileCompletionPercentage,
        isPaymentReady: isPaymentReady,
        isComplete: user.addressInfo.isComplete,
        updatedFields: {
          basicInfo: profileFields.basicInfo,
          addressInfo: profileFields.addressInfo,
          professionalInfo: profileFields.professionalInfo,
        },
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          country: user.country,
          addressInfo: user.addressInfo,
          professionalInfo: user.professionalInfo,
        },
      });
    } catch (error) {
      console.error("❌ Error updating billing info:", error);

      // Handle specific MongoDB errors
      if (error.code === 11000) {
        if (error.keyPattern && error.keyPattern.email) {
          return res.status(400).json({
            success: false,
            message:
              "This email address is already registered to another account",
            field: "email",
          });
        }
        if (error.keyPattern && error.keyPattern.phoneNumber) {
          return res.status(400).json({
            success: false,
            message:
              "This phone number is already registered to another account",
            field: "phoneNumber",
          });
        }
      }

      // Handle validation errors
      if (error.name === "ValidationError") {
        const validationErrors = {};
        Object.keys(error.errors).forEach((key) => {
          validationErrors[key] = error.errors[key].message;
        });

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        message: "Error updating billing information. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// ✅ VALIDATE billing information for checkout (optional - for enhanced validation)
router.post("/api/user/validate-billing", isAuthenticated, async (req, res) => {
  try {
    const billingData = req.body;

    // Validate required fields for CCAvenue
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phoneNumber",
      "address",
      "city",
      "country",
    ];

    const errors = {};
    const missingFields = [];

    requiredFields.forEach((field) => {
      if (!billingData[field] || billingData[field].trim() === "") {
        missingFields.push(field);
        errors[field] = "This field is required";
      }
    });

    // Email validation
    if (
      billingData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingData.email)
    ) {
      errors.email = "Please enter a valid email address";
    }

    // Phone validation (basic)
    if (billingData.phoneNumber && billingData.phoneNumber.length < 10) {
      errors.phoneNumber = "Please enter a valid phone number";
    }

    const isValid = Object.keys(errors).length === 0;

    res.json({
      success: isValid,
      errors: errors,
      missingFields: missingFields,
      message: isValid
        ? "Billing information is valid"
        : "Please correct the errors below",
    });
  } catch (error) {
    console.error("❌ Error validating billing info:", error);
    res.status(500).json({
      success: false,
      message: "Error validating billing information",
    });
  }
});

// ========================================
// CCAVENUE PAYMENT ROUTES (EXISTING)
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
// SUCCESS/RESULT PAGES (EXISTING)
// ========================================

// ✅ UNIFIED SUCCESS PAGE - handles both free and paid courses with session recovery
router.get("/payment/success", async (req, res) => {
  const { order_id, amount, ref, userId } = req.query;

  // MINIMAL SESSION RECOVERY - Add this block
  if (!req.user && userId) {
    try {
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
