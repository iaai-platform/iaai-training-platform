//homepageUpdateRoutes.js
const express = require('express');
const router = express.Router();
const homepageUpdateController = require('../controllers/homepageUpdateController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin');
const { uploadImages } = require('../middlewares/uploadMiddleware'); // Import image upload middleware

// Fetch Homepage Content for User View
router.get('/', homepageUpdateController.getHomepageContent);

// Admin Panel to Manage Homepage Content
router.get('/admin-homepage', isAuthenticated, isAdmin, homepageUpdateController.getHomepageRecords);

// Fetch Specific Homepage Content for Editing
router.get('/get-homepage-content/:id', isAuthenticated, isAdmin, homepageUpdateController.getHomepageById);

// Update / Add Homepage Content with Images
router.post('/update-homepage', isAuthenticated, isAdmin, uploadImages, homepageUpdateController.updateHomepageContent);

// Delete Homepage Content
router.delete('/delete-homepage/:id', isAuthenticated, isAdmin, homepageUpdateController.deleteHomepageContent);

module.exports = router;