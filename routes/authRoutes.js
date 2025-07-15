// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Show Forgot Password Page (with successMessage and errorMessage passed)
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', {
    successMessage: null, // Initially null
    errorMessage: null    // Initially null
  });
});

// Handle Forgot Password Form Submission (send reset link)
router.post('/forgot-password', async (req, res) => {
  try {
    await authController.forgotPassword(req, res);  // Call the controller's forgotPassword function
  } catch (error) {
    res.status(500).json({ success: false, errorMessage: 'An unexpected error occurred. Please try again later.' });
  }
});

// Handle Reset Password Form Submission
router.post('/reset-password', authController.resetPassword);

module.exports = router;