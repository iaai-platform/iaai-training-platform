// routes/signupRoutes.js - Complete Email & Notification Focused Version
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

  // Render signup page with all necessary data
  res.render("signup", {
    user: req.user || null,
    formData: formData,
    title: "Create Account - IAAI Training",
    // Flash messages are automatically available via res.locals
  });
});

// ============================================
// HANDLE SIGNUP FORM SUBMISSION
// ============================================
router.post("/signup", async (req, res, next) => {
  console.log("📝 POST /signup route hit");
  console.log("📧 Email notifications will be triggered for:", req.body.email);

  try {
    // Call the user controller to handle registration
    // This will trigger:
    // 1. Save user to database
    // 2. Send admin notification email to CONFIRM_EMAIL
    await userController.registerUser(req, res, next);
  } catch (error) {
    console.error("💥 Unexpected error in signup route:", error);

    // Set error flash message for unexpected errors
    req.flash(
      "error_message",
      "An unexpected error occurred during registration. Please try again later."
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
// ADMIN ACCOUNT CONFIRMATION (EMAIL LINK)
// ============================================
router.get("/confirm-user/:email", async (req, res, next) => {
  console.log("📧 Account confirmation triggered for:", req.params.email);
  console.log("📧 This will trigger welcome email to user");

  try {
    // Call the user controller to handle confirmation
    // This will trigger:
    // 1. Set user.isConfirmed = true
    // 2. Send welcome email to user
    // 3. Show admin confirmation success page
    await userController.confirmUser(req, res, next);
  } catch (error) {
    console.error("💥 Unexpected error in confirmation route:", error);

    res.status(500).send(`
      <html>
        <head>
          <title>Confirmation Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8f9fa; }
            .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #dc3545; }
            .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="error">❌ Confirmation Error</h2>
            <p>There was an unexpected error confirming the account for <strong>${
              req.params.email
            }</strong>.</p>
            <p>Please try again or contact technical support.</p>
            <a href="${
              process.env.BASE_URL || "https://www.iaa-i.com"
            }/admin/users" class="btn">👥 Back to User Management</a>
          </div>
        </body>
      </html>
    `);
  }
});

// ============================================
// PASSWORD RESET EMAIL ROUTES
// ============================================

// Render forgot password page
router.get("/forgot-password", (req, res) => {
  console.log("📄 Rendering forgot password page...");

  res.render("forgot-password", {
    user: req.user || null,
    title: "Forgot Password - IAAI Training",
    error_message: res.locals.error_message,
    success_message: res.locals.success_message,
  });
});

// Handle forgot password form submission
router.post("/forgot-password", async (req, res, next) => {
  console.log("📧 Password reset email request for:", req.body.email);
  console.log("📧 This will trigger password reset email");

  try {
    // Call the user controller to handle password reset request
    // This will trigger:
    // 1. Generate reset token
    // 2. Send password reset email to user
    await userController.requestPasswordReset(req, res, next);
  } catch (error) {
    console.error("💥 Unexpected error in password reset request:", error);

    req.flash(
      "error_message",
      "An unexpected error occurred while sending password reset email. Please try again."
    );
    res.redirect("/forgot-password");
  }
});

// Render reset password page
router.get("/reset-password/:token", async (req, res, next) => {
  console.log("📄 Rendering reset password page for token:", req.params.token);

  try {
    const User = require("../models/user");

    // Check if token is valid and not expired
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log("❌ Invalid or expired reset token");
      req.flash(
        "error_message",
        "Password reset token is invalid or has expired. Please request a new one."
      );
      return res.redirect("/forgot-password");
    }

    console.log("✅ Valid reset token for user:", user.email);

    res.render("reset-password", {
      user: req.user || null,
      token: req.params.token,
      resetUser: user,
      title: "Reset Password - IAAI Training",
      error_message: res.locals.error_message,
      success_message: res.locals.success_message,
    });
  } catch (error) {
    console.error("💥 Error validating reset token:", error);
    req.flash(
      "error_message",
      "Something went wrong while validating reset token. Please try again."
    );
    res.redirect("/forgot-password");
  }
});

// Handle reset password form submission
router.post("/reset-password/:token", async (req, res, next) => {
  console.log("📧 Password reset completion for token:", req.params.token);
  console.log("📧 This will trigger password change confirmation email");

  try {
    // Call the user controller to handle password reset
    // This will trigger:
    // 1. Update user password
    // 2. Clear reset token
    // 3. Send password change confirmation email to user
    await userController.resetPassword(req, res, next);
  } catch (error) {
    console.error("💥 Unexpected error in password reset:", error);

    req.flash(
      "error_message",
      "An unexpected error occurred while resetting password. Please try again."
    );
    res.redirect(`/reset-password/${req.params.token}`);
  }
});

// ============================================
// EMAIL TESTING & DEBUGGING ROUTES
// ============================================

// Test email configuration (Development/Testing only)
router.get("/test-email", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not found");
  }

  console.log("🧪 Email configuration test route accessed");
  console.log("🧪 Testing email settings:", {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "✅ Set" : "❌ Missing",
    CONFIRM_EMAIL: process.env.CONFIRM_EMAIL ? "✅ Set" : "❌ Missing",
    BASE_URL: process.env.BASE_URL ? "✅ Set" : "❌ Missing",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "✅ Set" : "❌ Missing",
    EMAIL_HOST: process.env.EMAIL_HOST ? "✅ Set" : "❌ Missing",
  });

  try {
    const sendEmail = require("../utils/sendEmail");

    const testEmailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || "IAAI Training Platform",
        address:
          process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "info@iaa-i.com",
      },
      to: process.env.CONFIRM_EMAIL || "info@iaa-i.com",
      subject: "🧪 Email Configuration Test - IAAI Training",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 30px; border-radius: 10px; }
            .header { background: #17a2b8; color: white; padding: 20px; border-radius: 5px; text-align: center; margin-bottom: 20px; }
            .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .info-table td { padding: 8px; border: 1px solid #ddd; }
            .info-table td:first-child { background: #e9ecef; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🧪 Email Configuration Test</h2>
              <p>IAAI Training Platform</p>
            </div>
            
            <h3>✅ Email Test Successful!</h3>
            <p>If you received this email, your email configuration is working correctly.</p>
            
            <h3>📊 Configuration Details:</h3>
            <table class="info-table">
              <tr>
                <td>Timestamp</td>
                <td>${new Date().toLocaleString()}</td>
              </tr>
              <tr>
                <td>Environment</td>
                <td>${process.env.NODE_ENV || "development"}</td>
              </tr>
              <tr>
                <td>Base URL</td>
                <td>${process.env.BASE_URL || "Not set"}</td>
              </tr>
              <tr>
                <td>Admin Email (FROM)</td>
                <td>${process.env.ADMIN_EMAIL || "Not set"}</td>
              </tr>
              <tr>
                <td>Confirm Email (TO)</td>
                <td>${process.env.CONFIRM_EMAIL || "Not set"}</td>
              </tr>
              <tr>
                <td>Email Service</td>
                <td>${process.env.SENDGRID_API_KEY ? "SendGrid" : "SMTP"}</td>
              </tr>
            </table>
            
            <h3>🔗 Test Links:</h3>
            <p>Confirmation Link Format: <br>
            <code>${
              process.env.BASE_URL || "https://www.iaa-i.com"
            }/confirm-user/test@example.com</code></p>
            
            <h3>📧 Expected Email Flow:</h3>
            <ol>
              <li><strong>User Signs Up</strong> → Admin notification sent to ${
                process.env.CONFIRM_EMAIL || "info@iaa-i.com"
              }</li>
              <li><strong>Admin Confirms</strong> → Welcome email sent to user</li>
              <li><strong>Password Reset</strong> → Reset link sent to user</li>
              <li><strong>Password Changed</strong> → Confirmation sent to user</li>
            </ol>
          </div>
        </body>
        </html>
      `,
    };

    await sendEmail(testEmailOptions);

    console.log("✅ Test email sent successfully");

    res.json({
      status: "SUCCESS",
      message: "Test email sent successfully!",
      details: {
        sentFrom:
          process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "info@iaa-i.com",
        sentTo: process.env.CONFIRM_EMAIL || "info@iaa-i.com",
        emailService: process.env.SENDGRID_API_KEY
          ? "SendGrid"
          : "SMTP Fallback",
        baseUrl: process.env.BASE_URL || "Not set",
        timestamp: new Date().toISOString(),
      },
      configuration: {
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "Set" : "Missing",
        CONFIRM_EMAIL: process.env.CONFIRM_EMAIL ? "Set" : "Missing",
        BASE_URL: process.env.BASE_URL ? "Set" : "Missing",
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "Set" : "Missing",
        EMAIL_HOST: process.env.EMAIL_HOST ? "Set" : "Missing",
      },
    });
  } catch (error) {
    console.error("🧪 Test email failed:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Test email failed",
      error: error.message,
      details: {
        emailService: process.env.SENDGRID_API_KEY
          ? "SendGrid"
          : "SMTP Fallback",
        timestamp: new Date().toISOString(),
      },
      configuration: {
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ? "Set" : "Missing",
        CONFIRM_EMAIL: process.env.CONFIRM_EMAIL ? "Set" : "Missing",
        BASE_URL: process.env.BASE_URL ? "Set" : "Missing",
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "Set" : "Missing",
        EMAIL_HOST: process.env.EMAIL_HOST ? "Set" : "Missing",
      },
    });
  }
});

// Test notification flash messages
router.get("/test-notification", (req, res) => {
  console.log("🧪 Test notification route accessed");

  const type = req.query.type || "success";
  const message = req.query.message || "This is a test notification message";

  // Validate notification type
  if (!["success", "error"].includes(type)) {
    return res.status(400).json({
      error: "Invalid notification type. Use 'success' or 'error'.",
      validTypes: ["success", "error"],
      example: "/test-notification?type=success&message=Test message",
    });
  }

  // Set flash message
  req.flash(`${type}_message`, message);
  console.log(`🧪 Test ${type} message set:`, message);

  // Redirect to signup to display the notification
  res.redirect("/signup");
});

// Email notification status (for debugging)
router.get("/email-status", (req, res) => {
  console.log("📊 Email status check requested");

  const emailConfig = {
    adminEmail: process.env.ADMIN_EMAIL || "Not set",
    confirmEmail: process.env.CONFIRM_EMAIL || "Not set",
    baseUrl: process.env.BASE_URL || "Not set",
    emailFromName: process.env.EMAIL_FROM_NAME || "IAAI Training Platform",
    hasSendGrid: !!process.env.SENDGRID_API_KEY,
    hasSmtp: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER),
    environment: process.env.NODE_ENV || "development",
  };

  const emailFlow = [
    {
      trigger: "User Registration",
      from: emailConfig.adminEmail,
      to: emailConfig.confirmEmail,
      template: "Admin Notification",
      status:
        emailConfig.adminEmail !== "Not set" &&
        emailConfig.confirmEmail !== "Not set"
          ? "✅ Ready"
          : "❌ Missing Config",
    },
    {
      trigger: "Admin Confirmation",
      from: emailConfig.adminEmail,
      to: "User Email",
      template: "Welcome Email",
      status:
        emailConfig.adminEmail !== "Not set" ? "✅ Ready" : "❌ Missing Config",
    },
    {
      trigger: "Password Reset Request",
      from: emailConfig.adminEmail,
      to: "User Email",
      template: "Password Reset",
      status:
        emailConfig.adminEmail !== "Not set" ? "✅ Ready" : "❌ Missing Config",
    },
    {
      trigger: "Password Changed",
      from: emailConfig.adminEmail,
      to: "User Email",
      template: "Password Confirmation",
      status:
        emailConfig.adminEmail !== "Not set" ? "✅ Ready" : "❌ Missing Config",
    },
  ];

  res.json({
    status: "Email Configuration Status",
    timestamp: new Date().toISOString(),
    configuration: emailConfig,
    emailFlow: emailFlow,
    testEndpoints: {
      testEmail: `${emailConfig.baseUrl}/test-email`,
      testNotification: `${emailConfig.baseUrl}/test-notification?type=success&message=Test`,
    },
    notes: [
      "ADMIN_EMAIL is used as the sender for all emails",
      "CONFIRM_EMAIL receives admin notifications only",
      "All user emails are sent to the individual user's email address",
      "SendGrid takes priority over SMTP if both are configured",
    ],
  });
});

// ============================================
// HEALTH CHECK ROUTE
// ============================================
router.get("/signup/health", (req, res) => {
  const emailConfigHealth = {
    adminEmail: !!process.env.ADMIN_EMAIL,
    confirmEmail: !!process.env.CONFIRM_EMAIL,
    baseUrl: !!process.env.BASE_URL,
    sendGrid: !!process.env.SENDGRID_API_KEY,
    smtp: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER),
  };

  const overallHealth = Object.values(emailConfigHealth).every(Boolean);

  res.json({
    status: overallHealth ? "HEALTHY" : "PARTIAL",
    route: "signup",
    timestamp: new Date().toISOString(),
    message: "Signup routes with email notifications",
    emailConfiguration: emailConfigHealth,
    availableRoutes: [
      "GET /signup - Render signup form",
      "POST /signup - Handle signup (triggers admin email)",
      "GET /confirm-user/:email - Confirm user (triggers welcome email)",
      "GET /forgot-password - Render forgot password form",
      "POST /forgot-password - Send reset email",
      "GET /reset-password/:token - Render reset form",
      "POST /reset-password/:token - Reset password (triggers confirmation email)",
      "GET /test-email - Test email configuration",
      "GET /test-notification - Test flash messages",
      "GET /email-status - Check email configuration",
    ],
    emailFlow: [
      "Signup → Admin notification to CONFIRM_EMAIL",
      "Confirmation → Welcome email to user",
      "Password reset → Reset email to user",
      "Password changed → Confirmation email to user",
    ],
  });
});

module.exports = router;
