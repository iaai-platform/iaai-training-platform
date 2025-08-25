// adminUserRoutes.js - COMPLETE VERSION WITH ALL ROUTES
const express = require("express");
const router = express.Router();
const adminUserController = require("../controllers/adminUserController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");

// ✅ User Management Pages
router.get(
  "/admin-user-approval",
  isAuthenticated,
  isAdmin,
  adminUserController.getAllUsers
);
router.get(
  "/admin-users",
  isAuthenticated,
  isAdmin,
  adminUserController.getAllUsers
);

// ✅ Payment Analytics Pages
router.get(
  "/admin/payment-analytics",
  isAuthenticated,
  isAdmin,
  adminUserController.getPaymentAnalytics
);

// ✅ Export Routes
router.get(
  "/admin/financial-report",
  isAuthenticated,
  isAdmin,
  adminUserController.exportFinancialReport
);
router.get(
  "/admin/users/export",
  isAuthenticated,
  isAdmin,
  adminUserController.exportUserData
);

// ✅ API Endpoints for AJAX calls
router.get(
  "/admin/api/recent-transactions",
  isAuthenticated,
  isAdmin,
  adminUserController.getRecentTransactions
);
router.get(
  "/admin/api/transaction/:transactionId",
  isAuthenticated,
  isAdmin,
  adminUserController.getTransactionDetails
);
router.get(
  "/admin/api/filtered-analytics",
  isAuthenticated,
  isAdmin,
  adminUserController.getFilteredAnalytics
);

// ✅ Additional Export Routes (if you want specific endpoints for each format)
router.get(
  "/admin/export/excel",
  isAuthenticated,
  isAdmin,
  adminUserController.exportFinancialReport
);
router.get(
  "/admin/export/pdf",
  isAuthenticated,
  isAdmin,
  adminUserController.exportFinancialReport
);
router.get(
  "/admin/export/csv",
  isAuthenticated,
  isAdmin,
  adminUserController.exportFinancialReport
);

// ✅ User Actions - These work from ALL pages
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

// Also add the /admin/ routes for backward compatibility
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

// ✅ Recycle Bin Routes
router.get(
  "/admin-users/recycle-bin",
  isAuthenticated,
  isAdmin,
  adminUserController.getRecycleBin
);
router.post(
  "/admin-users/recycle-bin/:deletedUserId/recover",
  isAuthenticated,
  isAdmin,
  adminUserController.recoverUser
);
router.delete(
  "/admin-users/recycle-bin/:deletedUserId",
  isAuthenticated,
  isAdmin,
  adminUserController.permanentlyDeleteUser
);

// ✅ User Details and Actions
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
  adminUserController.updateUserRole
);
router.post(
  "/admin-users/:userId/reset-password",
  isAuthenticated,
  isAdmin,
  adminUserController.resetUserPassword
);

// ✅ Email Dashboard
router.get("/admin/email-dashboard", isAuthenticated, isAdmin, (req, res) => {
  res.render("admin-email-dashboard", {
    user: req.user,
    title: "Email Management",
  });
});

// ✅ Course Management Routes
router.delete(
  "/admin-users/:userId/courses/:enrollmentId/:courseType",
  isAuthenticated,
  isAdmin,
  adminUserController.removeCourseFromUser
);
router.post(
  "/admin-users/:userId/courses/add",
  isAuthenticated,
  isAdmin,
  adminUserController.addCourseToUser
);
router.get(
  "/admin-users/:userId/courses/available",
  isAuthenticated,
  isAdmin,
  adminUserController.getAvailableCoursesForUser
);
router.get(
  "/admin-users/:userId/courses/deleted",
  isAuthenticated,
  isAdmin,
  adminUserController.getDeletedCourses
);
router.post(
  "/admin-users/:userId/courses/deleted/:deletedCourseId/recover",
  isAuthenticated,
  isAdmin,
  adminUserController.recoverDeletedCourse
);
module.exports = router;
