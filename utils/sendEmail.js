// utils/sendEmail.js - COMPLETE MICROSOFT 365 + GMAIL SUPPORT
const nodemailer = require("nodemailer");

/**
 * Enhanced email sender with Microsoft 365 and Gmail support
 * Automatically detects email provider and uses appropriate SMTP settings
 */
async function sendEmail(options) {
  try {
    console.log("📧 Preparing to send email...");

    // Validate required environment variables
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error(
        "Email not configured. Set EMAIL_USER and EMAIL_PASS environment variables."
      );
    }

    // Get SMTP configuration based on email provider
    const smtpConfig = getSmtpConfiguration();
    console.log(`📫 Using SMTP: ${smtpConfig.host}:${smtpConfig.port}`);

    // Create transporter with detected configuration
    const transporter = nodemailer.createTransport(smtpConfig);

    // Verify SMTP connection
    try {
      console.log("🔐 Verifying SMTP connection...");
      await transporter.verify();
      console.log("✅ SMTP connection verified successfully");
    } catch (verifyError) {
      console.warn(
        "⚠️ SMTP verification warning (continuing anyway):",
        verifyError.message
      );
      // Continue anyway as some servers don't support verify()
    }

    // Prepare email options
    const mailOptions = prepareEmailOptions(options);

    console.log("📧 Sending email:");
    console.log("📧 From:", mailOptions.from);
    console.log("📧 To:", options.to);
    console.log("📧 Subject:", options.subject);
    console.log("📧 Provider:", detectEmailProvider());

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully");
    console.log("📧 Message ID:", info.messageId);

    if (info.accepted && info.accepted.length > 0) {
      console.log("✅ Accepted recipients:", info.accepted.join(", "));
    }

    if (info.rejected && info.rejected.length > 0) {
      console.warn("⚠️ Rejected recipients:", info.rejected.join(", "));
    }

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      service: detectEmailProvider(),
      accepted: info.accepted || [],
      rejected: info.rejected || [],
    };
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);

    // Enhanced error handling
    const errorInfo = handleEmailError(error);
    console.error("📧 Error Details:", errorInfo);

    return {
      success: false,
      error: error.message,
      code: error.code,
      suggestions: errorInfo.suggestions,
      provider: detectEmailProvider(),
    };
  }
}

/**
 * Detect email provider based on environment and email address
 */
function detectEmailProvider() {
  const emailUser = process.env.EMAIL_USER;
  const smtpHost = process.env.SMTP_HOST;

  // If custom SMTP host is set, use it
  if (smtpHost) {
    if (smtpHost.includes("outlook") || smtpHost.includes("office365")) {
      return "Microsoft 365/Outlook";
    } else if (smtpHost.includes("gmail")) {
      return "Gmail";
    } else {
      return `Custom SMTP (${smtpHost})`;
    }
  }

  // Auto-detect based on email domain
  if (emailUser) {
    const domain = emailUser.split("@")[1]?.toLowerCase();

    // Microsoft domains
    if (
      ["outlook.com", "hotmail.com", "live.com"].includes(domain) ||
      domain?.includes("onmicrosoft.com") ||
      domain?.includes("iaai-institute.com") ||
      process.env.FORCE_MICROSOFT === "true"
    ) {
      return "Microsoft 365/Outlook";
    }

    // Gmail domains
    if (["gmail.com", "googlemail.com"].includes(domain)) {
      return "Gmail";
    }
  }

  // Default to Microsoft for business emails
  return "Microsoft 365 (Auto-detected)";
}

/**
 * Get SMTP configuration based on email provider
 */
function getSmtpConfiguration() {
  const emailUser = process.env.EMAIL_USER;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT) || 587;
  const smtpSecure = process.env.SMTP_SECURE === "true";

  // If custom SMTP settings are provided, use them
  if (smtpHost) {
    console.log(`🔧 Using custom SMTP configuration: ${smtpHost}`);
    return {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };
  }

  // Auto-detect based on email domain
  const domain = emailUser ? emailUser.split("@")[1]?.toLowerCase() : "";

  // Microsoft 365/Outlook configuration
  if (
    ["outlook.com", "hotmail.com", "live.com"].includes(domain) ||
    domain?.includes("onmicrosoft.com") ||
    domain?.includes("iaai-institute.com") ||
    process.env.FORCE_MICROSOFT === "true"
  ) {
    console.log(`🏢 Using Microsoft 365/Outlook configuration for: ${domain}`);
    return {
      host: "smtp.office365.com",
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };
  }

  // Gmail configuration
  if (["gmail.com", "googlemail.com"].includes(domain)) {
    console.log(`📧 Using Gmail configuration for: ${domain}`);
    return {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };
  }

  // Default to Microsoft 365 for business emails
  console.log(`🏢 Using default Microsoft 365 configuration`);
  return {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      ciphers: "SSLv3",
      rejectUnauthorized: false,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  };
}

/**
 * Prepare email options with proper defaults
 */
function prepareEmailOptions(options) {
  // Extract sender info - handle both object and string formats
  let fromEmail, fromName;

  if (typeof options.from === "object" && options.from.address) {
    fromEmail = options.from.address;
    fromName = options.from.name;
  } else if (typeof options.from === "string") {
    fromEmail = options.from;
    fromName = process.env.COMPANY_NAME || "IAAI Training Institute";
  } else {
    fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    fromName = process.env.COMPANY_NAME || "IAAI Training Institute";
  }

  // Ensure content exists
  const htmlContent = options.html || options.text || "";
  const textContent =
    options.text || (options.html ? options.html.replace(/<[^>]*>/g, "") : "");

  if (!htmlContent && !textContent) {
    throw new Error(
      "Email content is empty - both HTML and text content are missing"
    );
  }

  // Prepare mail options
  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    text: textContent,
    html: htmlContent,
    headers: {
      "X-Mailer": "IAAI Training Institute Email System",
      "X-Priority": "3",
      ...options.headers,
    },
    encoding: "utf-8",
  };

  // Add optional fields
  if (options.cc) mailOptions.cc = options.cc;
  if (options.bcc) mailOptions.bcc = options.bcc;
  if (options.attachments) mailOptions.attachments = options.attachments;
  if (options.replyTo) mailOptions.replyTo = options.replyTo;

  return mailOptions;
}

/**
 * Handle email errors with provider-specific suggestions
 */
function handleEmailError(error) {
  const provider = detectEmailProvider();
  let suggestions = [];

  if (error.code === "EAUTH") {
    console.error("❌ Authentication failed");
    if (provider.includes("Microsoft")) {
      suggestions = [
        "Ensure you're using a Microsoft App Password (not regular password)",
        "Verify 2FA is enabled on your Microsoft account",
        "Check if SMTP authentication is enabled in Office 365 admin",
        "Try alternative SMTP server: smtp-mail.outlook.com",
      ];
    } else if (provider.includes("Gmail")) {
      suggestions = [
        "Use Gmail App Password instead of regular password",
        "Enable 2-Step Verification on your Google account",
        "Check 'Less secure app access' settings",
      ];
    } else {
      suggestions = [
        "Verify email credentials are correct",
        "Check SMTP server settings",
      ];
    }
  } else if (error.code === "ECONNECTION") {
    console.error("❌ Connection failed");
    suggestions = [
      "Check internet connectivity",
      "Verify SMTP server and port settings",
      "Check firewall restrictions",
      "Try alternative SMTP server",
    ];
  } else if (error.code === "EMESSAGE") {
    console.error("❌ Message error");
    suggestions = [
      "Check email content for invalid characters",
      "Verify sender and recipient email addresses",
      "Ensure message size is within limits",
    ];
  } else if (error.code === "EENVELOPE") {
    console.error("❌ Envelope error");
    suggestions = [
      "Check sender email address format",
      "Verify recipient email addresses",
      "Ensure EMAIL_FROM is properly configured",
    ];
  }

  return {
    code: error.code,
    command: error.command,
    response: error.response,
    responseCode: error.responseCode,
    message: error.message,
    provider: provider,
    suggestions: suggestions,
  };
}

/**
 * Test email configuration for current provider
 */
async function testEmailConfiguration() {
  const provider = detectEmailProvider();
  const testRecipient =
    process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER;

  console.log(`🧪 Testing ${provider} email configuration...`);

  try {
    const testEmail = {
      to: testRecipient,
      subject: `IAAI Email Test - ${provider} Integration`,
      html: generateTestEmailHTML(provider),
      text: generateTestEmailText(provider),
    };

    const result = await sendEmail(testEmail);

    if (result.success) {
      return {
        success: true,
        message: `${provider} email test successful!`,
        provider: provider,
        details: {
          messageId: result.messageId,
          testRecipient: testRecipient,
          timestamp: new Date().toISOString(),
        },
      };
    } else {
      return {
        success: false,
        error: result.error,
        provider: provider,
        suggestions: result.suggestions,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `${provider} email test failed: ${error.message}`,
      provider: provider,
    };
  }
}

/**
 * Generate test email HTML content
 */
function generateTestEmailHTML(provider) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0;">✅ Email Test Successful!</h1>
        <p style="margin: 10px 0 0 0;">${provider} Integration Working</p>
      </div>
      <div style="padding: 30px; background: #f8f9fa;">
        <h2 style="color: #333;">Configuration Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold;">Provider:</td><td>${provider}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Sender:</td><td>${
            process.env.EMAIL_USER
          }</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">SMTP Server:</td><td>${
            process.env.SMTP_HOST || "Auto-detected"
          }</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Test Time:</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <div style="background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #2e7d32;"><strong>Success!</strong> Your IAAI email system is ready.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate test email text content
 */
function generateTestEmailText(provider) {
  return `
IAAI EMAIL TEST - ${provider.toUpperCase()}

✅ EMAIL SYSTEM WORKING!

Configuration Details:
- Provider: ${provider}
- Sender: ${process.env.EMAIL_USER}
- SMTP Server: ${process.env.SMTP_HOST || "Auto-detected"}
- Test Time: ${new Date().toLocaleString()}

Your IAAI email system is ready for course reminders!

IAAI Training Institute
International Aesthetic Academic Institution
  `;
}

// Export functions
module.exports = sendEmail;
module.exports.testEmailConfiguration = testEmailConfiguration;
module.exports.detectEmailProvider = detectEmailProvider;
