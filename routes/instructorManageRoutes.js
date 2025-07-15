// routes/instructorManageRoutes.js
const express = require('express');
const router = express.Router();
const instructorController = require('../controllers/instructorController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// FILE UPLOAD CONFIGURATION FOR INSTRUCTOR PHOTOS
// ============================================

// Ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
};

// Create directory for instructor photos
ensureDirectoryExists('uploads/instructors/photos/');

// Storage configuration for instructor photos
const instructorPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/instructors/photos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `instructor-${uniqueSuffix}${ext}`);
  }
});

// File filter for images
const instructorPhotoFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

// Multer instance for instructor photos
const uploadInstructorPhoto = multer({
  storage: instructorPhotoStorage,
  fileFilter: instructorPhotoFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('profileImage');

// ============================================
// MIDDLEWARE FOR LOGGING
// ============================================

// Request logging middleware (optional)
const logRequest = (action) => {
  return (req, res, next) => {
    console.log(`📝 [${new Date().toISOString()}] ${action} - User: ${req.user?.email || 'Unknown'}`);
    next();
  };
};

// ============================================
// INSTRUCTOR MANAGEMENT PAGE ROUTES
// ============================================

// Main instructor management page
router.get('/manage', 
  isAuthenticated, 
  isAdmin, 
  logRequest('View Instructor Management Page'),
  instructorController.manageInstructors
);

// Alternative routes for backward compatibility
router.get('/', 
  isAuthenticated, 
  isAdmin, 
  instructorController.manageInstructors
);

// ============================================
// INSTRUCTOR API ROUTES - BASIC CRUD
// ============================================

// Get all instructors
router.get('/api/all', 
  isAuthenticated, 
  isAdmin, 
  instructorController.getInstructors
);

// Get active instructors for dropdowns
router.get('/api/active', 
  isAuthenticated, 
  isAdmin, 
  instructorController.getActiveInstructors
);

// Search instructors by name or email
router.get('/api/search/:query', 
  isAuthenticated, 
  isAdmin, 
  instructorController.searchInstructors
);

// Get instructor details by ID (with course details)
router.get('/api/:instructorId', 
  isAuthenticated, 
  isAdmin, 
  instructorController.getInstructorById
);

// Create new instructor with photo upload
router.post('/api', 
  isAuthenticated, 
  isAdmin,
  logRequest('Create New Instructor'),
  (req, res, next) => {
    uploadInstructorPhoto(req, res, (err) => {
      if (err) {
        console.error('📁 Photo upload error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 5MB.'
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              message: 'Unexpected field. Please ensure the field name is "profileImage".'
            });
          }
          return res.status(400).json({
            success: false,
            message: 'File upload error: ' + err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  }, 
  instructorController.createInstructor
);

// Update instructor with photo upload
router.put('/api/:instructorId', 
  isAuthenticated, 
  isAdmin,
  logRequest('Update Instructor'),
  (req, res, next) => {
    uploadInstructorPhoto(req, res, (err) => {
      if (err) {
        console.error('📁 Photo upload error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: 'File too large. Maximum size is 5MB.'
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              message: 'Unexpected field. Please ensure the field name is "profileImage".'
            });
          }
          return res.status(400).json({
            success: false,
            message: 'File upload error: ' + err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  }, 
  instructorController.updateInstructor
);

// Delete instructor (soft delete)
router.delete('/api/:instructorId', 
  isAuthenticated, 
  isAdmin,
  logRequest('Delete Instructor'),
  instructorController.deleteInstructor
);

// Bulk import instructors
router.post('/api/bulk-import', 
  isAuthenticated, 
  isAdmin,
  logRequest('Bulk Import Instructors'),
  instructorController.bulkImportInstructors
);

// ============================================
// COURSE MANAGEMENT ROUTES
// ============================================

// Sync courses for a specific instructor
router.post('/api/:instructorId/sync-courses', 
  isAuthenticated, 
  isAdmin,
  logRequest('Sync Instructor Courses'),
  instructorController.syncInstructorCourses
);

// Sync courses for all instructors
router.post('/api/sync-all-courses', 
  isAuthenticated, 
  isAdmin,
  logRequest('Sync All Instructors Courses'),
  instructorController.syncAllInstructorsCourses
);

// Get instructor's courses (with optional filters)
router.get('/api/:instructorId/courses', 
  isAuthenticated, 
  isAdmin,
  instructorController.getInstructorCourses
);

// Manually assign course to instructor
router.post('/api/:instructorId/assign-course', 
  isAuthenticated, 
  isAdmin,
  logRequest('Assign Course to Instructor'),
  instructorController.assignCourse
);

// Update course status for instructor
router.put('/api/:instructorId/course/:courseId/status', 
  isAuthenticated, 
  isAdmin,
  logRequest('Update Course Status'),
  instructorController.updateCourseStatus
);

// Remove course assignment
router.delete('/api/:instructorId/course/:courseId', 
  isAuthenticated, 
  isAdmin,
  logRequest('Remove Course Assignment'),
  instructorController.removeCourseAssignment
);

// ============================================
// AVAILABILITY & SCHEDULING ROUTES
// ============================================

// Check instructor availability for date range
router.get('/api/:instructorId/availability', 
  isAuthenticated, 
  isAdmin,
  instructorController.checkAvailability
);

// Get instructor schedule (with optional month/year filter)
router.get('/api/:instructorId/schedule', 
  isAuthenticated, 
  isAdmin,
  instructorController.getInstructorSchedule
);

// ============================================
// RATING & FEEDBACK ROUTES
// ============================================

// Add rating to instructor
router.post('/api/:instructorId/rating', 
  isAuthenticated, 
  isAdmin,
  logRequest('Add Instructor Rating'),
  instructorController.addRating
);

// Get instructor ratings
router.get('/api/:instructorId/ratings', 
  isAuthenticated, 
  isAdmin,
  instructorController.getInstructorRatings
);

// ============================================
// STATISTICS & REPORTS ROUTES
// ============================================

// Get instructor statistics
router.get('/api/:instructorId/stats', 
  isAuthenticated, 
  isAdmin,
  instructorController.getInstructorStats
);

// ============================================
// STATIC FILE ROUTES
// ============================================

// Serve instructor photos - Public route for displaying images
router.get('/photo/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'uploads', 'instructors', 'photos', filename);
  
  // Security check - prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid filename'
    });
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log('❌ Photo not found:', filename);
    // Return default avatar or 404
    return res.status(404).json({
      success: false,
      message: 'Photo not found'
    });
  }
  
  // Get file extension for content type
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  
  const contentType = contentTypes[ext] || 'application/octet-stream';
  
  // Set proper headers
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  
  // Send file
  res.sendFile(filePath);
});

// ============================================
// EXPORT ROUTES
// ============================================

module.exports = router;