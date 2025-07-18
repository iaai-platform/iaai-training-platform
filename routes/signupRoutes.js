// routes/signupRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// Render signup page
router.get("/signup", (req, res) => {
  console.log("📄 Rendering signup page...");

  // Get flash messages (these will be consumed after reading)

  const formDataStr = req.flash("formData")[0] || null;

  // Parse form data if available
  let formData = null;
  if (formDataStr) {
    try {
      formData = JSON.parse(formDataStr);
      // Don't preserve passwords for security
      if (formData.password) delete formData.password;
      if (formData.confirmPassword) delete formData.confirmPassword;
    } catch (e) {
      console.log("Error parsing form data:", e);
      formData = null;
    }
  }

  console.log("📨 Messages to send to template:", {
    error_message: error_message,
    success_message: success_message,
    has_formData: !!formData,
  });

  res.render("signup", {
    error_message: error_message,
    success_message: success_message,
    user: req.user || null,
    formData: formData,
    title: "Create Account - IAAI Training",
  });
});

// Handle POST request for signup with enhanced error handling
router.post("/signup", async (req, res, next) => {
  try {
    await userController.registerUser(req, res, next);
  } catch (error) {
    console.error("💥 Unexpected error in signup route:", error);

    // Set error flash message for unexpected errors
    req.flash(
      "error_message",
      "An unexpected error occurred. Please try again later."
    );
    req.flash("formData", JSON.stringify(req.body));

    res.redirect("/signup");
  }
});

// Route to confirm user account (for admin use)
router.get("/confirm-user/:email", userController.confirmUser);

// Add a test route for notifications (optional - for testing)
router.get("/test-notification", (req, res) => {
  const type = req.query.type || "success";
  const message = req.query.message || "This is a test notification";

  req.flash(`${type}_message`, message);
  res.redirect("/signup");
});

module.exports = router;
