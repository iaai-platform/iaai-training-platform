const express = require("express");
const router = express.Router();
const { SupportAssignmentService } = require("../services/supportAssignment");

// Manual assignment trigger
router.post("/assign-contacts", async (req, res) => {
  try {
    const result = await SupportAssignmentService.assignContactsToSupport(
      req.body
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get workload statistics
router.get("/workload-stats", async (req, res) => {
  try {
    const stats = await SupportAssignmentService.getWorkloadStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rebalance workload
router.post("/rebalance", async (req, res) => {
  try {
    const result = await SupportAssignmentService.rebalanceWorkload();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
