// utils/sendEmail.js
const nodemailer = require("nodemailer");

async function sendEmail(options) {
  try {
    // Create transporter - NOTE: It's createTransport NOT createTransporter
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Verify connection configuration
    await transporter.verify();
    console.log("✅ Email server connection verified");

    // Email options
    const mailOptions = {
      from: `"IAAI Training Institute" <${process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || "",
      html: options.html || options.text || "",
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error("❌ Email sending failed:", error);

    if (error.code === "EAUTH") {
      console.error("Authentication failed. Check your email credentials.");
      console.error("For Gmail, you need to:");
      console.error("1. Enable 2-factor authentication");
      console.error(
        "2. Generate an app password at https://myaccount.google.com/apppasswords"
      );
      console.error(
        "3. Use the app password in your .env file, not your regular password"
      );
    } else if (error.code === "ECONNECTION") {
      console.error(
        "Connection failed. Check your internet/firewall settings."
      );
    }

    throw error;
  }
}

module.exports = sendEmail;
