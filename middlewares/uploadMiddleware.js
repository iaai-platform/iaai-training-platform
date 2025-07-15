const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
};

// Create upload directories
ensureDirectoryExists('public/uploads/');
ensureDirectoryExists('uploads/videos/');

// Image Upload Storage
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/'); // Save images in `public/uploads/`
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, filename);
  }
});

// Video Upload Storage
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/videos/'); // Save videos in `uploads/videos/`
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `video-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, filename);
  }
});

// File filter for videos
const videoFileFilter = (req, file, cb) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

// File filter for images
const imageFileFilter = (req, file, cb) => {
  // Accept image files only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Image Upload Middleware
const uploadImages = multer({ 
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for images
  }
}).fields([
  { name: 'latestNewsImage', maxCount: 1 },
  { name: 'latest1Image', maxCount: 1 },
  { name: 'latest2Image', maxCount: 1 },
  { name: 'latest3Image', maxCount: 1 }
]);

// 🔥 FIXED: Video Upload Middleware - Use .single() instead of .fields()
const uploadVideos = multer({ 
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for videos
  }
}).single('videoFile'); // ✅ Changed from .fields() to .single()

// 🔥 FIXED: Video Conversion Function
const convertVideo = async (req, res, next) => {
  // ✅ Check req.file (not req.files) since we're using .single()
  if (!req.file) {
    console.log('⏭️ No video file to convert, skipping...');
    return next(); 
  }

  const uploadedFilePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();

  console.log(`🎬 Processing video: ${req.file.originalname} (${fileExtension})`);

  if (fileExtension === '.mp4') {
    console.log('✅ Video is already MP4, no conversion needed');
    return next(); 
  }

  const convertedFilePath = uploadedFilePath.replace(fileExtension, '.mp4');
  
  console.log(`🔄 Converting ${fileExtension} to MP4...`);
  
  exec(`ffmpeg -i "${uploadedFilePath}" -c:v libx264 -preset fast -crf 22 "${convertedFilePath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Video conversion error:', error.message);
      console.error('stderr:', stderr);
      // Continue without conversion - let the original file be used
      return next();
    } else {
      console.log('✅ Video converted successfully to MP4');
      
      // Update req.file to point to converted file
      req.file.path = convertedFilePath;
      req.file.filename = path.basename(convertedFilePath);
      
      // Delete original file
      fs.unlink(uploadedFilePath, (unlinkError) => {
        if (unlinkError) {
          console.warn('⚠️ Could not delete original file:', unlinkError.message);
        } else {
          console.log('🗑️ Original file deleted after conversion');
        }
      });
    }
    next();
  });
};

// 🆕 Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 500MB for videos and 10MB for images.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected file field. Please check your form.'
      });
    }
  }
  
  if (error.message.includes('Only video files are allowed!')) {
    return res.status(400).json({
      success: false,
      message: 'Only video files are allowed for video upload.'
    });
  }
  
  if (error.message.includes('Only image files are allowed!')) {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed for image upload.'
    });
  }
  
  // Pass other errors to default error handler
  next(error);
};

module.exports = {
  uploadImages,
  uploadVideos,
  convertVideo,
  handleMulterError
};