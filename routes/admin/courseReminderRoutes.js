// routes/admin/courseReminderRoutes.js - UPDATED WITH IMMEDIATE SEND

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const courseReminderScheduler = require("../../utils/courseReminderScheduler");
const emailService = require("../../utils/emailService");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const isAdmin = require("../../middlewares/isAdmin");

// Load models
const InPersonAestheticTraining = require("../../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../../models/onlineLiveTrainingModel");
const User = require("../../models/user");

// ============================================
// MAIN DASHBOARD - Load ALL courses and reminders
// ============================================
router.get("/course-reminders", isAuthenticated, isAdmin, async (req, res) => {
  try {
    console.log("📧 Loading course reminders dashboard...");

    // Get current reminders and status
    const reminders = courseReminderScheduler.getScheduledReminders();
    const status = courseReminderScheduler.getStatus();

    // Load ALL courses (not just upcoming ones) for immediate notifications
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    // Get all recent and upcoming in-person courses
    const inPersonCourses = await InPersonAestheticTraining.find({
      "schedule.startDate": {
        $gte: sixMonthsAgo,
        $lte: threeMonthsFromNow,
      },
      "basic.status": { $in: ["open", "full", "in-progress", "completed"] },
    })
      .select("basic schedule enrollment venue instructors")
      .sort({ "schedule.startDate": 1 })
      .lean();

    // Get all recent and upcoming online courses
    const onlineCourses = await OnlineLiveTraining.find({
      "schedule.startDate": {
        $gte: sixMonthsAgo,
        $lte: threeMonthsFromNow,
      },
      "basic.status": { $in: ["open", "full", "in-progress", "completed"] },
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
// NEW: SEND IMMEDIATE NOTIFICATION
// ============================================
router.post(
  "/course-reminders/send-immediate",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const { courseId, courseType, emailType, customMessage, customSubject } =
        req.body;

      console.log(
        `📧 Sending immediate notification for ${courseType}: ${courseId}`
      );
      console.log(`   Email Type: ${emailType}`);
      console.log(`   Custom Subject: ${customSubject ? "Yes" : "No"}`);
      console.log(`   Custom Message: ${customMessage ? "Yes" : "No"}`);

      // Validate required fields
      if (!courseId || !courseType || !emailType) {
        req.flash("error_message", "All required fields must be filled");
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

      // Get course data
      let course;
      if (courseType === "InPersonAestheticTraining") {
        course = await InPersonAestheticTraining.findById(courseId)
          .select("basic schedule enrollment venue instructors")
          .lean();
      } else if (courseType === "OnlineLiveTraining") {
        course = await OnlineLiveTraining.findById(courseId)
          .select("basic schedule enrollment platform instructors technical")
          .lean();
      }

      if (!course) {
        req.flash("error_message", "Course not found");
        return res.redirect("/admin/course-reminders");
      }

      // Get enrolled users
      const enrolledUsers = await courseReminderScheduler.getEnrolledUsers(
        courseId,
        courseType
      );

      if (enrolledUsers.length === 0) {
        req.flash(
          "error_message",
          "No enrolled students found for this course"
        );
        return res.redirect("/admin/course-reminders");
      }

      console.log(`👥 Sending to ${enrolledUsers.length} enrolled students`);

      // Send immediate notifications
      let successCount = 0;
      let failureCount = 0;
      const failedEmails = [];

      for (const user of enrolledUsers) {
        try {
          // Get user's enrollment data
          const enrollment =
            user.getCourseEnrollment?.(courseId, courseType) || {};

          // ✅ FINAL SOLUTION: Check if user has any enrollment at all
          if (!enrollment) {
            console.log(`⚠️ Skipping user ${user.email} - no enrollment found`);
            continue;
          }

          // ✅ For immediate notifications, be very lenient - just check if enrollment exists
          console.log(
            `✅ Processing user ${user.email} - has enrollment, sending email`
          );

          // Send email based on type
          let emailSent = false;
          const isUrgent =
            emailType === "last-minute" || emailType === "urgent-update";

          switch (emailType) {
            case "custom":
              await sendCustomImmediateEmail(
                user,
                course,
                courseType,
                customMessage,
                customSubject,
                isUrgent
              );
              emailSent = true;
              break;

            case "last-minute":
              await sendLastMinuteEmail(
                user,
                course,
                courseType,
                customMessage ||
                  "Important last-minute information about your course.",
                customSubject
              );
              emailSent = true;
              break;

            case "urgent-update":
              await sendUrgentUpdateEmail(
                user,
                course,
                courseType,
                customMessage || "Urgent update regarding your course.",
                customSubject
              );
              emailSent = true;
              break;

            case "tech-check":
              if (courseType === "OnlineLiveTraining") {
                await emailService.sendTechCheckReminder(user, course);
                emailSent = true;
              } else {
                console.log(`⚠️ Tech check not available for ${courseType}`);
                continue;
              }
              break;

            case "preparation":
              await emailService.sendPreparationReminder(
                user,
                course,
                courseType
              );
              emailSent = true;
              break;

            case "course-starting":
            default:
              await emailService.sendCourseStartingReminderEnhanced(
                user,
                course,
                courseType,
                enrollment
              );
              emailSent = true;
              break;
          }

          if (emailSent) {
            successCount++;
            console.log(`✅ Immediate notification sent to ${user.email}`);
          }

          // Small delay between emails to avoid overwhelming SMTP
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(
            `❌ Failed to send immediate notification to ${user.email}:`,
            error
          );
          failureCount++;
          failedEmails.push(user.email);
        }
      }

      // Log the immediate notification in history
      const historyEntry = {
        jobId: `immediate-${emailType}-${courseType}-${courseId}-${Date.now()}`,
        courseId,
        courseType,
        courseName: course.basic?.title || "Unknown Course",
        courseCode: course.basic?.courseCode || "N/A",
        emailType,
        executedAt: new Date(),
        recipientCount: enrolledUsers.length,
        successCount,
        failureCount,
        status: successCount > 0 ? "completed" : "failed",
        isImmediate: true,
        isCustom: emailType === "custom",
        sentBy: req.user._id,
      };

      courseReminderScheduler.reminderHistory.push(historyEntry);

      // Update course reminder history in database
      await updateCourseReminderHistory(courseId, courseType, historyEntry);

      console.log(`✅ Immediate notification batch complete`);
      console.log(`📊 Success: ${successCount}, Failed: ${failureCount}`);

      // Set success/error message
      if (successCount > 0) {
        let message = `Immediate notification sent successfully to ${successCount} students`;
        if (failureCount > 0) {
          message += ` (${failureCount} failed)`;
        }
        req.flash("success_message", message);
      } else {
        req.flash(
          "error_message",
          "Failed to send notifications. Please check the logs."
        );
      }

      res.redirect("/admin/course-reminders");
    } catch (error) {
      console.error("❌ Error sending immediate notification:", error);
      req.flash(
        "error_message",
        "Error sending immediate notification: " + error.message
      );
      res.redirect("/admin/course-reminders");
    }
  }
);

// ============================================
// UPDATED: API EMAIL PREVIEW (Support immediate flag)
// ============================================
router.get(
  "/course-reminders/api/email-preview",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const {
        courseId,
        courseType,
        emailType,
        customMessage,
        customSubject,
        immediate,
      } = req.query;

      if (!courseId || !courseType || !emailType) {
        return res.json({
          success: false,
          error: "Missing required parameters",
        });
      }

      console.log(`📧 Generating email preview for ${courseType}: ${courseId}`);
      console.log(`   Type: ${emailType}${immediate ? " (Immediate)" : ""}`);

      // Get course data
      let course;
      if (courseType === "InPersonAestheticTraining") {
        course = await InPersonAestheticTraining.findById(courseId)
          .select("basic schedule enrollment venue instructors")
          .lean();
      } else if (courseType === "OnlineLiveTraining") {
        course = await OnlineLiveTraining.findById(courseId)
          .select("basic schedule enrollment platform instructors technical")
          .lean();
      }

      if (!course) {
        return res.json({
          success: false,
          error: "Course not found",
        });
      }

      // Get a sample user for preview
      const sampleUser = {
        firstName: "John",
        lastName: "Doe",
        email: "student@example.com",
      };

      // Generate email content based on type
      let emailContent = "";
      let subject = "";

      switch (emailType) {
        case "course-starting":
          try {
            const result = generateCourseStartingEmailContent(
              course,
              courseType,
              sampleUser
            );
            emailContent = result.html;
            subject =
              customSubject && customSubject.trim()
                ? customSubject
                : result.subject;
          } catch (error) {
            console.error("Error generating course starting email:", error);
            return res.json({
              success: false,
              error: "Failed to generate course starting email preview",
            });
          }
          break;

        case "preparation":
          try {
            const prepResult = generatePreparationEmailContent(
              course,
              courseType,
              sampleUser
            );
            emailContent = prepResult.html;
            subject =
              customSubject && customSubject.trim()
                ? customSubject
                : prepResult.subject;
          } catch (error) {
            console.error("Error generating preparation email:", error);
            return res.json({
              success: false,
              error: "Failed to generate preparation email preview",
            });
          }
          break;

        case "tech-check":
          if (courseType === "OnlineLiveTraining") {
            try {
              const techResult = generateTechCheckEmailContent(
                course,
                sampleUser
              );
              emailContent = techResult.html;
              subject =
                customSubject && customSubject.trim()
                  ? customSubject
                  : techResult.subject;
            } catch (error) {
              console.error("Error generating tech check email:", error);
              return res.json({
                success: false,
                error: "Failed to generate tech check email preview",
              });
            }
          } else {
            return res.json({
              success: false,
              error: "Tech check is only available for online courses",
            });
          }
          break;

        case "last-minute":
          try {
            const lastMinuteResult = generateLastMinuteEmailContent(
              course,
              sampleUser,
              customMessage ||
                "Important last-minute information about your course."
            );
            emailContent = lastMinuteResult.html;
            subject =
              customSubject && customSubject.trim()
                ? customSubject
                : lastMinuteResult.subject;
          } catch (error) {
            console.error("Error generating last-minute email:", error);
            return res.json({
              success: false,
              error: "Failed to generate last-minute email preview",
            });
          }
          break;

        case "urgent-update":
          try {
            const urgentResult = generateUrgentUpdateEmailContent(
              course,
              sampleUser,
              customMessage || "Urgent update regarding your course."
            );
            emailContent = urgentResult.html;
            subject =
              customSubject && customSubject.trim()
                ? customSubject
                : urgentResult.subject;
          } catch (error) {
            console.error("Error generating urgent update email:", error);
            return res.json({
              success: false,
              error: "Failed to generate urgent update email preview",
            });
          }
          break;

        case "custom":
          if (!customMessage || customMessage.trim() === "") {
            return res.json({
              success: false,
              error: "Custom message is required",
            });
          }
          try {
            const customResult = generateCustomEmailContent(
              course,
              sampleUser,
              customMessage
            );
            emailContent = customResult.html;
            subject =
              customSubject && customSubject.trim()
                ? customSubject
                : customResult.subject;
          } catch (error) {
            console.error("Error generating custom email:", error);
            return res.json({
              success: false,
              error: "Failed to generate custom email preview",
            });
          }
          break;

        default:
          return res.json({
            success: false,
            error: "Invalid email type",
          });
      }

      res.json({
        success: true,
        preview: {
          subject: subject,
          html: emailContent,
          emailType: emailType + (immediate ? " (Immediate)" : ""),
          courseName: course.basic?.title || "Unknown Course",
          sampleRecipient: "John Doe (student@example.com)",
        },
      });
    } catch (error) {
      console.error("❌ Error generating email preview:", error);
      res.json({
        success: false,
        error: error.message,
      });
    }
  }
);

// ============================================
// HELPER FUNCTIONS FOR IMMEDIATE EMAILS
// ============================================

// Send custom immediate email
async function sendCustomImmediateEmail(
  user,
  course,
  courseType,
  customMessage,
  customSubject,
  isUrgent = false
) {
  const courseTitle = course.basic?.title || course.title;
  const priority = isUrgent ? "high" : "normal";

  const subject =
    customSubject && customSubject.trim()
      ? customSubject
      : `Important Message: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${
          isUrgent ? "#dc2626" : "#3b82f6"
        }; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .message-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid ${
          isUrgent ? "#dc2626" : "#3b82f6"
        }; }
        .urgent-badge { background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${isUrgent ? '<div class="urgent-badge">🚨 URGENT MESSAGE</div>' : ""}
          <h1>📢 Course Message</h1>
        </div>
        <div class="content">
          <h2>${courseTitle}</h2>
          <p>Dear ${user.firstName},</p>
          
          <div class="message-box">
            ${customMessage.replace(/\n/g, "<br>")}
          </div>
          
          <p>If you have any questions about this message, please feel free to contact us.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await emailService.sendEmail({
    to: user.email,
    subject: subject,
    html: html,
    priority: priority,
    headers: isUrgent ? { "X-Priority": "1" } : {},
  });
}

// Send last-minute email
async function sendLastMinuteEmail(
  user,
  course,
  courseType,
  message,
  customSubject
) {
  const courseTitle = course.basic?.title || course.title;
  const subject =
    customSubject && customSubject.trim()
      ? customSubject
      : `URGENT: Last Minute Update - ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .urgent-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .urgent-badge { background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="urgent-badge">🚨 LAST MINUTE UPDATE</div>
          <h1>Important Course Information</h1>
        </div>
        <div class="content">
          <h2>${courseTitle}</h2>
          <p>Dear ${user.firstName},</p>
          
          <div class="urgent-box">
            <h3 style="color: #dc2626; margin-top: 0;">⚠️ Last Minute Information</h3>
            <p style="margin-bottom: 0;">${message}</p>
          </div>
          
          <p><strong>Please take note of this information as it affects your upcoming course.</strong></p>
          
          <p>If you have any questions, please contact us immediately.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await emailService.sendEmail({
    to: user.email,
    subject: subject,
    html: html,
    priority: "high",
    headers: { "X-Priority": "1" },
  });
}

// Send urgent update email
async function sendUrgentUpdateEmail(
  user,
  course,
  courseType,
  message,
  customSubject
) {
  const courseTitle = course.basic?.title || course.title;
  const subject =
    customSubject && customSubject.trim()
      ? customSubject
      : `IMPORTANT UPDATE: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .update-box { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .urgent-badge { background: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="urgent-badge">⚠️ URGENT UPDATE</div>
          <h1>Course Update</h1>
        </div>
        <div class="content">
          <h2>${courseTitle}</h2>
          <p>Dear ${user.firstName},</p>
          
          <div class="update-box">
            <h3 style="color: #92400e; margin-top: 0;">📢 Important Update</h3>
            <p style="margin-bottom: 0;">${message}</p>
          </div>
          
          <p>Please review this update carefully as it may affect your course participation.</p>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await emailService.sendEmail({
    to: user.email,
    subject: subject,
    html: html,
    priority: "high",
    headers: { "X-Priority": "2" },
  });
}

// Generate last-minute email content for preview
function generateLastMinuteEmailContent(course, user, message) {
  const courseTitle = course.basic?.title || course.title;
  const subject = `URGENT: Last Minute Update - ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .urgent-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .urgent-badge { background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="urgent-badge">🚨 LAST MINUTE UPDATE</div>
          <h1>Important Course Information</h1>
        </div>
        <div class="content">
          <h2>${courseTitle}</h2>
          <p>Dear ${user.firstName},</p>
          
          <div class="urgent-box">
            <h3 style="color: #dc2626; margin-top: 0;">⚠️ Last Minute Information</h3>
            <p style="margin-bottom: 0;">${message}</p>
          </div>
          
          <p><strong>Please take note of this information as it affects your upcoming course.</strong></p>
          
          <p>If you have any questions, please contact us immediately.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

// Generate urgent update email content for preview
function generateUrgentUpdateEmailContent(course, user, message) {
  const courseTitle = course.basic?.title || course.title;
  const subject = `IMPORTANT UPDATE: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .update-box { background: #fffbeb; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .urgent-badge { background: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="urgent-badge">⚠️ URGENT UPDATE</div>
          <h1>Course Update</h1>
        </div>
        <div class="content">
          <h2>${courseTitle}</h2>
          <p>Dear ${user.firstName},</p>
          
          <div class="update-box">
            <h3 style="color: #92400e; margin-top: 0;">📢 Important Update</h3>
            <p style="margin-bottom: 0;">${message}</p>
          </div>
          
          <p>Please review this update carefully as it may affect your course participation.</p>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

// Update course reminder history in database
async function updateCourseReminderHistory(courseId, courseType, historyEntry) {
  try {
    let CourseModel;
    if (courseType === "InPersonAestheticTraining") {
      CourseModel = InPersonAestheticTraining;
    } else if (courseType === "OnlineLiveTraining") {
      CourseModel = OnlineLiveTraining;
    } else {
      return;
    }

    const course = await CourseModel.findById(courseId);
    if (course && typeof course.addReminderToHistory === "function") {
      await course.addReminderToHistory({
        type: historyEntry.emailType || "course-starting",
        recipientCount: historyEntry.recipientCount,
        successCount: historyEntry.successCount,
        failureCount: historyEntry.failureCount,
        isImmediate: historyEntry.isImmediate || false,
        sentBy: historyEntry.sentBy || null,
      });
      console.log(`✅ Updated reminder history for course ${courseId}`);
    }
  } catch (error) {
    console.error(
      `❌ Error updating course reminder history for ${courseId}:`,
      error
    );
  }
}

// ============================================
// EXISTING ROUTES (KEEP ALL UNCHANGED)
// ============================================

// API: GET COURSE DATA FOR SELECTED COURSE
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

// SCHEDULE CUSTOM REMINDER WITH MODIFICATIONS SUPPORT
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
        modifiedEmailContent,
        modifiedEmailSubject,
      } = req.body;

      console.log(
        `📅 Scheduling custom reminder for ${courseType}: ${courseId}`
      );
      console.log(`   Reminder Type: ${reminderType}`);
      console.log(`   Email Type: ${emailType}`);

      // Check if email content was modified
      const hasModifiedContent =
        modifiedEmailContent && modifiedEmailContent.trim();
      const hasModifiedSubject =
        modifiedEmailSubject && modifiedEmailSubject.trim();

      if (hasModifiedContent || hasModifiedSubject) {
        console.log(`📝 Using modified email content`);
        console.log(
          `   Modified Subject: ${hasModifiedSubject ? "Yes" : "No"}`
        );
        console.log(
          `   Modified Content: ${hasModifiedContent ? "Yes" : "No"}`
        );
      }

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

      // Validate custom message if email type is custom and no modified content
      if (
        emailType === "custom" &&
        !hasModifiedContent &&
        (!customMessage || customMessage.trim() === "")
      ) {
        req.flash(
          "error_message",
          "Custom message is required for custom email type"
        );
        return res.redirect("/admin/course-reminders");
      }

      // Prepare email customization data
      const emailCustomization = {};
      if (hasModifiedContent) {
        emailCustomization.customHtml = modifiedEmailContent;
      }
      if (hasModifiedSubject) {
        emailCustomization.customSubject = modifiedEmailSubject;
      }
      if (customMessage && customMessage.trim()) {
        emailCustomization.customMessage = customMessage;
      }

      // Choose the appropriate scheduling method
      let jobId;
      if (Object.keys(emailCustomization).length > 0) {
        // Use the new method with modifications
        jobId =
          await courseReminderScheduler.scheduleCustomReminderWithModifications(
            courseId,
            courseType,
            sendDate,
            emailType,
            emailCustomization
          );
      } else {
        // Use the existing method for backward compatibility
        jobId = await courseReminderScheduler.scheduleCustomReminder(
          courseId,
          courseType,
          sendDate,
          emailType,
          customMessage
        );
      }

      if (jobId) {
        console.log(`✅ Custom reminder scheduled with job ID: ${jobId}`);

        let successMessage = `Custom reminder scheduled successfully for ${sendDate.toLocaleString()}`;
        if (hasModifiedContent || hasModifiedSubject) {
          successMessage += " with custom email content";
        }

        req.flash("success_message", successMessage);
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

// SCHEDULE STANDARD REMINDER FOR A COURSE
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

// CANCEL SPECIFIC REMINDER
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

// SCHEDULE ALL UPCOMING REMINDERS
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

// CANCEL ALL REMINDERS
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

// API: GET REMINDER STATUS
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

// API: GET DETAILED STATISTICS
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

// DEBUG: GET ENROLLED USERS FOR COURSE
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

// ============================================
// EMAIL GENERATION HELPER FUNCTIONS
// ============================================

// Helper function to generate course starting email content
function generateCourseStartingEmailContent(course, courseType, user) {
  const startDate = new Date(course.schedule?.startDate || course.startDate);
  const isOnline = courseType === "OnlineLiveTraining";
  const courseTitle = course.basic?.title || course.title;
  const courseCode = course.basic?.courseCode || course.courseCode;

  const now = new Date();
  const timeUntilStart = startDate.getTime() - now.getTime();
  const hoursUntilStart = Math.ceil(timeUntilStart / (1000 * 60 * 60));

  const subject = `${
    hoursUntilStart <= 24 ? "Starting Tomorrow" : "Starting Soon"
  }: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .countdown { background: #dc2626; color: white; padding: 12px 20px; border-radius: 25px; font-weight: bold; display: inline-block; margin: 10px 0; }
        .course-details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0; }
        .button { display: inline-block; padding: 14px 28px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 8px; }
        .checklist { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 30px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="countdown">
            ⏰ ${
              hoursUntilStart <= 24
                ? "STARTS TOMORROW"
                : `STARTS IN ${Math.ceil(hoursUntilStart / 24)} DAYS`
            }
          </div>
          <h1>Course Reminder</h1>
          <p style="margin: 0; font-size: 18px; opacity: 0.9;">${courseTitle}</p>
        </div>
        
        <div class="content">
          <h2>Dear ${user.firstName},</h2>
          
          <p>This is your reminder that <strong>${courseTitle}</strong> is starting soon!</p>

          <div class="course-details">
            <h3>📋 Course Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 12px 0; width: 140px; font-weight: 600;">📅 Date:</td>
                <td>${startDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600;">🕐 Time:</td>
                <td>${startDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600;">📚 Course Code:</td>
                <td><strong>${courseCode || "N/A"}</strong></td>
              </tr>
              <tr>
                <td style="padding: 12px 0; font-weight: 600;">👨‍🏫 Type:</td>
                <td>${
                  isOnline ? "Online Live Training" : "In-Person Training"
                }</td>
              </tr>
            </table>
          </div>

          ${
            isOnline
              ? `
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h4 style="margin: 0 0 16px 0; color: #1e40af;">💻 Online Session Information</h4>
              <p><strong>Platform:</strong> ${
                course.platform?.name || "Details will be provided"
              }</p>
              ${
                course.platform?.accessUrl
                  ? `<p><strong>Join Link:</strong> <a href="${course.platform.accessUrl}" style="color: #1e40af;">Click here to join</a></p>`
                  : "<p><strong>Join Link:</strong> Will be sent 30 minutes before session</p>"
              }
            </div>
          `
              : `
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 30px 0; border-radius: 0 8px 8px 0;">
              <h4 style="margin: 0 0 16px 0; color: #065f46;">🏢 Venue Information</h4>
              <p><strong>Location:</strong> ${
                course.venue?.name || "Details in your course materials"
              }</p>
              ${
                course.venue?.address
                  ? `<p><strong>Address:</strong> ${course.venue.address}</p>`
                  : ""
              }
              <p><strong>Arrival:</strong> Please arrive 15-20 minutes early</p>
            </div>
          `
          }

          <div class="checklist">
            <h3>✅ Final Preparation Checklist</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
              ${
                isOnline
                  ? `
                <div>
                  <h4>Technical:</h4>
                  <ul>
                    <li>☐ Internet connection tested</li>
                    <li>☐ Camera and mic working</li>
                    <li>☐ Platform software ready</li>
                    <li>☐ Quiet space prepared</li>
                  </ul>
                </div>
              `
                  : `
                <div>
                  <h4>Travel & Arrival:</h4>
                  <ul>
                    <li>☐ Route planned</li>
                    <li>☐ Travel time calculated</li>
                    <li>☐ ID and materials ready</li>
                    <li>☐ Appropriate attire chosen</li>
                  </ul>
                </div>
              `
              }
              <div>
                <h4>Learning Preparation:</h4>
                <ul>
                  <li>☐ Course materials reviewed</li>
                  <li>☐ Questions prepared</li>
                  <li>☐ Notebook and pen ready</li>
                  <li>☐ Positive mindset activated!</li>
                </ul>
              </div>
            </div>
          </div>

          <center>
            <a href="${
              process.env.BASE_URL || ""
            }/library" class="button">View Course Details</a>
            ${
              isOnline && course.platform?.accessUrl
                ? `<a href="${course.platform.accessUrl}" class="button" style="background: #10b981;">Join Online Session</a>`
                : ""
            }
          </center>

          <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
            <p style="margin: 0; color: #1e40af; font-weight: 600;">
              🌟 We're excited to see you ${
                hoursUntilStart <= 24 ? "tomorrow" : "soon"
              }! Come ready to learn and grow.
            </p>
          </div>

          <div style="border-top: 1px solid #e5e7eb; padding-top: 30px; margin-top: 40px;">
            <h4>📞 Need Help?</h4>
            <p style="font-size: 14px;">
              📧 Email: <a href="mailto:support@iaai-institute.com">support@iaai-institute.com</a><br>
              🌐 Support: <a href="${
                process.env.BASE_URL || ""
              }/contact-us">Contact Us</a>
            </p>
          </div>

          <p>Best regards,<br>IAAI Training Institute</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

// Helper function to generate preparation email content
function generatePreparationEmailContent(course, courseType, user) {
  const startDate = new Date(course.schedule?.startDate || course.startDate);
  const isOnline = courseType === "OnlineLiveTraining";
  const courseTitle = course.basic?.title || course.title;

  const subject = `Preparation Instructions: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .prep-section { background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        .checklist { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 30px 0; }
        .button { display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📚 Course Preparation</h1>
          <p style="margin: 0; font-size: 18px; opacity: 0.9;">${courseTitle}</p>
        </div>
        
        <div class="content">
          <h2>Dear ${user.firstName},</h2>
          <p>Your course starts on ${startDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}. Please review these preparation instructions:</p>

          <div class="prep-section">
            <h3>📋 Pre-Course Requirements</h3>
            ${
              isOnline
                ? `
              <h4>🖥️ Technical Preparation:</h4>
              <ul>
                <li>Test your internet connection (minimum 10 Mbps recommended)</li>
                <li>Ensure your camera and microphone are working</li>
                <li>Download and test the platform software</li>
                <li>Find a quiet, well-lit space for the session</li>
              </ul>
            `
                : `
              <h4>🏢 In-Person Preparation:</h4>
              <ul>
                <li>Plan your route to the venue in advance</li>
                <li>Bring required identification</li>
                <li>Arrive 15-20 minutes early for registration</li>
                <li>Dress according to course requirements</li>
              </ul>
            `
            }
            
            <h4>📚 Study Materials:</h4>
            <ul>
              <li>Review any pre-course materials in your library</li>
              <li>Prepare questions you'd like to ask</li>
              <li>Bring notebook and pen for notes</li>
            </ul>
          </div>

          <center>
            <a href="${
              process.env.BASE_URL || ""
            }/library" class="button">Access Course Materials</a>
          </center>

          <p>We're looking forward to seeing you in the course. If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

// Helper function to generate tech check email content
function generateTechCheckEmailContent(course, user) {
  const courseTitle = course.basic?.title || course.title;
  const subject = `Technical Check Required: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .tech-box { background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 24px; margin: 30px 0; }
        .requirements { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 30px 0; }
        .button { display: inline-block; padding: 14px 28px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .urgent { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔧 Technical Check Required</h1>
          <p style="margin: 0; font-size: 18px; opacity: 0.9;">Online Course Preparation</p>
        </div>
        
        <div class="content">
          <h2>Dear ${user.firstName},</h2>
          
          <div class="urgent">
            <h3>⚠️ Action Required</h3>
            <p>Your online course <strong>${courseTitle}</strong> starts soon. Please complete your technical check to ensure a smooth learning experience.</p>
          </div>

          <div class="tech-box">
            <h3>🖥️ Technical Check Session</h3>
            <p><strong>Platform:</strong> ${
              course.platform?.name || "Will be provided"
            }</p>
            <p><strong>Course Start:</strong> ${new Date(
              course.schedule?.startDate
            ).toLocaleDateString()}</p>
          </div>

          <center>
            <a href="${
              process.env.BASE_URL || ""
            }/library" class="button">Access Course Platform</a>
          </center>

          <p>Completing this check ensures you'll be ready to focus on learning when the course begins!</p>
          <p>Best regards,<br>IAAI Technical Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

// Helper function to generate custom email content
function generateCustomEmailContent(course, user, customMessage) {
  const courseTitle = course.basic?.title || course.title;
  const subject = `Important Update: ${courseTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .message-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #3b82f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📢 Course Update</h1>
        </div>
        <div class="content">
          <h2>${courseTitle}</h2>
          <p>Dear ${user.firstName},</p>
          
          <div class="message-box">
            ${customMessage.replace(/\n/g, "<br>")}
          </div>
          
          <p>If you have any questions about this update, please feel free to contact us.</p>
          <p>Best regards,<br>IAAI Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { html, subject };
}

module.exports = router;
