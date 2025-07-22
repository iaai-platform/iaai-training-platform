//routes/homepageUpdateRoutes.js - Simplified Direct Cloudinary Upload
const express = require("express");
const router = express.Router();
const homepageUpdateController = require("../controllers/homepageUpdateController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");

// ✅ SIMPLIFIED: Direct Cloudinary upload middleware
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dgzj5k8b6",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ SIMPLIFIED: Direct Cloudinary storage with your folder structure
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder based on field name
    let folder = "iaai-platform/homepage/latest"; // Default folder

    if (file.fieldname === "latestNewsImage") {
      folder = "iaai-platform/homepage/news";
    } else if (file.fieldname.startsWith("latest")) {
      folder = "iaai-platform/homepage/latest";
    }

    return {
      folder: folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: 1200, height: 800, crop: "limit", quality: "auto" },
      ],
      use_filename: true,
      unique_filename: true,
    };
  },
});

// ✅ SIMPLIFIED: Multer setup
const upload = multer({
  storage: cloudinaryStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// ✅ SIMPLIFIED: Handle multiple image uploads
const handleHomepageUploads = upload.fields([
  { name: "latestNewsImage", maxCount: 1 },
  { name: "latest1Image", maxCount: 1 },
  { name: "latest2Image", maxCount: 1 },
  { name: "latest3Image", maxCount: 1 },
]);

console.log("🌐 Loading simplified homepage routes...");

// ✅ PUBLIC ROUTES
router.get("/", homepageUpdateController.getHomepageContent);
router.get("/all-courses", homepageUpdateController.getAllCoursesPage);
router.get(
  "/training-programs",
  homepageUpdateController.getTrainingProgramsPage
);

// ✅ ADMIN ROUTES
router.get(
  "/admin-homepage",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.getHomepageRecords
);

router.get(
  "/get-homepage-content/:id",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.getHomepageById
);

// ✅ Auto-Populate Route
router.post(
  "/auto-populate-homepage",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.autoPopulateHomepage
);

// ✅ SIMPLIFIED: Homepage Update Route
router.post(
  "/update-homepage",
  isAuthenticated,
  isAdmin,
  handleHomepageUploads,
  homepageUpdateController.updateHomepageContent
);

// ✅ Delete Homepage Content
router.delete(
  "/delete-homepage/:id",
  isAuthenticated,
  isAdmin,
  homepageUpdateController.deleteHomepageContent
);

console.log("✅ Simplified homepage routes loaded");

module.exports = router;
