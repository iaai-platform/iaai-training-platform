// Create new file: utils/courseReminderScheduler.js

const schedule = require("node-schedule");
const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const emailService = require("./emailService");

class CourseReminderScheduler {
  constructor() {
    this.scheduledReminders = new Map();
    this.isShuttingDown = false;
  }

  // Schedule reminder for a specific course
  async scheduleReminderForCourse(courseId, courseType) {
    try {
      console.log(
        `📅 Scheduling reminder for ${courseType} course: ${courseId}`
      );

      // Get course data
      let course;
      if (courseType === "InPersonAestheticTraining") {
        course = await InPersonAestheticTraining.findById(courseId);
      } else if (courseType === "OnlineLiveTraining") {
        course = await OnlineLiveTraining.findById(courseId);
      } else {
        console.log(
          `⚠️ Reminders not supported for course type: ${courseType}`
        );
        return null;
      }

      if (!course) {
        console.error(`❌ Course not found: ${courseId}`);
        return null;
      }

      const startDate = new Date(course.schedule?.startDate);
      if (!startDate || isNaN(startDate.getTime())) {
        console.error(`❌ Invalid start date for course: ${courseId}`);
        return null;
      }

      // Calculate reminder date (24 hours before)
      const reminderDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
      const now = new Date();

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
      const jobId = `reminder-${courseType}-${courseId}`;

      // Cancel existing reminder if any
      this.cancelReminder(jobId);

      // Schedule the reminder
      const job = schedule.scheduleJob(reminderDate, async () => {
        if (this.isShuttingDown) return;

        console.log(
          `📧 Executing reminder job for course: ${
            course.basic?.title || course.title
          }`
        );
        await this.sendRemindersToUsers(course, courseType, enrolledUsers);
        this.scheduledReminders.delete(jobId);
      });

      this.scheduledReminders.set(jobId, {
        job,
        courseId,
        courseType,
        courseName: course.basic?.title || course.title,
        reminderDate,
        userCount: enrolledUsers.length,
      });

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

  // Get enrolled users for a course
  async getEnrolledUsers(courseId, courseType) {
    try {
      let users = [];

      if (courseType === "InPersonAestheticTraining") {
        users = await User.find({
          "myInPersonCourses.courseId": courseId,
          "myInPersonCourses.enrollmentData.status": {
            $in: ["paid", "registered"],
          },
        }).populate("myInPersonCourses.courseId");
      } else if (courseType === "OnlineLiveTraining") {
        users = await User.find({
          "myLiveCourses.courseId": courseId,
          "myLiveCourses.enrollmentData.status": {
            $in: ["paid", "registered"],
          },
        }).populate("myLiveCourses.courseId");
      }

      // Filter users who are actually enrolled in this specific course
      const enrolledUsers = users.filter((user) => {
        const enrollment = user.getCourseEnrollment(courseId, courseType);
        return (
          enrollment &&
          ["paid", "registered"].includes(enrollment.enrollmentData.status)
        );
      });

      return enrolledUsers;
    } catch (error) {
      console.error(
        `❌ Error getting enrolled users for course ${courseId}:`,
        error
      );
      return [];
    }
  }

  // Send reminders to all enrolled users
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
        const enrollment = user.getCourseEnrollment(course._id, courseType);

        if (
          !enrollment ||
          !["paid", "registered"].includes(enrollment.enrollmentData.status)
        ) {
          console.log(`⚠️ Skipping user ${user.email} - not properly enrolled`);
          continue;
        }

        await emailService.sendCourseStartingReminder(
          user,
          course,
          courseType,
          enrollment
        );
        successCount++;

        // Small delay between emails
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed to send reminder to ${user.email}:`, error);
        failureCount++;
      }
    }

    console.log(
      `✅ Reminder batch complete for ${course.basic?.title || course.title}`
    );
    console.log(`📊 Success: ${successCount}, Failed: ${failureCount}`);
  }

  // Cancel a specific reminder
  cancelReminder(jobId) {
    const reminder = this.scheduledReminders.get(jobId);
    if (reminder) {
      reminder.job.cancel();
      this.scheduledReminders.delete(jobId);
      console.log(`❌ Cancelled reminder: ${jobId}`);
      return true;
    }
    return false;
  }

  // Cancel reminder by course ID
  cancelReminderForCourse(courseId, courseType) {
    const jobId = `reminder-${courseType}-${courseId}`;
    return this.cancelReminder(jobId);
  }

  // Get all scheduled reminders
  getScheduledReminders() {
    const reminders = [];
    this.scheduledReminders.forEach((reminder, jobId) => {
      reminders.push({
        jobId,
        courseId: reminder.courseId,
        courseType: reminder.courseType,
        courseName: reminder.courseName,
        reminderDate: reminder.reminderDate,
        userCount: reminder.userCount,
        nextInvocation: reminder.job.nextInvocation(),
      });
    });
    return reminders;
  }

  // Schedule reminders for all upcoming courses
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
        "enrollment.isOpen": true,
      });

      // Get upcoming online live courses
      const onlineCourses = await OnlineLiveTraining.find({
        "schedule.startDate": {
          $gte: tomorrow,
          $lte: oneMonthFromNow,
        },
        "enrollment.isOpen": true,
      });

      let scheduledCount = 0;

      // Schedule in-person course reminders
      for (const course of inPersonCourses) {
        const jobId = await this.scheduleReminderForCourse(
          course._id.toString(),
          "InPersonAestheticTraining"
        );
        if (jobId) scheduledCount++;
      }

      // Schedule online course reminders
      for (const course of onlineCourses) {
        const jobId = await this.scheduleReminderForCourse(
          course._id.toString(),
          "OnlineLiveTraining"
        );
        if (jobId) scheduledCount++;
      }

      console.log(`✅ Scheduled ${scheduledCount} course reminders`);
      return scheduledCount;
    } catch (error) {
      console.error("❌ Error scheduling upcoming reminders:", error);
      return 0;
    }
  }

  // Cleanup and shutdown
  shutdown() {
    console.log("📧 Shutting down course reminder scheduler...");
    this.isShuttingDown = true;

    this.scheduledReminders.forEach((reminder, jobId) => {
      reminder.job.cancel();
      console.log(`❌ Cancelled reminder job: ${jobId}`);
    });

    this.scheduledReminders.clear();
    console.log("✅ Course reminder scheduler shutdown complete");
  }

  // Get status summary
  getStatus() {
    return {
      totalScheduled: this.scheduledReminders.size,
      isShuttingDown: this.isShuttingDown,
      reminders: this.getScheduledReminders(),
    };
  }
}

// Create and export singleton instance
const courseReminderScheduler = new CourseReminderScheduler();

// Initialize reminders on startup (with delay to ensure database is ready)
setTimeout(() => {
  courseReminderScheduler.scheduleAllUpcomingReminders();
}, 5000);

module.exports = courseReminderScheduler;
