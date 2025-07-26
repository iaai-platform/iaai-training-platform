//routes/emailTest.js

// routes/emailTest.js

const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// ============================================
// EMAIL TEST ROUTE - ADD THIS TO DEBUG
// ============================================
router.get("/test-email", async (req, res) => {
  console.log("🧪 Testing email configuration...");

  // Log current environment variables (without sensitive data)
  console.log("📧 Email Config Check:", {
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_PORT: process.env.EMAIL_PORT,
    EMAIL_USER: process.env.EMAIL_USER ? "✅ Set" : "❌ Not Set",
    EMAIL_PASS: process.env.EMAIL_PASS ? "✅ Set" : "❌ Not Set",
    EMAIL_SECURE: process.env.EMAIL_SECURE,
    CONFIRM_EMAIL: process.env.CONFIRM_EMAIL ? "✅ Set" : "❌ Not Set",
  });

  try {
    // Create transporter with detailed logging
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000, // 5 seconds
      socketTimeout: 10000, // 10 seconds
      debug: true, // Enable debug logging
      logger: true, // Enable logging
    });

    console.log("🔍 Testing connection...");

    // Test connection first
    await transporter.verify();
    console.log("✅ SMTP connection verified successfully!");

    // Send test email
    const testEmail = {
      from: {
        name: process.env.EMAIL_FROM_NAME || "IAAI Training Test",
        address: process.env.EMAIL_USER,
      },
      to: process.env.CONFIRM_EMAIL || process.env.EMAIL_USER,
      subject: "🧪 Email Test - " + new Date().toLocaleString(),
      html: `
        <h2>✅ Email Test Successful!</h2>
        <p>If you receive this email, your configuration is working.</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
        <p><strong>Host:</strong> ${process.env.EMAIL_HOST}</p>
        <p><strong>Port:</strong> ${process.env.EMAIL_PORT}</p>
      `,
    };

    console.log("📧 Sending test email...");
    const info = await transporter.sendMail(testEmail);

    console.log("✅ Test email sent successfully:", info.messageId);

    res.json({
      success: true,
      message: "Email test successful!",
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Email test failed:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      troubleshooting: {
        ETIMEDOUT: "Connection timeout - check firewall/network",
        EAUTH: "Authentication failed - check credentials",
        ECONNREFUSED: "Connection refused - check host/port",
        ESOCKET: "Socket error - check network connectivity",
      },
    });
  }
});

module.exports = router;
