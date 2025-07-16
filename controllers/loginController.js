// controllers/loginController.js
const passport = require("passport");
const axios = require("axios");

// Render the login page
exports.renderLoginPage = (req, res) => {
  console.log("📄 Rendering login page...");
  console.log(
    "🔍 Current user:",
    req.user ? `${req.user.firstName} (${req.user.email})` : "None"
  );

  if (req.user) {
    console.log("✅ User already logged in, redirecting to dashboard");
    return res.redirect("/dashboard");
  }

  // Get flash messages
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
    recaptcha_site_key: process.env.RECAPTCHA_SITE_KEY, // Add this line
  });
};

// Verify reCAPTCHA
async function verifyRecaptcha(recaptchaResponse) {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;

    const response = await axios.post(verifyUrl);
    return response.data.success;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

// Handle login form submission
exports.handleLogin = async (req, res, next) => {
  console.log("🔐 Login attempt for:", req.body.email);

  // Verify reCAPTCHA first
  const recaptchaResponse = req.body["g-recaptcha-response"];

  if (!recaptchaResponse) {
    console.log("❌ No reCAPTCHA response provided");
    req.flash("error_message", "Please complete the reCAPTCHA verification");
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

  // Continue with normal authentication
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("💥 Authentication error:", err);
      return next(err);
    }

    if (!user) {
      console.log(
        "❌ Login failed:",
        info ? info.message : "Invalid credentials"
      );
      req.flash(
        "error_message",
        info ? info.message : "Invalid email or password"
      );
      return res.redirect("/login");
    }

    // Check if account is confirmed
    if (!user.isConfirmed) {
      console.log("⚠️ Login blocked: Account not confirmed");
      req.flash(
        "error_message",
        "Account not confirmed yet. Please contact support."
      );
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("💥 Session error:", err);
        return next(err);
      }

      console.log("✅ Login successful for:", user.email, "- Role:", user.role);
      return res.redirect("/dashboard");
    });
  })(req, res, next);
};
