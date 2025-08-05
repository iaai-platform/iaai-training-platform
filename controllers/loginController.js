// controllers/loginController.js - FINAL CLEAN VERSION
const passport = require("passport");
const axios = require("axios");

// Render the login page
exports.renderLoginPage = (req, res) => {
  console.log("📄 Rendering login page...");

  // Redirect if already logged in
  if (req.user) {
    console.log("✅ User already logged in, redirecting to dashboard");
    return res.redirect("/dashboard");
  }

  // Get flash messages (these should work now that global middleware is fixed)
  const errorMessage =
    req.flash("error_message")[0] || req.flash("error")[0] || null;
  const successMessage = req.flash("success_message")[0] || null;

  console.log("📨 Messages to display:", {
    error: errorMessage,
    success: successMessage,
  });

  res.render("login", {
    error_message: errorMessage,
    success_message: successMessage,
    user: null,
    recaptcha_site_key: process.env.RECAPTCHA_SITE_KEY,
  });
};

// Verify reCAPTCHA
async function verifyRecaptcha(recaptchaResponse) {
  try {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.log("⚠️ No reCAPTCHA secret key found, skipping verification");
      return true; // Skip reCAPTCHA in development if not configured
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;

    const response = await axios.post(verifyUrl);
    console.log("🔍 reCAPTCHA verification result:", response.data.success);
    return response.data.success;
  } catch (error) {
    console.error("💥 reCAPTCHA verification error:", error);
    return false;
  }
}

// Handle login form submission
exports.handleLogin = async (req, res, next) => {
  const { email, password } = req.body;
  console.log("🔐 Login attempt for:", email);

  try {
    // Basic validation
    if (!email || !password) {
      console.log("❌ Missing email or password");
      req.flash("error_message", "Please provide both email and password.");
      return res.redirect("/login");
    }

    // reCAPTCHA verification
    const recaptchaResponse = req.body["g-recaptcha-response"];
    if (!recaptchaResponse) {
      console.log("❌ No reCAPTCHA response");
      req.flash("error_message", "Please complete the reCAPTCHA verification.");
      return res.redirect("/login");
    }

    const isHuman = await verifyRecaptcha(recaptchaResponse);
    if (!isHuman) {
      console.log("❌ reCAPTCHA verification failed");
      req.flash(
        "error_message",
        "reCAPTCHA verification failed. Please try again."
      );
      return res.redirect("/login");
    }

    console.log("✅ reCAPTCHA verified successfully");

    // Passport authentication
    passport.authenticate("local", (err, user, info) => {
      console.log("🔍 Passport authenticate result:", {
        error: !!err,
        user: user ? user.email : null,
        info: info?.message || null,
      });

      if (err) {
        console.error("💥 Authentication error:", err);
        req.flash(
          "error_message",
          "An error occurred during login. Please try again."
        );
        return res.redirect("/login");
      }

      if (!user) {
        console.log("❌ Authentication failed");

        let errorMessage = "Invalid email or password.";
        if (info && info.message) {
          errorMessage = info.message;
        }

        req.flash("error_message", errorMessage);
        return res.redirect("/login");
      }

      // Login user
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error("💥 Session login error:", loginErr);
          req.flash(
            "error_message",
            "Failed to establish session. Please try again."
          );
          return res.redirect("/login");
        }

        console.log(
          "✅ Login successful for:",
          user.email,
          "- Role:",
          user.role
        );
        return res.redirect("/dashboard");
      });
    })(req, res, next);
  } catch (error) {
    console.error("💥 Login handler error:", error);
    req.flash(
      "error_message",
      "An unexpected error occurred. Please try again."
    );
    return res.redirect("/login");
  }
};

// Test endpoint for flash messages
exports.testFlashMessage = (req, res) => {
  console.log("🧪 Setting test flash messages");
  req.flash("error_message", "TEST: This is a test error message!");
  req.flash("success_message", "TEST: This is a test success message!");
  res.redirect("/login");
};
