// routes/certificationBodyRoutes.js - Updated with Cloudinary
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Import the controller
const certificationBodyController = require("../controllers/certificationBodyController");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for certification body logos
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "iaai-platform/certificationBody/logo",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
    transformation: [
      { width: 300, height: 300, crop: "fit" },
      { quality: "auto", fetch_format: "auto" },
    ],
    public_id: (req, file) =>
      `cert-body-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  next();
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Access denied. Admin required." });
  }
  next();
}

// ============================================
// WEB ROUTES (Views)
// ============================================

// Main certification bodies management page
router.get(
  "/admin-certification-bodies",
  requireAuth,
  certificationBodyController.getCertificationBodiesPage
);

// ============================================
// API ROUTES
// ============================================

// Get all certification bodies
router.get(
  "/api/certification-bodies",
  requireAuth,
  requireAdmin,
  certificationBodyController.getAllCertificationBodies
);

// Get active certification bodies (for dropdowns)
router.get(
  "/api/certification-bodies/active",
  requireAuth,
  certificationBodyController.getActiveCertificationBodies
);

// Search certification bodies
router.get(
  "/api/certification-bodies/search",
  requireAuth,
  certificationBodyController.searchCertificationBodies
);

// Create new certification body
router.post(
  "/api/certification-bodies",
  requireAuth,
  requireAdmin,
  upload.single("logo"),
  certificationBodyController.createCertificationBody
);

// Update certification body
router.put(
  "/api/certification-bodies/:id",
  requireAuth,
  requireAdmin,
  upload.single("logo"),
  certificationBodyController.updateCertificationBody
);

// Delete certification body (soft delete)
router.delete(
  "/api/certification-bodies/:id",
  requireAuth,
  requireAdmin,
  certificationBodyController.deleteCertificationBody
);

// Serve logo images (now redirects to Cloudinary)
router.get("/logo/:id", certificationBodyController.serveLogo);

module.exports = router;
