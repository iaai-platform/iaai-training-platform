const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt'); // Required for hashing passwords
const User = require('../models/user');
require('dotenv').config(); // Load environment variables

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render('forgot-password', {
        successMessage: null,
        errorMessage: 'No account found with that email address.'
      });
    }
    console.log("Email User:", process.env.EMAIL_USER);  // Debugging the EMAIL_USER
    console.log("Email Pass:", process.env.EMAIL_PASS);  // Debugging the EMAIL_PASS
    
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour validity
    await user.save({ validate: false }); // Skip validation for other fields

    // Configure the email transporter using environment variables for credentials
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,  // Use environment variable for email
        pass: process.env.EMAIL_PASS,  // Use environment variable for password
      },

    });

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    const mailOptions = {
      to: email,
      subject: 'Password Reset Request',
      text: `Click on the link to reset your password: ${resetLink}`,
    };

    await transporter.sendMail(mailOptions);

    res.render('forgot-password', {
      successMessage: 'Check your email for a password reset link.',
      errorMessage: null
    });

  } catch (err) {
    console.error('Error in forgotPassword:', err);
    res.render('forgot-password', {
      successMessage: null,
      errorMessage: 'Something went wrong. Please try again.'
    });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Token must be valid (not expired)
    });

    if (!user) {
      return res.render('reset-password', { errorMessage: 'Password reset token is invalid or expired.' });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.render('reset-password', { errorMessage: 'Passwords do not match.' });
    }

    // Check password strength (optional)
    if (newPassword.length < 8) {
      return res.render('reset-password', { errorMessage: 'Password must be at least 8 characters long.' });
    }

    // Hash the new password before saving it
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.redirect('/login'); // Redirect to login after password reset

  } catch (err) {
    console.error('Error during resetPassword:', err);
    res.render('reset-password', { errorMessage: 'Something went wrong. Please try again.' });
  }
};