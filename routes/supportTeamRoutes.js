const express = require("express");
const router = express.Router();

// Import with error handling
let SupportAssignmentService;

try {
  const supportService = require("../services/supportAssignment");
  SupportAssignmentService = supportService.SupportAssignmentService;
} catch (error) {
  console.warn("⚠️ Support assignment service not available:", error.message);
}

// Basic test route
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Support team routes are working!",
    timestamp: new Date().toISOString(),
  });
});

// Manual assignment trigger
router.post("/assign-contacts", async (req, res) => {
  try {
    if (!SupportAssignmentService) {
      return res.status(503).json({
        success: false,
        error: "Support assignment service not available",
      });
    }

    const result = await SupportAssignmentService.assignContactsToSupport(
      req.body
    );
    res.json(result);
  } catch (error) {
    console.error("Assignment error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get workload statistics
router.get("/workload-stats", async (req, res) => {
  try {
    if (!SupportAssignmentService) {
      return res.status(503).json({
        success: false,
        error: "Support assignment service not available",
        message:
          "Service is still initializing. Please try again in a few seconds.",
      });
    }

    console.log("📊 Getting workload statistics...");
    const stats = await SupportAssignmentService.getWorkloadStatistics();
    console.log(
      "✅ Workload stats retrieved:",
      stats.length > 0 ? "Data found" : "No data"
    );

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Workload stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Rebalance workload
router.post("/rebalance", async (req, res) => {
  try {
    if (!SupportAssignmentService) {
      return res.status(503).json({
        success: false,
        error: "Support assignment service not available",
      });
    }

    const result = await SupportAssignmentService.rebalanceWorkload();
    res.json(result);
  } catch (error) {
    console.error("Rebalance error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all support team members (basic info)
router.get("/team-members", async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");

    const supportTeamMembers = await SupportTeam.find(
      { "supportInfo.supportStatus": "active" },
      {
        "supportInfo.supportId": 1,
        "supportInfo.supportName": 1,
        "supportInfo.supportEmail": 1,
        "supportInfo.supportStatus": 1,
        "supportInfo.capabilities": 1,
        "supportInfo.performance": 1,
      }
    );

    res.json({
      success: true,
      data: supportTeamMembers,
      count: supportTeamMembers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Team members error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create a test support team member
router.post("/create-test-member", async (req, res) => {
  try {
    const SupportTeam = require("../models/supportTeam");

    const testMember = new SupportTeam({
      supportInfo: {
        supportId: `SUP${Date.now()}`,
        supportName: req.body.name || "Test Support Member",
        supportEmail: req.body.email || `test${Date.now()}@iaai.com`,
        supportStatus: "active",
        capabilities: {
          languages: ["English"],
          specializations: ["Medical", "Aesthetic"],
          maxCasesAllowed: 20,
          canHandlePayments: true,
          canCreateContracts: false,
        },
        performance: {
          totalCasesHandled: 0,
          successfulConversions: 0,
          conversionRate: 0,
          averageResponseTime: 24,
        },
      },
      assignedCases: [],
    });

    await testMember.save();

    res.json({
      success: true,
      data: testMember,
      message: "Test support team member created successfully",
    });
  } catch (error) {
    console.error("Create test member error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
