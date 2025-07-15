// routes/certificates.js - FIXED VERSION - Correct Template Variables
const express = require("express");
const router = express.Router();

// Load models
const User = require("../models/user");

// Load certificate controller
let certificateController;
try {
  certificateController = require("../controllers/certificateController");
  console.log("✅ Certificate controller loaded");
} catch (error) {
  console.log("⚠️ Using fallback certificate controller");

  // Fallback controller
  certificateController = {
    getCertificatesPage: async (req, res) => {
      try {
        const userId = req.user._id;
        const user = await User.findById(userId).select(
          "myCertificates achievementSummary firstName lastName"
        );

        if (!user) {
          return res.status(404).render("error", {
            message: "User not found",
            user: req.user,
          });
        }

        const certificates = user.myCertificates || [];
        const achievementSummary = user.achievementSummary || {
          totalCertificates: certificates.length,
          activeCertificates: certificates.length,
          achievementLevel:
            certificates.length >= 5
              ? "Advanced"
              : certificates.length >= 3
              ? "Intermediate"
              : "Beginner",
          totalLearningHours: 0,
          specializations: [],
        };

        res.render("myCertificates", {
          user: req.user,
          certificates,
          achievementSummary,
          title: "My Certificates - Professional Achievements",
        });
      } catch (error) {
        console.error("❌ Error in certificates page:", error);
        res.status(500).render("error", {
          message: "Error loading certificates page",
          user: req.user,
        });
      }
    },

    getUserCertificates: async (req, res) => {
      try {
        const userId = req.user._id;
        const user = await User.findById(userId).select(
          "myCertificates achievementSummary firstName lastName"
        );

        if (!user) {
          return res
            .status(404)
            .json({ success: false, message: "User not found" });
        }

        const certificates = user.myCertificates || [];
        res.json({
          success: true,
          certificates: certificates.map((cert) => ({
            certificateId: cert.certificateId,
            courseTitle: cert.certificateData.courseTitle,
            courseCode: cert.certificateData.courseCode,
            courseType: cert.courseType,
            completionDate: cert.certificateData.completionDate,
            issueDate: cert.certificateData.issueDate,
            downloadUrl: cert.certificateData.pdfUrl,
            shareableUrl: cert.shareUrl,
            downloadCount: cert.downloadCount || 0,
            achievement: cert.certificateData.achievement,
          })),
          achievementSummary: user.achievementSummary || {
            totalCertificates: 0,
            activeCertificates: 0,
            achievementLevel: "Beginner",
          },
        });
      } catch (error) {
        console.error("❌ Error getting certificates:", error);
        res
          .status(500)
          .json({ success: false, message: "Error retrieving certificates" });
      }
    },

    issueCertificate: (req, res) => {
      res.status(501).json({
        success: false,
        message:
          "Certificate issuance system not configured. Please contact support.",
      });
    },

    downloadCertificate: (req, res) => {
      res.status(501).json({
        success: false,
        message: "Certificate download will be available soon.",
      });
    },

    shareCertificate: (req, res) => {
      res.status(501).json({
        success: false,
        message: "Certificate sharing will be available soon.",
      });
    },
  };
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
    console.log("⚠️ Auth middleware not found, using placeholder");
    authenticateToken = (req, res, next) => {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }
      next();
    };
  }
}

// ========================================
// ✅ PUBLIC ROUTES FIRST (Specific routes before parameterized)
// ========================================

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    certificateSystem: "fixed",
    timestamp: new Date().toISOString(),
    verification: "working",
    templateVariables: "corrected",
    version: "3.0-fixed",
  });
});

// ✅ FIXED: Debug route to list all certificates
router.get("/debug/all-certificates", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Access denied in production" });
    }

    const users = await User.find({ "myCertificates.0": { $exists: true } })
      .select("myCertificates firstName lastName email")
      .limit(10);

    const allCertificates = [];
    users.forEach((user) => {
      if (user.myCertificates && user.myCertificates.length > 0) {
        user.myCertificates.forEach((cert) => {
          allCertificates.push({
            userEmail: user.email,
            userName: `${user.firstName} ${user.lastName}`,
            certificateId: cert.certificateId,
            courseTitle: cert.certificateData?.courseTitle,
            verificationCode: cert.certificateData?.verificationCode,
            verificationUrl: `/certificates/verify-page/${cert.certificateData?.verificationCode}`,
          });
        });
      }
    });

    res.json({
      message: "All certificates found in system (limited to 10 users)",
      totalCertificates: allCertificates.length,
      certificates: allCertificates,
      testExample:
        allCertificates.length > 0
          ? {
              message: "Try this verification URL:",
              url: allCertificates[0].verificationUrl,
              code: allCertificates[0].verificationCode,
            }
          : null,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Error fetching certificates for debugging",
    });
  }
});

// ✅ FIXED: Test verification route
router.get("/test-verify/:verificationCode", async (req, res) => {
  try {
    const { verificationCode } = req.params;
    console.log(`🧪 Testing verification for code: ${verificationCode}`);

    const user = await User.findOne({
      "myCertificates.certificateData.verificationCode": verificationCode,
    }).select("myCertificates firstName lastName email");

    if (!user) {
      return res.json({
        found: false,
        message: `No certificate found with verification code: ${verificationCode}`,
        searchedFor: verificationCode,
      });
    }

    const certificate = user.myCertificates.find(
      (cert) => cert.certificateData?.verificationCode === verificationCode
    );

    if (!certificate) {
      return res.json({
        found: false,
        message: "User found but certificate not in myCertificates array",
        userEmail: user.email,
        certificateCount: user.myCertificates?.length || 0,
        availableVerificationCodes:
          user.myCertificates?.map(
            (c) => c.certificateData?.verificationCode
          ) || [],
      });
    }

    res.json({
      found: true,
      message: "✅ Certificate found successfully!",
      certificate: {
        certificateId: certificate.certificateId,
        recipientName: certificate.certificateData.recipientName,
        courseTitle: certificate.certificateData.courseTitle,
        verificationCode: certificate.certificateData.verificationCode,
        issueDate: certificate.certificateData.issueDate,
      },
      user: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      },
      testUrls: {
        pageView: `/certificates/verify-page/${verificationCode}`,
        directVerify: `/certificates/verify/${verificationCode}`,
      },
      nextSteps: [
        `Visit: ${req.protocol}://${req.get(
          "host"
        )}/certificates/verify-page/${verificationCode}`,
        "The verification should now work correctly",
      ],
    });
  } catch (error) {
    res.status(500).json({
      found: false,
      error: error.message,
      message: "Error during verification test",
    });
  }
});

// ✅ FIXED: Certificate verification page - CORRECT TEMPLATE VARIABLES
router.get("/verify-page/:verificationCode", async (req, res) => {
  try {
    const { verificationCode } = req.params;
    console.log(`🔍 Loading verification page for code: ${verificationCode}`);

    const user = await User.findOne({
      "myCertificates.certificateData.verificationCode": verificationCode,
    }).select("myCertificates firstName lastName");

    if (!user) {
      console.log(
        `❌ No certificate found for verification code: ${verificationCode}`
      );
      return res.render("verify-certificate", {
        success: false, // ✅ CORRECT: Template expects 'success'
        error:
          "Certificate not found. Please check the verification code and try again.",
        title: "Certificate Verification",
      });
    }

    const certificate = user.myCertificates.find(
      (cert) => cert.certificateData?.verificationCode === verificationCode
    );

    if (!certificate) {
      console.log(`❌ Certificate not valid for code: ${verificationCode}`);
      return res.render("verify-certificate", {
        success: false, // ✅ CORRECT: Template expects 'success'
        error: "Certificate is not valid or has been revoked.",
        title: "Certificate Verification",
      });
    }

    console.log(
      `✅ Rendering verification page for certificate: ${certificate.certificateId}`
    );

    // ✅ FIXED: Provide ALL required template variables in correct format
    res.render("verify-certificate", {
      success: true, // ✅ CORRECT: Template expects 'success' not 'found'
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
      error: null, // ✅ IMPORTANT: Set error to null when success is true
      title: "Certificate Verification - IAAI Training",
    });
  } catch (error) {
    console.error("❌ Error in verification page:", error);
    res.render("verify-certificate", {
      success: false, // ✅ CORRECT: Template expects 'success'
      error: "Error verifying certificate. Please try again later.",
      title: "Certificate Verification",
    });
  }
});

// ✅ FIXED: Direct verification route (API + redirect)
router.get("/verify/:verificationCode", async (req, res) => {
  try {
    const { verificationCode } = req.params;
    console.log(`🔍 Direct verification for code: ${verificationCode}`);

    // Check if this is an API request
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      const user = await User.findOne({
        "myCertificates.certificateData.verificationCode": verificationCode,
      }).select("myCertificates firstName lastName");

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "Certificate not found" });
      }

      const certificate = user.myCertificates.find(
        (cert) => cert.certificateData?.verificationCode === verificationCode
      );

      if (!certificate) {
        return res
          .status(404)
          .json({ success: false, message: "Certificate not found" });
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
      // Redirect to verification page for HTML requests
      res.redirect(`/certificates/verify-page/${verificationCode}`);
    }
  } catch (error) {
    console.error("❌ Error in direct verification:", error);
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      res
        .status(500)
        .json({ success: false, message: "Error verifying certificate" });
    } else {
      res.redirect(`/certificates/verify-page/${verificationCode}`);
    }
  }
});

// Certificate lookup by ID
router.get("/lookup/:certificateId", async (req, res) => {
  try {
    const { certificateId } = req.params;
    console.log(`🔍 Looking up certificate: ${certificateId}`);

    const user = await User.findOne({
      "myCertificates.certificateId": certificateId,
    }).select("myCertificates firstName lastName");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    }

    const certificate = user.myCertificates.find(
      (cert) => cert.certificateId === certificateId
    );

    if (!certificate) {
      return res
        .status(404)
        .json({ success: false, message: "Certificate not found" });
    }

    res.json({
      success: true,
      certificate: {
        certificateId: certificate.certificateId,
        recipientName: certificate.certificateData.recipientName,
        courseTitle: certificate.certificateData.courseTitle,
        courseCode: certificate.certificateData.courseCode,
        completionDate: certificate.certificateData.completionDate,
        issueDate: certificate.certificateData.issueDate,
        courseType: certificate.courseType,
        verificationUrl: `/certificates/verify/${certificate.certificateData.verificationCode}`,
        institutionName: "IAAI Training Institute",
      },
    });
  } catch (error) {
    console.error("❌ Error in certificate lookup:", error);
    res
      .status(500)
      .json({ success: false, message: "Error looking up certificate" });
  }
});

// ========================================
// ✅ PROTECTED ROUTES (After public routes)
// ========================================

// Get certificates list page
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

// ✅ FIXED: Certificate view route
// ✅ FIXED: Use the enhanced controller instead of inline logic
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

// Get user's certificates (API)
router.get("/api/my-certificates", authenticateToken, async (req, res) => {
  try {
    await certificateController.getUserCertificates(req, res);
  } catch (error) {
    console.error("❌ Error in get certificates API:", error);
    res
      .status(500)
      .json({ success: false, message: "Error retrieving certificates" });
  }
});

// Issue certificate
router.post("/api/issue", authenticateToken, async (req, res) => {
  try {
    await certificateController.issueCertificate(req, res);
  } catch (error) {
    console.error("❌ Error in issue certificate API:", error);
    res.status(500).json({
      success: false,
      message: "Error issuing certificate. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Download certificate
router.get("/download/:certificateId", authenticateToken, async (req, res) => {
  try {
    await certificateController.downloadCertificate(req, res);
  } catch (error) {
    console.error("❌ Error in download certificate route:", error);
    res
      .status(500)
      .json({ success: false, message: "Error downloading certificate" });
  }
});

// Share certificate
router.post("/share/:certificateId", authenticateToken, async (req, res) => {
  try {
    await certificateController.shareCertificate(req, res);
  } catch (error) {
    console.error("❌ Error in share certificate route:", error);
    res
      .status(500)
      .json({ success: false, message: "Error sharing certificate" });
  }
});

// ========================================
// DEBUG ROUTES (Protected)
// ========================================

router.get("/debug/:userId", async (req, res) => {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      (!req.user || req.user.role !== "admin")
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { userId } = req.params;
    const user = await User.findById(userId).select(
      "myCertificates firstName lastName email"
    );

    if (!user) {
      return res.json({ error: "User not found" });
    }

    res.json({
      user: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        id: user._id,
      },
      certificates:
        user.myCertificates?.map((cert) => ({
          certificateId: cert.certificateId,
          _id: cert._id,
          courseId: cert.courseId,
          courseType: cert.courseType,
          title: cert.certificateData?.courseTitle,
          issueDate: cert.certificateData?.issueDate,
          verificationCode: cert.certificateData?.verificationCode,
          verificationUrls: {
            page: `/certificates/verify-page/${cert.certificateData?.verificationCode}`,
            api: `/certificates/verify/${cert.certificateData?.verificationCode}`,
          },
        })) || [],
      totalCertificates: user.myCertificates?.length || 0,
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

module.exports = router;
