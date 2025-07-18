// routes/signupRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// ============================================
// RENDER SIGNUP PAGE
// ============================================
router.get("/signup", (req, res) => {
  console.log("📄 Rendering signup page...");

  // Get formData flash message (custom flash for form persistence)
  const formDataStr = req.flash("formData")[0] || null;

  // Parse form data if available
  let formData = null;
  if (formDataStr) {
    try {
      formData = JSON.parse(formDataStr);
      // Remove passwords for security (never preserve passwords)
      if (formData.password) delete formData.password;
      if (formData.confirmPassword) delete formData.confirmPassword;
    } catch (e) {
      console.log("❌ Error parsing form data:", e);
      formData = null;
    }
  }

  // Log flash messages (available via res.locals from global middleware)
  console.log("📨 Flash messages available:", {
    error_message: res.locals.error_message,
    success_message: res.locals.success_message,
    has_formData: !!formData,
  });

  // Render signup page
  // Note: error_message and success_message are automatically available
  // via res.locals from the global middleware in server.js
  res.render("signup", {
    user: req.user || null,
    formData: formData,
    title: "Create Account - IAAI Training",
  });
});

// ============================================
// HANDLE SIGNUP FORM SUBMISSION
// ============================================
router.post("/signup", async (req, res, next) => {
  console.log("📝 POST /signup route hit");

  try {
    // Call the user controller to handle registration
    await userController.registerUser(req, res, next);
  } catch (error) {
    console.error("💥 Unexpected error in signup route:", error);

    // Set error flash message for unexpected errors
    req.flash(
      "error_message",
      "An unexpected error occurred. Please try again later."
    );

    // Preserve form data (excluding passwords for security)
    const formDataToPreserve = { ...req.body };
    delete formDataToPreserve.password;
    delete formDataToPreserve.confirmPassword;
    req.flash("formData", JSON.stringify(formDataToPreserve));

    // Redirect back to signup page
    res.redirect("/signup");
  }
});

// ============================================
// ADMIN ACCOUNT CONFIRMATION
// ============================================
router.get("/confirm-user/:email", userController.confirmUser);

// ============================================
// TEST ROUTE FOR NOTIFICATIONS (DEVELOPMENT/TESTING)
// ============================================
router.get("/test-notification", (req, res) => {
  console.log("🧪 Test notification route accessed");

  const type = req.query.type || "success";
  const message = req.query.message || "This is a test notification";

  // Validate notification type
  if (!["success", "error"].includes(type)) {
    return res
      .status(400)
      .send("Invalid notification type. Use 'success' or 'error'.");
  }

  // Set flash message
  req.flash(`${type}_message`, message);
  console.log(`🧪 Test ${type} message set:`, message);

  // Redirect to signup to display the notification
  res.redirect("/signup");
});

// ============================================
// HEALTH CHECK ROUTE (OPTIONAL)
// ============================================
router.get("/signup/health", (req, res) => {
  res.json({
    status: "OK",
    route: "signup",
    timestamp: new Date().toISOString(),
    message: "Signup routes are working correctly",
  });
});

module.exports = router;
