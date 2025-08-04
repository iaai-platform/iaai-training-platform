// ============================================================================
// 2. CERTIFICATE ROUTES - routes/certificates.js
// ============================================================================

const express = require("express");
const router = express.Router();
const User = require("../models/user");

// Load certificate controller
let certificateController;
try {
  certificateController = require("../controllers/certificateController");
  console.log("✅ Bulletproof certificate controller loaded");
} catch (error) {
  console.error("❌ Could not load certificate controller:", error.message);
  process.exit(1); // Exit if controller can't be loaded - this is critical
}

// Authentication middleware
let authenticateToken;
try {
  authenticateToken = require("../middlewares/isAuthenticated");
  console.log("✅ Using middlewares/isAuthenticated");
} catch (error) {
  try {
    authenticateToken = require("../middleware/auth").authenticateToken;
    console.log("✅ Using middleware/auth");
  } catch (error2) {
    console.error("❌ Could not load authentication middleware");
    process.exit(1); // Exit if auth can't be loaded - this is critical
  }
}

// ========================================
// PUBLIC ROUTES
// ========================================

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    certificateSystem: "bulletproof",
    timestamp: new Date().toISOString(),
    controllerLoaded: !!certificateController,
    version: "1.0.0",
  });
});

// Certificate verification page
router.get("/verify-page/:verificationCode", async (req, res) => {
  try {
    const { verificationCode } = req.params;
    console.log(`🔍 Loading verification page for code: ${verificationCode}`);

    const user = await User.findOne({
      "myCertificates.certificateData.verificationCode": verificationCode,
    }).select("myCertificates firstName lastName");

    if (!user) {
      return res.render("verify-certificate", {
        success: false,
        error:
          "Certificate not found. Please check the verification code and try again.",
        title: "Certificate Verification",
      });
    }

    const certificate = user.myCertificates.find(
      (cert) => cert.certificateData?.verificationCode === verificationCode
    );

    if (!certificate) {
      return res.render("verify-certificate", {
        success: false,
        error: "Certificate is not valid or has been revoked.",
        title: "Certificate Verification",
      });
    }

    res.render("verify-certificate", {
      success: true,
      certificate: {
        certificateId: certificate.certificateId,
        recipientName: certificate.certificateData.recipientName,
        courseTitle: certificate.certificateData.courseTitle,
        courseCode: certificate.certificateData.courseCode,
        institutionName: "IAAI Training Institute",
        completionDate: certificate.certificateData.completionDate,
        issueDate: certificate.certificateData.issueDate,
        verificationCode: certificate.certificateData.verificationCode,
        courseType: certificate.courseType,
        achievement: certificate.certificateData.achievement,
        instructors: certificate.certificateData.instructors || [
          { name: "IAAI Training Team", role: "Lead Instructor" },
        ],
        certificationBodies: certificate.certificateData
          .certificationBodies || [
          { name: "IAAI Training Institute", role: "Primary Issuer" },
        ],
      },
      error: null,
      title: "Certificate Verification - IAAI Training",
    });
  } catch (error) {
    console.error("❌ Error in verification page:", error);
    res.render("verify-certificate", {
      success: false,
      error: "Error verifying certificate. Please try again later.",
      title: "Certificate Verification",
    });
  }
});

// Direct verification API
router.get("/verify/:verificationCode", async (req, res) => {
  try {
    const { verificationCode } = req.params;

    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      const user = await User.findOne({
        "myCertificates.certificateData.verificationCode": verificationCode,
      }).select("myCertificates firstName lastName");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      const certificate = user.myCertificates.find(
        (cert) => cert.certificateData?.verificationCode === verificationCode
      );

      if (!certificate) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      res.json({
        success: true,
        valid: true,
        certificate: {
          certificateId: certificate.certificateId,
          recipientName: certificate.certificateData.recipientName,
          courseTitle: certificate.certificateData.courseTitle,
          courseCode: certificate.certificateData.courseCode,
          institutionName: "IAAI Training Institute",
          completionDate: certificate.certificateData.completionDate,
          issueDate: certificate.certificateData.issueDate,
          verificationCode: certificate.certificateData.verificationCode,
          courseType: certificate.courseType,
          achievement: certificate.certificateData.achievement,
        },
      });
    } else {
      res.redirect(`/certificates/verify-page/${verificationCode}`);
    }
  } catch (error) {
    console.error("❌ Error in direct verification:", error);
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      res.status(500).json({
        success: false,
        message: "Error verifying certificate",
      });
    } else {
      res.redirect(`/certificates/verify-page/${verificationCode}`);
    }
  }
});

// ========================================
// PROTECTED ROUTES
// ========================================

// Main certificate generation route
router.post("/api/issue", authenticateToken, async (req, res) => {
  try {
    console.log("📋 Bulletproof certificate generation request:", {
      body: req.body,
      user: req.user?.email,
      timestamp: new Date().toISOString(),
    });

    await certificateController.issueCertificate(req, res);
  } catch (error) {
    console.error("❌ Error in bulletproof certificate API:", error);
    res.status(500).json({
      success: false,
      message: "Error issuing certificate. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Get user's certificates (API)
router.get("/api/my-certificates", authenticateToken, async (req, res) => {
  try {
    await certificateController.getUserCertificates(req, res);
  } catch (error) {
    console.error("❌ Error in get certificates API:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving certificates",
    });
  }
});

// Certificate view route
router.get("/view/:certificateId", authenticateToken, async (req, res) => {
  try {
    await certificateController.viewCertificate(req, res);
  } catch (error) {
    console.error("❌ Error in certificate view route:", error);
    res.status(500).render("error", {
      message: "Error loading certificate. Please try again later.",
      user: req.user,
    });
  }
});

// Certificates listing page
router.get("/", authenticateToken, async (req, res) => {
  try {
    await certificateController.getCertificatesPage(req, res);
  } catch (error) {
    console.error("❌ Error in certificates page route:", error);
    res.status(500).render("error", {
      message: "Error loading certificates page",
      user: req.user,
    });
  }
});

module.exports = router;
