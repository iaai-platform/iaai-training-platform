// utils/sendEmail.js - FIXED Gmail SMTP (Corrected typo)
const nodemailer = require("nodemailer");

async function sendEmail(options) {
  try {
    console.log("📧 Attempting to send email via Gmail SMTP...");

    // Check if Gmail SMTP is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error(
        "Gmail SMTP not configured. Set EMAIL_USER and EMAIL_PASS environment variables."
      );
    }

    // Create Gmail SMTP transporter - FIXED: createTransport (not createTransporter)
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true" || false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // Your Gmail App Password
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    // Verify SMTP connection
    console.log("🔐 Verifying Gmail SMTP connection...");
    await transporter.verify();
    console.log("✅ Gmail SMTP connection verified successfully");

    // Extract sender info - handle both object and string formats
    let fromEmail, fromName;
    if (typeof options.from === "object" && options.from.address) {
      fromEmail = options.from.address;
      fromName = options.from.name;
    } else if (typeof options.from === "string") {
      fromEmail = options.from;
      fromName = process.env.EMAIL_FROM_NAME || "IAAI Training Platform";
    } else {
      fromEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
      fromName = process.env.EMAIL_FROM_NAME || "IAAI Training Platform";
    }

    // Ensure content exists
    const htmlContent = options.html || options.text || "";
    const textContent =
      options.text || options.html?.replace(/<[^>]*>/g, "") || "";

    if (!htmlContent && !textContent) {
      throw new Error(
        "Email content is empty - both HTML and text content are missing"
      );
    }

    // Prepare email options
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      text: textContent,
      html: htmlContent,
    };

    // Add BCC if provided (for bulk emails)
    if (options.bcc) {
      mailOptions.bcc = options.bcc;
    }

    console.log("📧 Sending email via Gmail SMTP:");
    console.log("📧 From:", fromEmail);
    console.log("📧 To:", options.to);
    console.log("📧 Subject:", options.subject);

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully via Gmail SMTP");
    console.log("📧 Message ID:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      service: "Gmail SMTP",
    };
  } catch (error) {
    console.error("❌ Gmail SMTP email sending failed:", error);

    // Handle specific Gmail SMTP errors
    if (error.code === "EAUTH") {
      console.error(
        "❌ Gmail Authentication failed. Check your EMAIL_USER and EMAIL_PASS (App Password)."
      );
      console.error(
        "💡 Make sure to use Gmail App Password, not regular password!"
      );
      console.error(
        "💡 Enable 2-Factor Authentication and generate App Password from Google Account settings."
      );
    } else if (error.code === "ECONNECTION") {
      console.error(
        "❌ Connection failed. Check your internet connection and Gmail SMTP settings."
      );
    } else if (error.code === "EMESSAGE") {
      console.error(
        "❌ Message error. Check email content and recipient addresses."
      );
    } else if (error.code === "EENVELOPE") {
      console.error(
        "❌ Envelope error. Check sender and recipient email addresses."
      );
    }

    // Enhanced error logging
    console.error("📧 Gmail Error Details:", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  }
}

module.exports = sendEmail;
