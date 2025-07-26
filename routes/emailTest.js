// routes/emailTest.js - FIXED VERSION
const express = require("express");
const router = express.Router();

// ============================================
// EMAIL TEST ROUTE - FIXED FOR NODE.JS
// ============================================
router.get("/test-email", async (req, res) => {
  console.log("🧪 Testing email configuration...");

  // Log current environment variables (without sensitive data)
  console.log("📧 Email Config Check:", {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "✅ Set" : "❌ Not Set",
    EMAIL_FROM: process.env.EMAIL_FROM ? "✅ Set" : "❌ Not Set",
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ? "✅ Set" : "❌ Not Set",
    CONFIRM_EMAIL: process.env.CONFIRM_EMAIL ? "✅ Set" : "❌ Not Set",
  });

  try {
    // Check if we're using SendGrid or SMTP
    if (process.env.SENDGRID_API_KEY) {
      console.log("🔍 Testing SendGrid connection...");

      // Test SendGrid
      const sgMail = require("@sendgrid/mail");
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const testEmail = {
        to: process.env.CONFIRM_EMAIL || process.env.EMAIL_FROM,
        from: {
          email: process.env.EMAIL_FROM || "info@iaa-i.com",
          name: process.env.EMAIL_FROM_NAME || "IAAI Training Test",
        },
        subject: "🧪 SendGrid Test - " + new Date().toLocaleString(),
        html: `
          <h2>✅ SendGrid Test Successful!</h2>
          <p>If you receive this email, your SendGrid configuration is working perfectly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${process.env.EMAIL_FROM}</p>
          <p><strong>Service:</strong> SendGrid</p>
          <p><strong>API Key:</strong> Configured ✅</p>
        `,
      };

      console.log("📧 Sending test email via SendGrid...");
      const result = await sgMail.send(testEmail);

      console.log("✅ Test email sent successfully via SendGrid");

      res.json({
        success: true,
        message: "SendGrid email test successful!",
        messageId: result[0].headers["x-message-id"] || "sendgrid-success",
        service: "SendGrid",
        timestamp: new Date().toISOString(),
      });
    } else {
      // Fallback to SMTP testing (your original code)
      console.log("🔍 Testing SMTP connection...");

      const nodemailer = require("nodemailer");

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "mail.iaa-i.com",
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });

      await transporter.verify();
      console.log("✅ SMTP connection verified successfully!");

      const testEmail = {
        from: {
          name: process.env.EMAIL_FROM_NAME || "IAAI Training Test",
          address: process.env.EMAIL_USER,
        },
        to: process.env.CONFIRM_EMAIL || process.env.EMAIL_USER,
        subject: "🧪 SMTP Test - " + new Date().toLocaleString(),
        html: `
          <h2>✅ SMTP Test Successful!</h2>
          <p>If you receive this email, your SMTP configuration is working.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
          <p><strong>Host:</strong> ${process.env.EMAIL_HOST}</p>
          <p><strong>Port:</strong> ${process.env.EMAIL_PORT}</p>
        `,
      };

      const info = await transporter.sendMail(testEmail);

      console.log("✅ Test email sent successfully:", info.messageId);

      res.json({
        success: true,
        message: "SMTP email test successful!",
        messageId: info.messageId,
        service: "SMTP",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("❌ Email test failed:", error);

    // Handle SendGrid specific errors
    let errorDetails = error.message;
    if (error.response && error.response.body) {
      errorDetails = error.response.body.errors?.[0]?.message || error.message;
    }

    res.status(500).json({
      success: false,
      error: errorDetails,
      code: error.code,
      service: process.env.SENDGRID_API_KEY ? "SendGrid" : "SMTP",
      timestamp: new Date().toISOString(),
      troubleshooting: {
        SENDGRID_API_KEY_MISSING:
          "Add SENDGRID_API_KEY to environment variables",
        DOMAIN_NOT_VERIFIED: "Verify your domain in SendGrid dashboard",
        INVALID_FROM_EMAIL: "Check EMAIL_FROM address is verified in SendGrid",
        ETIMEDOUT: "Connection timeout - use SendGrid instead of SMTP",
        EAUTH: "Authentication failed - check credentials",
      },
    });
  }
});

module.exports = router;
