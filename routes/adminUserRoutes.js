// adminUserRoutes.js - Complete User Management Routes
const express = require("express");
const router = express.Router();
const adminUserController = require("../controllers/adminUserController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");

// ========================================
// MAIN USER MANAGEMENT PAGE
// ========================================
router.get(
  "/admin-users-manage",
  isAuthenticated,
  isAdmin,
  adminUserController.getAllUsersManage
);

// ========================================
// USER DETAILS AND ACTIONS
// ========================================
router.get(
  "/admin-users/:userId/details",
  isAuthenticated,
  isAdmin,
  adminUserController.getUserDetails
);

// User approval/rejection
router.post(
  "/admin-users/approve",
  isAuthenticated,
  isAdmin,
  adminUserController.approveUser
);

router.post(
  "/admin-users/reject",
  isAuthenticated,
  isAdmin,
  adminUserController.rejectUser
);

// User deletion
router.delete(
  "/admin-users/:userId",
  isAuthenticated,
  isAdmin,
  adminUserController.deleteUser
);

// ========================================
// COURSE MANAGEMENT
// ========================================
router.delete(
  "/admin-users/:userId/courses/:enrollmentId/:courseType",
  isAuthenticated,
  isAdmin,
  adminUserController.removeCourseFromUser
);

// ========================================
// EXISTING ROUTES (Backward compatibility)
// ========================================
router.get(
  "/admin-user-approval",
  isAuthenticated,
  isAdmin,
  adminUserController.getAllUsersManage
);

router.get(
  "/admin-users",
  isAuthenticated,
  isAdmin,
  adminUserController.getAllUsersManage
);

// Payment Analytics
router.get(
  "/admin/payment-analytics",
  isAuthenticated,
  isAdmin,
  adminUserController.getPaymentAnalytics
);

// Export Routes
router.get(
  "/admin/users/export",
  isAuthenticated,
  isAdmin,
  adminUserController.exportUserData
);

router.get(
  "/admin/financial-report",
  isAuthenticated,
  isAdmin,
  adminUserController.exportFinancialReport ||
    adminUserController.getPaymentAnalytics
);

// API Endpoints for AJAX
router.get(
  "/admin/api/recent-transactions",
  isAuthenticated,
  isAdmin,
  adminUserController.getRecentTransactions ||
    ((req, res) => res.json({ transactions: [] }))
);

router.get(
  "/admin/api/transaction/:transactionId",
  isAuthenticated,
  isAdmin,
  adminUserController.getTransactionDetails ||
    ((req, res) => res.json({ transaction: null }))
);

router.get(
  "/admin/api/filtered-analytics",
  isAuthenticated,
  isAdmin,
  adminUserController.getFilteredAnalytics ||
    adminUserController.getPaymentAnalytics
);

// Recycle Bin Routes
router.get(
  "/admin-users/recycle-bin",
  isAuthenticated,
  isAdmin,
  adminUserController.getRecycleBin ||
    ((req, res) =>
      res.render("admin-recycle-bin", { users: [], user: req.user }))
);

router.post(
  "/admin-users/recycle-bin/:deletedUserId/recover",
  isAuthenticated,
  isAdmin,
  adminUserController.recoverUser ||
    ((req, res) => res.json({ success: false }))
);

router.delete(
  "/admin-users/recycle-bin/:deletedUserId",
  isAuthenticated,
  isAdmin,
  adminUserController.permanentlyDeleteUser ||
    ((req, res) => res.json({ success: false }))
);

// User Details and Actions (alternative routes)
router.get(
  "/admin-users/:userId",
  isAuthenticated,
  isAdmin,
  adminUserController.getUserDetails
);

router.post(
  "/admin-users/:userId/update-role",
  isAuthenticated,
  isAdmin,
  adminUserController.updateUserRole ||
    ((req, res) => res.json({ success: false }))
);

router.post(
  "/admin-users/:userId/reset-password",
  isAuthenticated,
  isAdmin,
  adminUserController.resetUserPassword ||
    ((req, res) => res.json({ success: false }))
);

// Additional backward compatibility routes
router.post(
  "/admin-user-approval/approve-user",
  isAuthenticated,
  isAdmin,
  adminUserController.approveUser
);

router.post(
  "/admin-user-approval/reject-user",
  isAuthenticated,
  isAdmin,
  adminUserController.rejectUser
);

router.post(
  "/admin/approve-user",
  isAuthenticated,
  isAdmin,
  adminUserController.approveUser
);

router.post(
  "/admin/reject-user",
  isAuthenticated,
  isAdmin,
  adminUserController.rejectUser
);

// Course Management (additional routes)
router.post(
  "/admin-users/:userId/courses/add",
  isAuthenticated,
  isAdmin,
  adminUserController.addCourseToUser ||
    ((req, res) => res.json({ success: false }))
);

router.get(
  "/admin-users/:userId/courses/available",
  isAuthenticated,
  isAdmin,
  adminUserController.getAvailableCoursesForUser ||
    ((req, res) => res.json({ courses: [] }))
);

router.get(
  "/admin-users/:userId/courses/deleted",
  isAuthenticated,
  isAdmin,
  adminUserController.getDeletedCourses ||
    ((req, res) => res.json({ courses: [] }))
);

router.post(
  "/admin-users/:userId/courses/deleted/:deletedCourseId/recover",
  isAuthenticated,
  isAdmin,
  adminUserController.recoverDeletedCourse ||
    ((req, res) => res.json({ success: false }))
);

module.exports = router;
