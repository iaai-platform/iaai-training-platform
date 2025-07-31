// utils/courseReminderScheduler.js - COMPLETE ENHANCED VERSION

const schedule = require("node-schedule");
const mongoose = require("mongoose");

// Models
const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const emailService = require("./emailService");

class CourseReminderScheduler {
  constructor() {
    this.scheduledReminders = new Map();
    this.isShuttingDown = false;
    this.reminderHistory = []; // Track sent reminders for reporting
    this.startupTime = new Date();

    // Performance tracking
    this.stats = {
      totalScheduled: 0,
      totalExecuted: 0,
      totalEmailsSent: 0,
      totalEmailsFailed: 0,
      lastCleanup: new Date(),
    };

    console.log("📧 Course Reminder Scheduler initialized");
  }

  // ============================================
  // CORE REMINDER SCHEDULING
  // ============================================

  /**
   * Schedule reminder for a specific course (24 hours before start)
   * @param {string} courseId - Course ID
   * @param {string} courseType - Course type (InPersonAestheticTraining or OnlineLiveTraining)
   * @returns {string|null} Job ID if successful, null if failed
   */
  async scheduleReminderForCourse(courseId, courseType) {
    try {
      console.log(
        `📅 Scheduling reminder for ${courseType} course: ${courseId}`
      );

      // Validate input
      if (!courseId || !courseType) {
        console.error("❌ Course ID and type are required");
        return null;
      }

      // Get course data
      let course;
      try {
        if (courseType === "InPersonAestheticTraining") {
          course = await InPersonAestheticTraining.findById(courseId)
            .select("basic schedule enrollment venue instructors")
            .lean();
        } else if (courseType === "OnlineLiveTraining") {
          course = await OnlineLiveTraining.findById(courseId)
            .select("basic schedule enrollment platform instructors")
            .lean();
        } else {
          console.log(
            `⚠️ Reminders not supported for course type: ${courseType}`
          );
          return null;
        }
      } catch (dbError) {
        console.error(
          `❌ Database error fetching course ${courseId}:`,
          dbError
        );
        return null;
      }

      if (!course) {
        console.error(`❌ Course not found: ${courseId}`);
        return null;
      }

      // Validate course data
      if (!course.schedule?.startDate) {
        console.error(`❌ Course ${courseId} missing start date`);
        return null;
      }

      const startDate = new Date(course.schedule.startDate);
      if (isNaN(startDate.getTime())) {
        console.error(`❌ Invalid start date for course: ${courseId}`);
        return null;
      }

      // Check if course is eligible for reminders
      const now = new Date();
      if (startDate <= now) {
        console.log(
          `⚠️ Cannot schedule reminder for course ${courseId} - already started`
        );
        return null;
      }

      // Calculate reminder date (24 hours before)
      const reminderDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

      if (reminderDate <= now) {
        console.log(
          `⚠️ Cannot schedule reminder for course ${courseId} - starts too soon`
        );
        return null;
      }

      // Get enrolled users
      const enrolledUsers = await this.getEnrolledUsers(courseId, courseType);

      if (enrolledUsers.length === 0) {
        console.log(`📧 No enrolled users found for course: ${courseId}`);
        return null;
      }

      // Create job ID
      const jobId = `reminder-${courseType}-${courseId}-${Date.now()}`;

      // Cancel existing reminder if any
      this.cancelReminderForCourse(courseId, courseType);

      // Schedule the reminder
      const job = schedule.scheduleJob(reminderDate, async () => {
        if (this.isShuttingDown) {
          console.log(
            `⚠️ Skipping reminder execution - system shutting down: ${jobId}`
          );
          return;
        }

        console.log(
          `📧 Executing reminder job for course: ${
            course.basic?.title || course.title
          }`
        );

        try {
          const result = await this.sendRemindersToUsers(
            course,
            courseType,
            enrolledUsers
          );

          // Track in history
          const historyEntry = {
            jobId,
            courseId,
            courseType,
            courseName: course.basic?.title || course.title,
            courseCode: course.basic?.courseCode || "N/A",
            executedAt: new Date(),
            recipientCount: enrolledUsers.length,
            successCount: result.successCount,
            failureCount: result.failureCount,
            status: result.successCount > 0 ? "completed" : "failed",
            emailType: "course-starting",
            isCustom: false,
          };

          this.reminderHistory.push(historyEntry);
          this.stats.totalExecuted++;
          this.stats.totalEmailsSent += result.successCount;
          this.stats.totalEmailsFailed += result.failureCount;

          // Update course reminder history
          await this.updateCourseReminderHistory(
            courseId,
            courseType,
            historyEntry
          );

          console.log(
            `✅ Reminder execution completed for ${
              course.basic?.title || course.title
            }`
          );
        } catch (executionError) {
          console.error(
            `❌ Error executing reminder ${jobId}:`,
            executionError
          );

          // Still track the failed execution
          this.reminderHistory.push({
            jobId,
            courseId,
            courseType,
            courseName: course.basic?.title || course.title,
            executedAt: new Date(),
            recipientCount: enrolledUsers.length,
            successCount: 0,
            failureCount: enrolledUsers.length,
            status: "failed",
            error: executionError.message,
          });
        }

        // Remove from scheduled reminders
        this.scheduledReminders.delete(jobId);
      });

      if (!job) {
        console.error(
          `❌ Failed to create scheduled job for course ${courseId}`
        );
        return null;
      }

      // Store reminder info
      this.scheduledReminders.set(jobId, {
        job,
        courseId,
        courseType,
        courseName: course.basic?.title || course.title,
        courseCode: course.basic?.courseCode || "N/A",
        reminderDate,
        userCount: enrolledUsers.length,
        status: "scheduled",
        createdAt: new Date(),
        emailType: "course-starting",
        isCustom: false,
      });

      this.stats.totalScheduled++;

      console.log(
        `✅ Reminder scheduled for ${course.basic?.title || course.title}`
      );
      console.log(`📅 Will send on: ${reminderDate.toLocaleString()}`);
      console.log(`👥 Recipients: ${enrolledUsers.length} users`);

      return jobId;
    } catch (error) {
      console.error(
        `❌ Error scheduling reminder for course ${courseId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Schedule custom reminder with specific date and message type
   * @param {string} courseId - Course ID
   * @param {string} courseType - Course type
   * @param {Date} sendDate - When to send the reminder
   * @param {string} emailType - Type of email (course-starting, preparation, tech-check, custom)
   * @param {string} customMessage - Custom message (for custom email type)
   * @returns {string|null} Job ID if successful, null if failed
   */
  async scheduleCustomReminder(
    courseId,
    courseType,
    sendDate,
    emailType = "course-starting",
    customMessage = null
  ) {
    try {
      console.log(
        `📅 Scheduling custom reminder for ${courseType} course: ${courseId}`
      );
      console.log(`   Email Type: ${emailType}`);
      console.log(`   Send Date: ${sendDate.toLocaleString()}`);

      // Validate input
      if (!courseId || !courseType || !sendDate || !emailType) {
        console.error("❌ All parameters are required for custom reminder");
        return null;
      }

      // Get course data
      let course;
      try {
        if (courseType === "InPersonAestheticTraining") {
          course = await InPersonAestheticTraining.findById(courseId)
            .select("basic schedule enrollment venue instructors")
            .lean();
        } else if (courseType === "OnlineLiveTraining") {
          course = await OnlineLiveTraining.findById(courseId)
            .select("basic schedule enrollment platform instructors technical")
            .lean();
        } else {
          console.log(
            `⚠️ Custom reminders not supported for course type: ${courseType}`
          );
          return null;
        }
      } catch (dbError) {
        console.error(
          `❌ Database error fetching course ${courseId}:`,
          dbError
        );
        return null;
      }

      if (!course) {
        console.error(`❌ Course not found: ${courseId}`);
        return null;
      }

      // Validate send date
      const now = new Date();
      if (sendDate <= now) {
        console.error(`❌ Send date must be in the future`);
        return null;
      }

      // Validate custom message if required
      if (
        emailType === "custom" &&
        (!customMessage || customMessage.trim() === "")
      ) {
        console.error(`❌ Custom message is required for email type 'custom'`);
        return null;
      }

      // Get enrolled users
      const enrolledUsers = await this.getEnrolledUsers(courseId, courseType);

      if (enrolledUsers.length === 0) {
        console.log(`📧 No enrolled users found for course: ${courseId}`);
        return null;
      }

      // Create job ID for custom reminder
      const jobId = `custom-${emailType}-${courseType}-${courseId}-${Date.now()}`;

      // Schedule the custom reminder
      const job = schedule.scheduleJob(sendDate, async () => {
        if (this.isShuttingDown) {
          console.log(
            `⚠️ Skipping custom reminder execution - system shutting down: ${jobId}`
          );
          return;
        }

        console.log(
          `📧 Executing custom ${emailType} reminder for: ${
            course.basic?.title || course.title
          }`
        );

        try {
          const result = await this.sendCustomRemindersToUsers(
            course,
            courseType,
            enrolledUsers,
            emailType,
            customMessage
          );

          // Track in history
          const historyEntry = {
            jobId,
            courseId,
            courseType,
            courseName: course.basic?.title || course.title,
            courseCode: course.basic?.courseCode || "N/A",
            emailType,
            customMessage: customMessage ? "Yes" : "No",
            executedAt: new Date(),
            recipientCount: enrolledUsers.length,
            successCount: result.successCount,
            failureCount: result.failureCount,
            status: result.successCount > 0 ? "completed" : "failed",
            isCustom: true,
          };

          this.reminderHistory.push(historyEntry);
          this.stats.totalExecuted++;
          this.stats.totalEmailsSent += result.successCount;
          this.stats.totalEmailsFailed += result.failureCount;

          // Update course reminder history
          await this.updateCourseReminderHistory(
            courseId,
            courseType,
            historyEntry
          );

          console.log(
            `✅ Custom reminder execution completed for ${
              course.basic?.title || course.title
            }`
          );
        } catch (executionError) {
          console.error(
            `❌ Error executing custom reminder ${jobId}:`,
            executionError
          );

          // Track failed execution
          this.reminderHistory.push({
            jobId,
            courseId,
            courseType,
            courseName: course.basic?.title || course.title,
            emailType,
            executedAt: new Date(),
            recipientCount: enrolledUsers.length,
            successCount: 0,
            failureCount: enrolledUsers.length,
            status: "failed",
            error: executionError.message,
            isCustom: true,
          });
        }

        // Remove from scheduled reminders
        this.scheduledReminders.delete(jobId);
      });

      if (!job) {
        console.error(
          `❌ Failed to create custom scheduled job for course ${courseId}`
        );
        return null;
      }

      // Store reminder info
      this.scheduledReminders.set(jobId, {
        job,
        courseId,
        courseType,
        courseName: course.basic?.title || course.title,
        courseCode: course.basic?.courseCode || "N/A",
        reminderDate: sendDate,
        userCount: enrolledUsers.length,
        emailType,
        customMessage: customMessage
          ? "Custom message included"
          : "Standard template",
        status: "scheduled",
        createdAt: new Date(),
        isCustom: true,
      });

      this.stats.totalScheduled++;

      console.log(
        `✅ Custom reminder scheduled for ${
          course.basic?.title || course.title
        }`
      );
      console.log(`📧 Email type: ${emailType}`);
      console.log(`📅 Will send on: ${sendDate.toLocaleString()}`);
      console.log(`👥 Recipients: ${enrolledUsers.length} users`);

      return jobId;
    } catch (error) {
      console.error(
        `❌ Error scheduling custom reminder for course ${courseId}:`,
        error
      );
      return null;
    }
  }

  // ============================================
  // EMAIL SENDING METHODS
  // ============================================

  /**
   * Send standard reminders to all enrolled users
   * @param {Object} course - Course data
   * @param {string} courseType - Course type
   * @param {Array} enrolledUsers - List of enrolled users
   * @returns {Object} Success and failure counts
   */
  async sendRemindersToUsers(course, courseType, enrolledUsers) {
    let successCount = 0;
    let failureCount = 0;

    console.log(
      `📧 Sending reminders to ${enrolledUsers.length} users for: ${
        course.basic?.title || course.title
      }`
    );

    for (const user of enrolledUsers) {
      try {
        // Get user's enrollment data
        const enrollment =
          user.getCourseEnrollment?.(course._id, courseType) || {};

        if (
          !enrollment ||
          !["paid", "registered"].includes(enrollment.enrollmentData?.status)
        ) {
          console.log(`⚠️ Skipping user ${user.email} - not properly enrolled`);
          continue;
        }

        // Send email based on course type
        let emailSent = false;

        if (typeof emailService.sendCourseStartingReminder === "function") {
          await emailService.sendCourseStartingReminder(
            user,
            course,
            courseType,
            enrollment
          );
          emailSent = true;
        } else {
          // Fallback to generic email sending
          console.warn(
            "⚠️ emailService.sendCourseStartingReminder not found, using fallback"
          );
          await this.sendFallbackEmail(user, course, courseType);
          emailSent = true;
        }

        if (emailSent) {
          successCount++;
          console.log(`✅ Reminder sent to ${user.email}`);
        }

        // Small delay between emails to avoid overwhelming the email service
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to send reminder to ${user.email}:`, error);
        failureCount++;
      }
    }

    console.log(
      `✅ Reminder batch complete for ${course.basic?.title || course.title}`
    );
    console.log(`📊 Success: ${successCount}, Failed: ${failureCount}`);

    return { successCount, failureCount };
  }

  /**
   * Send custom reminders to all enrolled users
   * @param {Object} course - Course data
   * @param {string} courseType - Course type
   * @param {Array} enrolledUsers - List of enrolled users
   * @param {string} emailType - Type of email
   * @param {string} customMessage - Custom message (if applicable)
   * @returns {Object} Success and failure counts
   */
  async sendCustomRemindersToUsers(
    course,
    courseType,
    enrolledUsers,
    emailType,
    customMessage
  ) {
    let successCount = 0;
    let failureCount = 0;

    console.log(
      `📧 Sending custom ${emailType} reminders to ${
        enrolledUsers.length
      } users for: ${course.basic?.title || course.title}`
    );

    for (const user of enrolledUsers) {
      try {
        // Get user's enrollment data
        const enrollment =
          user.getCourseEnrollment?.(course._id, courseType) || {};

        if (
          !enrollment ||
          !["paid", "registered"].includes(enrollment.enrollmentData?.status)
        ) {
          console.log(`⚠️ Skipping user ${user.email} - not properly enrolled`);
          continue;
        }

        let emailSent = false;

        // Send different types of emails based on emailType
        switch (emailType) {
          case "custom":
            if (
              customMessage &&
              typeof emailService.sendCustomCourseMessage === "function"
            ) {
              await emailService.sendCustomCourseMessage(
                user,
                course,
                customMessage
              );
              emailSent = true;
            } else {
              await this.sendFallbackEmail(
                user,
                course,
                courseType,
                customMessage
              );
              emailSent = true;
            }
            break;

          case "tech-check":
            if (
              courseType === "OnlineLiveTraining" &&
              typeof emailService.sendTechCheckReminder === "function"
            ) {
              await emailService.sendTechCheckReminder(user, course);
              emailSent = true;
            } else {
              await this.sendFallbackEmail(
                user,
                course,
                courseType,
                "Please ensure you have completed the technical check for the upcoming online course."
              );
              emailSent = true;
            }
            break;

          case "preparation":
            if (typeof emailService.sendPreparationReminder === "function") {
              await emailService.sendPreparationReminder(
                user,
                course,
                courseType
              );
              emailSent = true;
            } else {
              await this.sendFallbackEmail(
                user,
                course,
                courseType,
                "Please review the preparation materials for your upcoming course."
              );
              emailSent = true;
            }
            break;

          case "course-starting":
          default:
            if (typeof emailService.sendCourseStartingReminder === "function") {
              await emailService.sendCourseStartingReminder(
                user,
                course,
                courseType,
                enrollment
              );
              emailSent = true;
            } else {
              await this.sendFallbackEmail(user, course, courseType);
              emailSent = true;
            }
            break;
        }

        if (emailSent) {
          successCount++;
          console.log(`✅ Custom ${emailType} reminder sent to ${user.email}`);
        }

        // Small delay between emails
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(
          `❌ Failed to send custom reminder to ${user.email}:`,
          error
        );
        failureCount++;
      }
    }

    console.log(
      `✅ Custom reminder batch complete for ${
        course.basic?.title || course.title
      }`
    );
    console.log(`📊 Success: ${successCount}, Failed: ${failureCount}`);

    return { successCount, failureCount };
  }

  /**
   * Fallback email sending method when emailService methods are not available
   * @param {Object} user - User object
   * @param {Object} course - Course object
   * @param {string} courseType - Course type
   * @param {string} customMessage - Optional custom message
   */
  async sendFallbackEmail(user, course, courseType, customMessage = null) {
    try {
      const subject = customMessage
        ? `Important Update: ${course.basic?.title || course.title}`
        : `Reminder: ${course.basic?.title || course.title} starts soon!`;

      const message =
        customMessage ||
        `Hello ${user.firstName},\n\nThis is a reminder that your course "${
          course.basic?.title || course.title
        }" is starting soon.\n\nPlease make sure you're prepared.\n\nBest regards,\nIAAI Training Institute`;

      // If emailService has a basic sendEmail method, use it
      if (typeof emailService.sendEmail === "function") {
        await emailService.sendEmail({
          to: user.email,
          subject: subject,
          text: message,
          html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
        });
      } else {
        console.warn(
          `⚠️ No email service available - would send email to ${user.email}: ${subject}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Fallback email sending failed for ${user.email}:`,
        error
      );
      throw error;
    }
  }

  // ============================================
  // USER ENROLLMENT METHODS
  // ============================================

  /**
   * Get enrolled users for a course with improved query
   * @param {string} courseId - Course ID
   * @param {string} courseType - Course type
   * @returns {Array} Array of enrolled users
   */
  async getEnrolledUsers(courseId, courseType) {
    try {
      console.log(
        `🔍 Getting enrolled users for ${courseType} course: ${courseId}`
      );

      let users = [];
      const courseObjectId = new mongoose.Types.ObjectId(courseId);

      if (courseType === "InPersonAestheticTraining") {
        users = await User.find({
          myInPersonCourses: {
            $elemMatch: {
              courseId: courseObjectId,
              "enrollmentData.status": { $in: ["paid", "registered"] },
            },
          },
          isConfirmed: true,
          "accountStatus.isActive": { $ne: false },
        })
          .select("firstName lastName email phoneNumber myInPersonCourses")
          .lean();
      } else if (courseType === "OnlineLiveTraining") {
        users = await User.find({
          myLiveCourses: {
            $elemMatch: {
              courseId: courseObjectId,
              "enrollmentData.status": { $in: ["paid", "registered"] },
            },
          },
          isConfirmed: true,
          "accountStatus.isActive": { $ne: false },
        })
          .select("firstName lastName email phoneNumber myLiveCourses")
          .lean();
      }

      console.log(
        `✅ Found ${users.length} enrolled users for course ${courseId}`
      );

      // Log each user for debugging (in development only)
      if (process.env.NODE_ENV === "development") {
        users.forEach((user) => {
          console.log(
            `   👤 ${user.firstName} ${user.lastName} (${user.email})`
          );
        });
      }

      return users;
    } catch (error) {
      console.error(
        `❌ Error getting enrolled users for course ${courseId}:`,
        error
      );
      return [];
    }
  }

  // ============================================
  // REMINDER MANAGEMENT METHODS
  // ============================================

  /**
   * Cancel a specific reminder by job ID
   * @param {string} jobId - Job ID to cancel
   * @returns {boolean} True if cancelled, false if not found
   */
  cancelReminder(jobId) {
    const reminder = this.scheduledReminders.get(jobId);
    if (reminder && reminder.job) {
      try {
        reminder.job.cancel();
        this.scheduledReminders.delete(jobId);
        console.log(`❌ Cancelled reminder: ${jobId}`);
        return true;
      } catch (error) {
        console.error(`❌ Error cancelling reminder ${jobId}:`, error);
        return false;
      }
    }
    console.warn(`⚠️ Reminder not found: ${jobId}`);
    return false;
  }

  /**
   * Cancel all reminders for a specific course
   * @param {string} courseId - Course ID
   * @param {string} courseType - Course type
   * @returns {number} Number of cancelled reminders
   */
  cancelReminderForCourse(courseId, courseType) {
    let cancelledCount = 0;
    const remindersToCancel = [];

    // Find all reminders for this course
    this.scheduledReminders.forEach((reminder, jobId) => {
      if (
        reminder.courseId === courseId &&
        reminder.courseType === courseType
      ) {
        remindersToCancel.push(jobId);
      }
    });

    // Cancel all found reminders
    remindersToCancel.forEach((jobId) => {
      if (this.cancelReminder(jobId)) {
        cancelledCount++;
      }
    });

    if (cancelledCount > 0) {
      console.log(
        `❌ Cancelled ${cancelledCount} reminders for course ${courseId}`
      );
    }

    return cancelledCount;
  }

  /**
   * Get all scheduled reminders with enhanced formatting
   * @returns {Array} Array of scheduled reminders
   */
  getScheduledReminders() {
    const reminders = [];
    const now = new Date();

    this.scheduledReminders.forEach((reminder, jobId) => {
      const nextInvocation = reminder.job
        ? reminder.job.nextInvocation()
        : null;
      const reminderDate = reminder.reminderDate || nextInvocation;

      // Calculate days from now
      let daysFromNow = "Invalid";
      if (reminderDate && !isNaN(reminderDate.getTime())) {
        const timeDiff = reminderDate.getTime() - now.getTime();
        daysFromNow = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      }

      reminders.push({
        jobId,
        courseId: reminder.courseId,
        courseType: reminder.courseType,
        courseName: reminder.courseName || "Unknown Course",
        courseTitle: reminder.courseName || "Unknown Course", // For HTML template compatibility
        courseCode: reminder.courseCode || "N/A",
        reminderDate: reminderDate,
        scheduledFor: reminderDate, // For HTML template compatibility
        userCount: reminder.userCount || 0,
        recipientCount: reminder.userCount || 0, // For HTML template compatibility
        emailType: reminder.emailType || "course-starting",
        customMessage: reminder.customMessage || "Standard template",
        status: reminder.status || "scheduled",
        createdAt: reminder.createdAt || new Date(),
        isCustom: reminder.isCustom || false,
        nextInvocation: nextInvocation,

        // Enhanced formatting for display
        displayDate: reminderDate
          ? reminderDate.toLocaleString()
          : "Invalid Date",
        daysFromNow: daysFromNow,
        isOverdue: reminderDate && reminderDate < now,
        isToday:
          reminderDate && reminderDate.toDateString() === now.toDateString(),
      });
    });

    // Sort by reminder date (soonest first)
    return reminders.sort((a, b) => {
      const dateA = a.reminderDate ? new Date(a.reminderDate) : new Date(0);
      const dateB = b.reminderDate ? new Date(b.reminderDate) : new Date(0);
      return dateA - dateB;
    });
  }

  /**
   * Get reminder history with filtering options
   * @param {number} limit - Maximum number of entries to return
   * @param {string} status - Filter by status (optional)
   * @returns {Array} Array of reminder history entries
   */
  getReminderHistory(limit = 50, status = null) {
    let history = [...this.reminderHistory];

    // Filter by status if specified
    if (status) {
      history = history.filter((entry) => entry.status === status);
    }

    // Sort by execution date (most recent first)
    history.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));

    // Apply limit
    return history.slice(0, limit);
  }

  /**
   * Schedule reminders for all upcoming courses
   * @returns {number} Number of reminders scheduled
   */
  async scheduleAllUpcomingReminders() {
    console.log("📅 Scheduling reminders for all upcoming courses...");

    try {
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
        "basic.status": { $in: ["open", "full"] },
      })
        .select("_id basic schedule")
        .lean();

      // Get upcoming online live courses
      const onlineCourses = await OnlineLiveTraining.find({
        "schedule.startDate": {
          $gte: tomorrow,
          $lte: oneMonthFromNow,
        },
        "basic.status": { $in: ["open", "full"] },
      })
        .select("_id basic schedule")
        .lean();

      let scheduledCount = 0;

      // Schedule in-person course reminders
      for (const course of inPersonCourses) {
        const jobId = await this.scheduleReminderForCourse(
          course._id.toString(),
          "InPersonAestheticTraining"
        );
        if (jobId) {
          scheduledCount++;
        }
      }

      // Schedule online course reminders
      for (const course of onlineCourses) {
        const jobId = await this.scheduleReminderForCourse(
          course._id.toString(),
          "OnlineLiveTraining"
        );
        if (jobId) {
          scheduledCount++;
        }
      }

      console.log(`✅ Scheduled ${scheduledCount} course reminders`);
      return scheduledCount;
    } catch (error) {
      console.error("❌ Error scheduling upcoming reminders:", error);
      return 0;
    }
  }

  // ============================================
  // STATUS AND MONITORING METHODS
  // ============================================

  /**
   * Get comprehensive system status
   * @returns {Object} System status information
   */
  getStatus() {
    const reminders = this.getScheduledReminders();
    const history = this.getReminderHistory(10);

    const now = new Date();
    const activeReminders = reminders.filter(
      (r) =>
        r.nextInvocation &&
        new Date(r.nextInvocation) > now &&
        r.status === "scheduled"
    );

    const todayReminders = reminders.filter(
      (r) =>
        r.reminderDate && r.reminderDate.toDateString() === now.toDateString()
    );

    // Calculate success rate from recent history
    const recentHistory = history.slice(0, 20);
    const totalSent = recentHistory.reduce(
      (sum, h) => sum + (h.successCount || 0),
      0
    );
    const totalFailed = recentHistory.reduce(
      (sum, h) => sum + (h.failureCount || 0),
      0
    );
    const successRate =
      totalSent + totalFailed > 0
        ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
        : 100;

    // Calculate uptime
    const uptime = Math.floor((now - this.startupTime) / (1000 * 60)); // minutes

    return {
      // Basic counts
      totalScheduled: this.scheduledReminders.size,
      activeReminders: activeReminders.length,
      todayReminders: todayReminders.length,

      // For template compatibility
      active: activeReminders.length,
      scheduled: todayReminders.length,
      sent: this.stats.totalEmailsSent,
      failed: this.stats.totalEmailsFailed,

      // System status
      isShuttingDown: this.isShuttingDown,
      schedulerRunning: !this.isShuttingDown,
      emailServiceActive: true, // Assume email service is active
      lastRun: history.length > 0 ? history[0].executedAt : null,
      queueSize: this.scheduledReminders.size,
      uptime: uptime,

      // Data
      reminders: reminders,
      history: history,

      // Statistics
      statistics: {
        totalExecuted: this.stats.totalExecuted,
        successRate: successRate,
        totalEmailsSent: this.stats.totalEmailsSent,
        totalEmailsFailed: this.stats.totalEmailsFailed,
        totalScheduled: this.stats.totalScheduled,
        lastCleanup: this.stats.lastCleanup,
      },
    };
  }

  /**
   * Get detailed statistics for reporting
   * @returns {Object} Detailed statistics
   */
  getDetailedStatistics() {
    const reminders = this.getScheduledReminders();
    const history = this.getReminderHistory();

    // Group by course type
    const byType = {
      InPersonAestheticTraining: reminders.filter(
        (r) => r.courseType === "InPersonAestheticTraining"
      ).length,
      OnlineLiveTraining: reminders.filter(
        (r) => r.courseType === "OnlineLiveTraining"
      ).length,
    };

    // Group by email type
    const byEmailType = {};
    reminders.forEach((r) => {
      const type = r.emailType || "course-starting";
      byEmailType[type] = (byEmailType[type] || 0) + 1;
    });

    // Upcoming reminders in next 24 hours
    const next24Hours = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const upcomingReminders = reminders.filter(
      (r) =>
        r.nextInvocation &&
        new Date(r.nextInvocation) <= next24Hours &&
        new Date(r.nextInvocation) > new Date()
    );

    // Success rate by email type
    const successByEmailType = {};
    history.forEach((h) => {
      const type = h.emailType || "course-starting";
      if (!successByEmailType[type]) {
        successByEmailType[type] = { sent: 0, failed: 0 };
      }
      successByEmailType[type].sent += h.successCount || 0;
      successByEmailType[type].failed += h.failureCount || 0;
    });

    return {
      total: {
        scheduled: reminders.length,
        executed: history.length,
        upcoming24h: upcomingReminders.length,
      },
      byType,
      byEmailType,
      successByEmailType,
      upcomingReminders: upcomingReminders.map((r) => ({
        courseName: r.courseName,
        emailType: r.emailType,
        scheduledFor: r.nextInvocation,
        recipientCount: r.userCount,
      })),
      systemStats: {
        uptime: Math.floor((new Date() - this.startupTime) / (1000 * 60)),
        totalScheduled: this.stats.totalScheduled,
        totalExecuted: this.stats.totalExecuted,
        totalEmailsSent: this.stats.totalEmailsSent,
        totalEmailsFailed: this.stats.totalEmailsFailed,
      },
    };
  }

  // ============================================
  // MAINTENANCE AND CLEANUP METHODS
  // ============================================

  /**
   * Update course reminder history in the database
   * @param {string} courseId - Course ID
   * @param {string} courseType - Course type
   * @param {Object} historyEntry - History entry to add
   */
  async updateCourseReminderHistory(courseId, courseType, historyEntry) {
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
          sentBy: null, // System automated
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

  /**
   * Clean up old data and expired reminders
   */
  cleanupOldData() {
    console.log("🧹 Starting cleanup of old reminder data...");

    const now = new Date();
    let cleanedCount = 0;

    // Remove old history entries (keep last 200)
    if (this.reminderHistory.length > 200) {
      const originalLength = this.reminderHistory.length;
      this.reminderHistory = this.reminderHistory
        .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
        .slice(0, 200);
      cleanedCount += originalLength - this.reminderHistory.length;
    }

    // Remove expired/completed reminders that are more than 24 hours old
    const expiredReminders = [];
    this.scheduledReminders.forEach((reminder, jobId) => {
      if (
        reminder.reminderDate &&
        reminder.reminderDate < new Date(now.getTime() - 24 * 60 * 60 * 1000)
      ) {
        expiredReminders.push(jobId);
      }
    });

    expiredReminders.forEach((jobId) => {
      this.scheduledReminders.delete(jobId);
      cleanedCount++;
    });

    this.stats.lastCleanup = now;

    console.log(`🧹 Cleanup complete - Removed ${cleanedCount} old entries`);
    console.log(
      `📊 Current state: ${this.reminderHistory.length} history entries, ${this.scheduledReminders.size} scheduled reminders`
    );
  }

  /**
   * Shutdown the scheduler gracefully
   */
  shutdown() {
    console.log("📧 Shutting down course reminder scheduler...");
    this.isShuttingDown = true;

    let cancelledCount = 0;
    this.scheduledReminders.forEach((reminder, jobId) => {
      try {
        if (reminder.job) {
          reminder.job.cancel();
          cancelledCount++;
        }
      } catch (error) {
        console.error(`❌ Error cancelling job ${jobId}:`, error);
      }
    });

    this.scheduledReminders.clear();

    console.log(`✅ Course reminder scheduler shutdown complete`);
    console.log(`❌ Cancelled ${cancelledCount} pending reminders`);
  }

  /**
   * Health check method
   * @returns {Object} Health status
   */
  healthCheck() {
    const now = new Date();
    const uptime = Math.floor((now - this.startupTime) / 1000); // seconds
    const status = this.getStatus();

    return {
      status: this.isShuttingDown ? "shutting_down" : "healthy",
      uptime: uptime,
      scheduledReminders: this.scheduledReminders.size,
      totalExecuted: this.stats.totalExecuted,
      lastCleanup: this.stats.lastCleanup,
      memoryUsage: process.memoryUsage(),
      activeJobs: status.activeReminders,
      nextRun:
        status.reminders.length > 0 ? status.reminders[0].nextInvocation : null,
    };
  }
}

// ============================================
// CREATE AND EXPORT SINGLETON INSTANCE
// ============================================

const courseReminderScheduler = new CourseReminderScheduler();

// Initialize reminders on startup (with delay to ensure database is ready)
setTimeout(async () => {
  try {
    console.log("🚀 Initializing course reminder scheduler...");

    // Schedule reminders for upcoming courses
    const scheduledCount =
      await courseReminderScheduler.scheduleAllUpcomingReminders();
    console.log(`✅ Initialized with ${scheduledCount} scheduled reminders`);

    // Schedule daily cleanup at 2 AM
    schedule.scheduleJob("0 2 * * *", () => {
      console.log("🧹 Running daily cleanup...");
      courseReminderScheduler.cleanupOldData();
    });

    // Schedule weekly maintenance at 3 AM on Sundays
    schedule.scheduleJob("0 3 * * 0", () => {
      console.log("🔧 Running weekly maintenance...");
      courseReminderScheduler.cleanupOldData();

      // Log system health
      const health = courseReminderScheduler.healthCheck();
      console.log("💊 System Health:", health);
    });

    console.log("✅ Course reminder scheduler fully initialized");
  } catch (error) {
    console.error("❌ Error initializing course reminder scheduler:", error);
  }
}, 10000); // 10 second delay

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("📧 SIGTERM received, shutting down reminder scheduler...");
  courseReminderScheduler.shutdown();
});

process.on("SIGINT", () => {
  console.log("📧 SIGINT received, shutting down reminder scheduler...");
  courseReminderScheduler.shutdown();
});

module.exports = courseReminderScheduler;
