// adminVideoExamRoutes.js
const express = require('express');
const router = express.Router();
const adminVideoExamController = require('../controllers/adminVideoExamController');

// ✅ UPDATED: Import handleMulterError from uploadMiddleware
const { uploadVideos, convertVideo, handleMulterError } = require('../middlewares/uploadMiddleware');

const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin');

// ✅ 1️⃣ Route to Fetch Admin Page (Video Management Table)
router.get('/admin-course-videos',
  isAuthenticated,
  isAdmin,
  adminVideoExamController.getAdminPage
);

// ✅ 2️⃣ Upload New Video with Exam
router.post('/upload-video-exam',
  isAuthenticated,
  isAdmin,
  uploadVideos,  // Upload Video
  handleMulterError, // ✅ Handle upload errors
  convertVideo,  // Convert Video if Necessary
  adminVideoExamController.uploadVideoWithExam
);

// ✅ 3️⃣ Edit Video Details (Including File Replacement) - RESTful PUT
router.put('/edit-video/:courseId/:videoId',
  isAuthenticated,
  isAdmin,
  uploadVideos,  // Upload Video (Only if New Video Provided)
  handleMulterError, // ✅ Handle upload errors
  adminVideoExamController.uploadVideoWithExam
);

// ✅ 4️⃣ Legacy Edit Route (for backward compatibility)
router.post('/edit-video',
  isAuthenticated,
  isAdmin,
  uploadVideos,
  handleMulterError, // ✅ Handle upload errors
  adminVideoExamController.editVideo
);

// ✅ 5️⃣ Delete Video from Course - RESTful DELETE
router.delete('/delete-video/:courseId/:videoId',
  isAuthenticated,
  isAdmin,
  adminVideoExamController.deleteVideo
);

// ✅ 6️⃣ Legacy Delete Route (for backward compatibility)
router.post('/delete-video',
  isAuthenticated,
  isAdmin,
  adminVideoExamController.deleteVideo
);

// ✅ 7️⃣ Get Video Details (for AJAX requests)
router.get('/video-details/:courseId/:videoId',
  isAuthenticated,
  isAdmin,
  adminVideoExamController.getVideoDetails
);

module.exports = router;