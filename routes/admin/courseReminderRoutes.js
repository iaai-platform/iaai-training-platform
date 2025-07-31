// routes/admin/courseReminderRoutes.js - COMPLETE FIXED VERSION

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const courseReminderScheduler = require("../../utils/courseReminderScheduler");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const isAdmin = require("../../middlewares/isAdmin");

// Load models
const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../../models/onlineLiveTrainingModel");
const User = require("../../models/user");

// ============================================
// MAIN DASHBOARD - Load courses and reminders
// ============================================
router.get("/course-reminders", isAuthenticated, isAdmin, async (req, res) => {
  try {
    console.log("📧 Loading course reminders dashboard...");

    // Get current reminders and status
    const reminders = courseReminderScheduler.getScheduledReminders();
    const status = courseReminderScheduler.getStatus();

    // Load all courses that can have reminders (upcoming courses)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

    // Get upcoming in-person courses
    const inPersonCourses = await InPersonAestheticTraining.find({
      "schedule.startDate": {
        $gte: tomorrow,
        $lte: oneMonthFromNow,
      },
      "basic.status": { $in: ["open", "full", "in-progress"] },
    })
      .select("basic schedule enrollment venue instructors")
      .sort({ "schedule.startDate": 1 })
      .lean();

    // Get upcoming online courses
    const onlineCourses = await OnlineLiveTraining.find({
      "schedule.startDate": {
        $gte: tomorrow,
        $lte: oneMonthFromNow,
      },
      "basic.status": { $in: ["open", "full", "in-progress"] },
    })
      .select("basic schedule enrollment platform instructors")
      .sort({ "schedule.startDate": 1 })
      .lean();

    console.log(
      `✅ Loaded ${inPersonCourses.length} in-person and ${onlineCourses.length} online courses`
    );

    // Enhanced status with better metrics
    const enhancedStatus = {
      ...status,
      active: status.activeReminders || 0,
      scheduled: status.todayReminders || 0,
      sent: status.statistics?.totalEmailsSent || 0,
      failed: status.statistics?.totalEmailsFailed || 0,
    };

    res.render("admin/course-reminders", {
      user: req.user,
      reminders: reminders,
      status: enhancedStatus,
      allCourses: {
        inPerson: inPersonCourses,
        onlineLive: onlineCourses,
      },
      title: "Course Reminders Management",
    });
  } catch (error) {
    console.error("❌ Error loading reminder dashboard:", error);
    req.flash(
      "error_message",
      "Error loading reminder dashboard: " + error.message
    );
    res.redirect("/dashboard");
  }
});

// ============================================
// API: GET COURSE DATA FOR SELECTED COURSE
// ============================================
router.get(
  "/course-reminders/api/course-data",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { courseId, courseType } = req.query;

      if (!courseId || !courseType) {
        return res.json({
          success: false,
          error: "Course ID and type are required",
        });
      }

      console.log(`🔍 Getting course data for ${courseType}: ${courseId}`);

      // Get course data
      let course;
      if (courseType === "InPersonAestheticTraining") {
        course = await InPersonAestheticTraining.findById(courseId)
          .select("basic schedule enrollment venue instructors")
          .lean();
      } else if (courseType === "OnlineLiveTraining") {
        course = await OnlineLiveTraining.findById(courseId)
          .select("basic schedule enrollment platform instructors")
          .lean();
      }

      if (!course) {
        return res.json({
          success: false,
          error: "Course not found",
        });
      }

      // Get enrolled users count
      const enrolledUsers = await courseReminderScheduler.getEnrolledUsers(
        courseId,
        courseType
      );

      // Check if reminder is already scheduled
      const reminders = courseReminderScheduler.getScheduledReminders();
      const existingReminder = reminders.find(
        (r) => r.courseId === courseId && r.courseType === courseType
      );

      // Prepare response
      const response = {
        success: true,
        course: {
          id: course._id,
          title: course.basic?.title || "Unknown Course",
          code: course.basic?.courseCode || "N/A",
          startDate: course.schedule?.startDate,
          endDate: course.schedule?.endDate,
          status: course.basic?.status || "unknown",
          location:
            courseType === "InPersonAestheticTraining"
              ? `${course.venue?.city}, ${course.venue?.country}`
              : course.platform?.name,
          instructor: course.instructors?.primary?.name || "TBA",
        },
        enrolledCount: enrolledUsers.length,
        reminderScheduled: !!existingReminder,
        existingReminder: existingReminder || null,
      };

      console.log(
        `✅ Course data loaded: ${response.course.title} (${response.enrolledCount} enrolled)`
      );
      res.json(response);
    } catch (error) {
      console.error("❌ Error getting course data:", error);
      res.json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================
// SCHEDULE CUSTOM REMINDER
// ============================================
router.post(
  "/course-reminders/schedule-custom",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const {
        courseId,
        courseType,
        reminderType,
        emailType,
        customDateTime,
        customMessage,
      } = req.body;

      console.log(
        `📅 Scheduling custom reminder for ${courseType}: ${courseId}`
      );
      console.log(`   Reminder Type: ${reminderType}`);
      console.log(`   Email Type: ${emailType}`);

      // Validate required fields
      if (!courseId || !courseType || !reminderType || !emailType) {
        req.flash("error_message", "All required fields must be filled");
        return res.redirect("/admin/course-reminders");
      }

      let sendDate;

      // Calculate send date based on reminder type
      if (reminderType === "custom") {
        if (!customDateTime) {
          req.flash("error_message", "Custom date and time is required");
          return res.redirect("/admin/course-reminders");
        }
        sendDate = new Date(customDateTime);
      } else {
        // Get course to calculate relative date
        let course;
        if (courseType === "InPersonAestheticTraining") {
          course = await InPersonAestheticTraining.findById(courseId).select(
            "schedule"
          );
        } else if (courseType === "OnlineLiveTraining") {
          course = await OnlineLiveTraining.findById(courseId).select(
            "schedule"
          );
        }

        if (!course || !course.schedule?.startDate) {
          req.flash("error_message", "Course not found or missing start date");
          return res.redirect("/admin/course-reminders");
        }

        const startDate = new Date(course.schedule.startDate);
        const hoursMap = {
          "24h": 24,
          "48h": 48,
          "72h": 72,
          "1week": 168,
        };

        const hours = hoursMap[reminderType] || 24;
        sendDate = new Date(startDate.getTime() - hours * 60 * 60 * 1000);
      }

      // Validate send date is in future
      if (sendDate <= new Date()) {
        req.flash("error_message", "Reminder date must be in the future");
        return res.redirect("/admin/course-reminders");
      }

      // Validate custom message if email type is custom
      if (
        emailType === "custom" &&
        (!customMessage || customMessage.trim() === "")
      ) {
        req.flash(
          "error_message",
          "Custom message is required for custom email type"
        );
        return res.redirect("/admin/course-reminders");
      }

      // Schedule the custom reminder
      const jobId = await courseReminderScheduler.scheduleCustomReminder(
        courseId,
        courseType,
        sendDate,
        emailType,
        customMessage
      );

      if (jobId) {
        console.log(`✅ Custom reminder scheduled with job ID: ${jobId}`);
        req.flash(
          "success_message",
          `Custom reminder scheduled successfully for ${sendDate.toLocaleString()}`
        );
      } else {
        console.log(`❌ Failed to schedule custom reminder`);
        req.flash(
          "error_message",
          "Failed to schedule custom reminder. Please check if the course has enrolled students."
        );
      }

      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error scheduling custom reminder:", error);
      req.flash(
        "error_message",
        "Error scheduling custom reminder: " + error.message
      );
      res.redirect("/admin/course-reminders");
    }
  }
);

// ============================================
// SCHEDULE STANDARD REMINDER FOR A COURSE
// ============================================
router.post(
  "/course-reminders/schedule",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { courseId, courseType } = req.body;

      console.log(
        `📅 Scheduling standard reminder for ${courseType}: ${courseId}`
      );

      const jobId = await courseReminderScheduler.scheduleReminderForCourse(
        courseId,
        courseType
      );

      if (jobId) {
        console.log(`✅ Standard reminder scheduled with job ID: ${jobId}`);
        req.flash("success_message", "Course reminder scheduled successfully");
      } else {
        console.log(`❌ Failed to schedule standard reminder`);
        req.flash(
          "error_message",
          "Failed to schedule course reminder. Please check if the course has enrolled students and starts more than 24 hours from now."
        );
      }

      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error scheduling reminder:", error);
      req.flash("error_message", "Error scheduling reminder: " + error.message);
      res.redirect("/admin/course-reminders");
    }
  }
);

// ============================================
// CANCEL SPECIFIC REMINDER
// ============================================
router.post(
  "/course-reminders/cancel",
  isAuthenticated,
  isAdmin,
  (req, res) => {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        req.flash("error_message", "Job ID is required");
        return res.redirect("/admin/course-reminders");
      }

      console.log(`❌ Cancelling reminder: ${jobId}`);

      const cancelled = courseReminderScheduler.cancelReminder(jobId);

      if (cancelled) {
        console.log(`✅ Reminder cancelled: ${jobId}`);
        req.flash("success_message", "Reminder cancelled successfully");
      } else {
        console.log(`⚠️ Reminder not found: ${jobId}`);
        req.flash("error_message", "Reminder not found or already cancelled");
      }

      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error cancelling reminder:", error);
      req.flash("error_message", "Error cancelling reminder: " + error.message);
      res.redirect("/admin/course-reminders");
    }
  }
);

// ============================================
// SCHEDULE ALL UPCOMING REMINDERS
// ============================================
router.post(
  "/course-reminders/schedule-all",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      console.log("📅 Scheduling all upcoming course reminders...");

      const count =
        await courseReminderScheduler.scheduleAllUpcomingReminders();

      console.log(`✅ Scheduled ${count} course reminders`);

      res.json({
        success: true,
        message: `Successfully scheduled ${count} course reminders`,
        count: count,
      });
    } catch (error) {
      console.error("❌ Error scheduling all reminders:", error);
      res.status(500).json({
        success: false,
        message: "Error scheduling reminders: " + error.message,
      });
    }
  }
);

// ============================================
// CANCEL ALL REMINDERS
// ============================================
router.post(
  "/course-reminders/cancel-all",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      console.log("❌ Cancelling all scheduled reminders...");

      const reminders = courseReminderScheduler.getScheduledReminders();
      let cancelledCount = 0;

      reminders.forEach((reminder) => {
        if (courseReminderScheduler.cancelReminder(reminder.jobId)) {
          cancelledCount++;
        }
      });

      console.log(`✅ Cancelled ${cancelledCount} reminders`);

      res.json({
        success: true,
        message: `Successfully cancelled ${cancelledCount} reminders`,
        count: cancelledCount,
      });
    } catch (error) {
      console.error("❌ Error cancelling all reminders:", error);
      res.status(500).json({
        success: false,
        message: "Error cancelling reminders: " + error.message,
      });
    }
  }
);

// ============================================
// API: GET REMINDER STATUS
// ============================================
router.get(
  "/api/course-reminders/status",
  isAuthenticated,
  isAdmin,
  (req, res) => {
    try {
      const status = courseReminderScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error("❌ Error getting reminder status:", error);
      res.status(500).json({
        error: "Failed to get reminder status",
        message: error.message,
      });
    }
  }
);

// ============================================
// API: GET DETAILED STATISTICS
// ============================================
router.get(
  "/api/course-reminders/statistics",
  isAuthenticated,
  isAdmin,
  (req, res) => {
    try {
      const statistics = courseReminderScheduler.getDetailedStatistics();
      res.json(statistics);
    } catch (error) {
      console.error("❌ Error getting detailed statistics:", error);
      res.status(500).json({
        error: "Failed to get statistics",
        message: error.message,
      });
    }
  }
);

// ============================================
// DEBUG: GET ENROLLED USERS FOR COURSE
// ============================================
router.get(
  "/course-reminders/debug/enrolled-users",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { courseId, courseType } = req.query;

      if (!courseId || !courseType) {
        return res.json({ error: "Course ID and type required" });
      }

      const enrolledUsers = await courseReminderScheduler.getEnrolledUsers(
        courseId,
        courseType
      );

      res.json({
        courseId,
        courseType,
        enrolledCount: enrolledUsers.length,
        enrolledUsers: enrolledUsers.map((user) => ({
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phoneNumber,
        })),
      });
    } catch (error) {
      console.error("❌ Error getting enrolled users:", error);
      res.status(500).json({
        error: "Failed to get enrolled users",
        message: error.message,
      });
    }
  }
);

module.exports = router;
