// routes/certificationBodyRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import the controller
const certificationBodyController = require('../controllers/certificationBodyController');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/certification-bodies');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  next();
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin required.' });
  }
  next();
}

// ============================================
// WEB ROUTES (Views)
// ============================================

// Main certification bodies management page
router.get('/admin-certification-bodies', requireAuth, certificationBodyController.getCertificationBodiesPage);

// ============================================
// API ROUTES
// ============================================

// Get all certification bodies
router.get('/api/certification-bodies', requireAuth, requireAdmin, certificationBodyController.getAllCertificationBodies);

// Get active certification bodies (for dropdowns)
router.get('/api/certification-bodies/active', requireAuth, certificationBodyController.getActiveCertificationBodies);

// Search certification bodies
router.get('/api/certification-bodies/search', requireAuth, certificationBodyController.searchCertificationBodies);

// Create new certification body
router.post('/api/certification-bodies', requireAuth, requireAdmin, upload.single('logo'), certificationBodyController.createCertificationBody);

// Update certification body
router.put('/api/certification-bodies/:id', requireAuth, requireAdmin, upload.single('logo'), certificationBodyController.updateCertificationBody);

// Delete certification body (soft delete)
router.delete('/api/certification-bodies/:id', requireAuth, requireAdmin, certificationBodyController.deleteCertificationBody);

// Serve logo images
router.get('/logo/:id', certificationBodyController.serveLogo);

// ============================================
// STATIC FILE SERVING FOR LOGOS
// ============================================

// Serve uploaded logos
router.use('/uploads/certification-bodies', express.static(uploadsDir));

module.exports = router;