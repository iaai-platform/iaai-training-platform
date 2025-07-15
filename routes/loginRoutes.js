const express = require('express');
const router = express.Router();
const loginController = require('../controllers/loginController'); // Import the login controller

// Route to render the login page
router.get('/login', loginController.renderLoginPage);

// Route to handle login form submission
router.post('/login', loginController.handleLogin);

module.exports = router;