// utils/sendEmail.js - FIXED FOR SENDGRID FORMAT
const sgMail = require("@sendgrid/mail");

async function sendEmail(options) {
  try {
    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      console.error(
        "❌ SENDGRID_API_KEY not configured, falling back to nodemailer"
      );

      // Fallback to nodemailer if SendGrid not configured
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

      // Verify connection
      await transporter.verify();
      console.log("✅ SMTP connection verified");

      // Send email via SMTP
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || "IAAI Training"}" <${
          process.env.EMAIL_USER
        }>`,
        to: options.to,
        subject: options.subject,
        text: options.text || "",
        html: options.html || options.text || "",
      };

      const info = await transporter.sendMail(mailOptions);

      console.log("✅ Email sent via SMTP:", info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    }

    // Use SendGrid - FIXED FORMAT
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Extract sender info - handle both object and string formats
    let fromEmail, fromName;
    if (typeof options.from === "object" && options.from.address) {
      fromEmail = options.from.address;
      fromName = options.from.name;
    } else if (typeof options.from === "string") {
      fromEmail = options.from;
      fromName = process.env.EMAIL_FROM_NAME || "IAAI Training Platform";
    } else {
      fromEmail = process.env.EMAIL_FROM || "info@iaa-i.com";
      fromName = process.env.EMAIL_FROM_NAME || "IAAI Training Platform";
    }

    // Ensure content exists and is properly formatted
    const htmlContent = options.html || options.text || "";
    const textContent =
      options.text || options.html?.replace(/<[^>]*>/g, "") || "";

    if (!htmlContent && !textContent) {
      throw new Error(
        "Email content is empty - both HTML and text content are missing"
      );
    }

    const msg = {
      to: options.to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: options.subject,
      content: [
        {
          type: "text/html",
          value: htmlContent,
        },
      ],
    };

    // Add text content if available
    if (textContent && textContent !== htmlContent) {
      msg.content.unshift({
        type: "text/plain",
        value: textContent,
      });
    }

    console.log("📧 Sending email via SendGrid to:", options.to);
    console.log("📧 From:", fromEmail);
    console.log("📧 Subject:", options.subject);
    console.log(
      "📧 Content types:",
      msg.content.map((c) => c.type)
    );

    const result = await sgMail.send(msg);

    console.log("✅ Email sent successfully via SendGrid");
    console.log("📧 Message ID:", result[0].headers["x-message-id"]);

    return {
      success: true,
      messageId: result[0].headers["x-message-id"] || "sendgrid-success",
      response: "Email sent via SendGrid",
    };
  } catch (error) {
    console.error("❌ Email sending failed:", error);

    // Handle SendGrid specific errors
    if (error.response && error.response.body) {
      console.error("❌ SendGrid response:", error.response.body);

      // Log specific SendGrid error details
      if (error.response.body.errors) {
        error.response.body.errors.forEach((err) => {
          console.error(
            `❌ SendGrid Error: ${err.message} (Field: ${err.field})`
          );
        });
      }
    }

    // Handle SMTP specific errors
    if (error.code === "EAUTH") {
      console.error("Authentication failed. Check your email credentials.");
    } else if (error.code === "ECONNECTION") {
      console.error(
        "Connection failed. Check your internet/firewall settings."
      );
    }

    throw error;
  }
}

module.exports = sendEmail;
