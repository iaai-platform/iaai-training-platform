// routes/signupRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Render signup page
router.get('/signup', (req, res) => {
  console.log('📄 Rendering signup page...');
  
  // ✅ FIXED: Get flash messages WITHOUT consuming them first in debug
  const error_message = req.flash('error_message')[0] || null;
  const success_message = req.flash('success_message')[0] || null;
  const formDataStr = req.flash('formData')[0] || null;
  
  // Parse form data if available
  let formData = null;
  if (formDataStr) {
    try {
      formData = JSON.parse(formDataStr);
      // Don't preserve password for security
      if (formData.password) delete formData.password;
    } catch (e) {
      console.log('Error parsing form data:', e);
    }
  }
  
  console.log('📨 Messages to send to template:', {
    error_message: error_message,
    success_message: success_message,
    has_formData: !!formData
  });
  
  res.render('signup', {
    error_message: error_message,
    success_message: success_message,
    user: req.user || null,
    formData: formData
  });
});

// Handle POST request for signup
router.post('/signup', userController.registerUser);

// Route to confirm user account (for admin use)
router.get('/confirm-user/:email', userController.confirmUser);

module.exports = router;