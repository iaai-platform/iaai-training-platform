const express = require("express");
const router = express.Router();
const emailCollectionController = require("../controllers/emailCollectionController");

// Public route - collect email
router.post("/collect-email", emailCollectionController.collectEmail);

// Admin routes - protected
router.get("/admin/email-collections", emailCollectionController.adminView);
router.get(
  "/admin/email-collections/export",
  emailCollectionController.exportEmails
);

module.exports = router;
