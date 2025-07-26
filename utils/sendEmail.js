// 1. UPDATE utils/sendEmail.js - Replace entire file with this:

const sgMail = require("@sendgrid/mail");

async function sendEmail(options) {
  try {
    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: options.to,
      from: {
        email: process.env.EMAIL_FROM || "info@iaa-i.com",
        name: process.env.EMAIL_FROM_NAME || "IAAI Training Platform",
      },
      subject: options.subject,
      html: options.html || options.text || "",
      text: options.text || "",
    };

    console.log("📧 Sending email via SendGrid to:", options.to);
    console.log("📧 From:", msg.from.email);
    console.log("📧 Subject:", options.subject);

    const result = await sgMail.send(msg);

    console.log("✅ Email sent successfully via SendGrid");
    console.log("📧 Message ID:", result[0].headers["x-message-id"]);

    return {
      success: true,
      messageId: result[0].headers["x-message-id"] || "sendgrid-success",
      response: "Email sent via SendGrid",
    };
  } catch (error) {
    console.error("❌ SendGrid error:", error);

    // Handle SendGrid specific errors
    if (error.response) {
      console.error("❌ SendGrid response:", error.response.body);
    }

    throw error;
  }
}

module.exports = sendEmail;

// 2. UPDATE userController.js - Replace createEmailTransporter function:

function createEmailTransporter() {
  // Return a mock transporter object that works with SendGrid
  return {
    // Mock verify method for compatibility
    verify: async () => {
      if (!process.env.SENDGRID_API_KEY) {
        throw new Error("SENDGRID_API_KEY not configured");
      }
      console.log("✅ SendGrid API key is configured");
      return true;
    },

    // Mock sendMail method that uses SendGrid
    sendMail: async (options) => {
      const sendEmail = require("../utils/sendEmail");
      return await sendEmail(options);
    },
  };
}

// 3. UPDATE routes/emailTest.js - Replace the transporter creation:

// In your emailTest.js, replace the transporter creation part with:

try {
  console.log("🔍 Testing SendGrid connection...");

  // Test SendGrid configuration
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY not configured");
  }

  console.log("✅ SendGrid API key found");

  // Use the sendEmail utility directly
  const sendEmail = require("../utils/sendEmail");

  const testEmail = {
    to: process.env.CONFIRM_EMAIL || process.env.EMAIL_FROM,
    subject: "🧪 SendGrid Test - " + new Date().toLocaleString(),
    html: `
      <h2>✅ SendGrid Test Successful!</h2>
      <p>If you receive this email, your SendGrid configuration is working perfectly.</p>
      <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>From:</strong> ${process.env.EMAIL_FROM}</p>
      <p><strong>API Key:</strong> Configured ✅</p>
      <p><strong>Service:</strong> SendGrid</p>
    `,
  };

  console.log("📧 Sending test email via SendGrid...");
  const result = await sendEmail(testEmail);

  console.log("✅ Test email sent successfully:", result.messageId);

  res.json({
    success: true,
    message: "SendGrid email test successful!",
    messageId: result.messageId,
    service: "SendGrid",
    timestamp: new Date().toISOString(),
  });
} catch (error) {
  console.error("❌ SendGrid test failed:", error);

  res.status(500).json({
    success: false,
    error: error.message,
    service: "SendGrid",
    timestamp: new Date().toISOString(),
    troubleshooting: {
      API_KEY_MISSING: "Add SENDGRID_API_KEY to environment variables",
      DOMAIN_NOT_VERIFIED: "Verify your domain in SendGrid dashboard",
      RATE_LIMIT: "Check SendGrid usage limits",
      INVALID_FROM: "Verify EMAIL_FROM address in SendGrid",
    },
  });
}
