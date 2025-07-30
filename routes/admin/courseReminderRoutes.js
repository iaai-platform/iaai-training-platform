// routes/admin/courseReminderRoutes.js

const express = require("express");
const router = express.Router();
const courseReminderScheduler = require("../../utils/courseReminderScheduler");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const isAdmin = require("../../middlewares/isAdmin");

// View all scheduled reminders
router.get("/admin/course-reminders", isAuthenticated, isAdmin, (req, res) => {
  try {
    const reminders = courseReminderScheduler.getScheduledReminders();
    const status = courseReminderScheduler.getStatus();

    res.render("admin/course-reminders", {
      user: req.user,
      reminders: reminders,
      status: status,
      title: "Course Reminders Management",
    });
  } catch (error) {
    console.error("❌ Error loading reminder dashboard:", error);
    req.flash("error_message", "Error loading reminder dashboard");
    res.redirect("/dashboard");
  }
});

// Manually schedule reminder for a course
router.post(
  "/admin/course-reminders/schedule",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { courseId, courseType } = req.body;

      const jobId = await courseReminderScheduler.scheduleReminderForCourse(
        courseId,
        courseType
      );

      if (jobId) {
        req.flash("success_message", "Course reminder scheduled successfully");
      } else {
        req.flash("error_message", "Failed to schedule course reminder");
      }

      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error scheduling reminder:", error);
      req.flash("error_message", "Error scheduling reminder");
      res.redirect("/admin/course-reminders");
    }
  }
);

// Cancel a specific reminder
router.post(
  "/admin/course-reminders/cancel",
  isAuthenticated,
  isAdmin,
  (req, res) => {
    try {
      const { jobId } = req.body;

      const cancelled = courseReminderScheduler.cancelReminder(jobId);

      if (cancelled) {
        req.flash("success_message", "Reminder cancelled successfully");
      } else {
        req.flash("error_message", "Reminder not found or already cancelled");
      }

      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error cancelling reminder:", error);
      req.flash("error_message", "Error cancelling reminder");
      res.redirect("/admin/course-reminders");
    }
  }
);

// Schedule all upcoming course reminders
router.post(
  "/admin/course-reminders/schedule-all",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const count =
        await courseReminderScheduler.scheduleAllUpcomingReminders();
      req.flash("success_message", `Scheduled ${count} course reminders`);
      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error scheduling all reminders:", error);
      req.flash("error_message", "Error scheduling reminders");
      res.redirect("/admin/course-reminders");
    }
  }
);

// API endpoint for reminder status
router.get(
  "/api/admin/course-reminders/status",
  isAuthenticated,
  isAdmin,
  (req, res) => {
    try {
      const status = courseReminderScheduler.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reminder status" });
    }
  }
);

module.exports = router;
