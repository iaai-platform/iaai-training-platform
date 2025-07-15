const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// ✅ 1️⃣ Display User Profile
router.get('/profile', isAuthenticated, profileController.getProfilePage);

// ✅ 2️⃣ Update User Information (Except Email)
router.post('/update-profile', isAuthenticated, profileController.updateProfile);

// ✅ 3️⃣ Update User Password
router.post('/update-password', isAuthenticated, profileController.updatePassword);

module.exports = router;