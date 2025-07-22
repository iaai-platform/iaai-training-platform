//middlewares/cloudinaryUpload.js - Fixed with automatic directory creation
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dgzj5k8b6",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ FIXED: Ensure directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dirPath}`);
  }
};

// ✅ FIXED: Local storage with directory creation
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "public", "uploads", "temp");

    // ✅ Ensure directory exists
    try {
      ensureDirectoryExists(uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      console.error("❌ Error creating upload directory:", error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      // ✅ FIXED: Clean filename to avoid issues with special characters
      const cleanFilename = file.originalname
        .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace special chars with underscore
        .replace(/\s+/g, "_") // Replace spaces with underscore
        .replace(/_+/g, "_"); // Replace multiple underscores with single

      const filename = uniqueSuffix + "-" + cleanFilename;
      console.log(`📝 Generated filename: ${filename}`);
      cb(null, filename);
    } catch (error) {
      console.error("❌ Error generating filename:", error);
      cb(error);
    }
  },
});

// ✅ File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPG, PNG, WEBP) are allowed!"), false);
  }
};

// ✅ Multer configuration
const upload = multer({
  storage: localStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // ✅ Increased to 10MB limit per file
    files: 4, // Maximum 4 files (for homepage images)
  },
  fileFilter: fileFilter,
});

// ✅ Upload multiple homepage images
const uploadHomepageImages = upload.fields([
  { name: "latestNewsImage", maxCount: 1 },
  { name: "latest1Image", maxCount: 1 },
  { name: "latest2Image", maxCount: 1 },
  { name: "latest3Image", maxCount: 1 },
]);

// ✅ ENHANCED: Middleware to upload to Cloudinary after local upload
const uploadToCloudinary = async (req, res, next) => {
  try {
    console.log("📤 Starting Cloudinary upload process...");

    if (!req.files || Object.keys(req.files).length === 0) {
      console.log("ℹ️ No files to upload to Cloudinary");
      return next();
    }

    // ✅ Validate Cloudinary configuration
    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error(
        "❌ Cloudinary credentials missing in environment variables"
      );
      return res.status(500).json({
        success: false,
        message:
          "Cloudinary configuration missing. Please check environment variables.",
      });
    }

    // Process each uploaded file
    const cloudinaryResults = {};

    for (const fieldName in req.files) {
      const fileArray = req.files[fieldName];

      if (fileArray && fileArray.length > 0) {
        const file = fileArray[0];
        const filePath = file.path;

        // ✅ Verify file exists before uploading
        if (!fs.existsSync(filePath)) {
          console.error(`❌ File does not exist: ${filePath}`);
          cloudinaryResults[fieldName] = {
            error: "File does not exist at specified path",
            originalPath: filePath,
          };
          continue;
        }

        try {
          console.log(
            `📤 Uploading ${fieldName} to Cloudinary from: ${filePath}`
          );

          // Determine Cloudinary folder based on field name
          let folder = "iaai-platform/homepage";
          switch (fieldName) {
            case "latestNewsImage":
              folder = "iaai-platform/homepage/news";
              break;
            case "latest1Image":
              folder = "iaai-platform/homepage/latest1";
              break;
            case "latest2Image":
              folder = "iaai-platform/homepage/latest2";
              break;
            case "latest3Image":
              folder = "iaai-platform/homepage/latest3";
              break;
          }

          // Upload to Cloudinary
          const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            use_filename: true,
            unique_filename: true,
            overwrite: false,
            resource_type: "auto",
            transformation: [
              {
                width: 1200,
                height: 800,
                crop: "limit",
                quality: "auto",
                format: "webp",
              },
            ],
          });

          console.log(
            `✅ Successfully uploaded ${fieldName}: ${result.secure_url}`
          );

          // Store Cloudinary result
          cloudinaryResults[fieldName] = {
            url: result.secure_url,
            publicId: result.public_id,
            originalPath: filePath,
            success: true,
          };

          // Delete local file after successful upload
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted local file: ${filePath}`);
            }
          } catch (deleteError) {
            console.warn(
              `⚠️ Could not delete local file: ${filePath}`,
              deleteError.message
            );
          }
        } catch (uploadError) {
          console.error(
            `❌ Error uploading ${fieldName} to Cloudinary:`,
            uploadError
          );

          // Clean up local file on error
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Cleaned up local file after error: ${filePath}`);
            }
          } catch (deleteError) {
            console.warn(
              `⚠️ Could not clean up local file: ${filePath}`,
              deleteError.message
            );
          }

          // Store error info
          cloudinaryResults[fieldName] = {
            error: uploadError.message,
            originalPath: filePath,
            success: false,
          };
        }
      }
    }

    // Attach Cloudinary results to request for controller use
    req.cloudinaryResults = cloudinaryResults;

    console.log("✅ Cloudinary upload process completed");
    console.log(
      "📊 Upload results:",
      Object.keys(cloudinaryResults).map((key) => ({
        field: key,
        success: cloudinaryResults[key].success,
        url: cloudinaryResults[key].url || "Failed",
      }))
    );

    next();
  } catch (error) {
    console.error("❌ Error in Cloudinary upload middleware:", error);

    // Clean up any local files on error
    if (req.files) {
      for (const fieldName in req.files) {
        const fileArray = req.files[fieldName];
        if (fileArray && fileArray.length > 0) {
          const filePath = fileArray[0].path;
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Cleaned up file after error: ${filePath}`);
            }
          } catch (deleteError) {
            console.warn(
              `⚠️ Could not clean up file: ${filePath}`,
              deleteError.message
            );
          }
        }
      }
    }

    res.status(500).json({
      success: false,
      message: "File upload to Cloudinary failed",
      error: error.message,
    });
  }
};

// ✅ ENHANCED: Error handling middleware
const handleUploadError = (error, req, res, next) => {
  console.error("❌ Upload error:", error);

  // Clean up any uploaded files
  if (req.files) {
    for (const fieldName in req.files) {
      const fileArray = req.files[fieldName];
      if (fileArray && fileArray.length > 0) {
        const filePath = fileArray[0].path;
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Cleaned up file: ${filePath}`);
          }
        } catch (cleanupError) {
          console.warn(
            `⚠️ Error cleaning up file ${filePath}:`,
            cleanupError.message
          );
        }
      }
    }
  }

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB per file.",
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files. Maximum 4 files allowed.",
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message:
            "Unexpected file field. Expected: latestNewsImage, latest1Image, latest2Image, or latest3Image.",
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`,
        });
    }
  }

  if (error.message === "Only image files (JPG, PNG, WEBP) are allowed!") {
    return res.status(400).json({
      success: false,
      message: "Only image files (JPG, PNG, WEBP) are allowed.",
    });
  }

  if (error.code === "ENOENT") {
    return res.status(500).json({
      success: false,
      message: "Upload directory not accessible. Please contact administrator.",
    });
  }

  res.status(500).json({
    success: false,
    message: "File upload failed.",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Internal server error",
  });
};

// ✅ Helper function to delete Cloudinary image
const deleteFromCloudinary = async (publicId) => {
  try {
    if (publicId) {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log(`✅ Deleted from Cloudinary: ${publicId}`, result);
      return result;
    }
  } catch (error) {
    console.error(`❌ Error deleting from Cloudinary: ${publicId}`, error);
    throw error;
  }
};

// ✅ Test Cloudinary connection and create required directories
const initializeCloudinary = async () => {
  try {
    // Test connection
    await cloudinary.api.ping();
    console.log("✅ Cloudinary connection successful");

    // Ensure local directories exist
    const requiredDirs = [
      path.join(__dirname, "..", "public"),
      path.join(__dirname, "..", "public", "uploads"),
      path.join(__dirname, "..", "public", "uploads", "temp"),
      path.join(__dirname, "..", "public", "images"),
    ];

    requiredDirs.forEach((dir) => {
      ensureDirectoryExists(dir);
    });

    console.log("✅ All required directories verified/created");
    return true;
  } catch (error) {
    console.error("❌ Cloudinary initialization failed:", error);
    return false;
  }
};

// ✅ Initialize on module load
initializeCloudinary();

module.exports = {
  uploadHomepageImages,
  uploadToCloudinary,
  handleUploadError,
  deleteFromCloudinary,
  initializeCloudinary,
  cloudinary,
};
