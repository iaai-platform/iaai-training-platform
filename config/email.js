const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransporter({
  host: "mail.iaa-i.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // support@iaa-i.com
    pass: process.env.EMAIL_PASS, // your email password
  },
});

module.exports = transporter;
