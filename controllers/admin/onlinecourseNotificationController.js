// controllers/admin/onlinecourseNotificationController.js
/**
 * Course Notification Controller - ONLINE LIVE TRAINING VERSION
 * Handles all notification logic for online course creation, updates, and management
 */

const schedule = require("node-schedule");
const User = require("../../models/user");
const Instructor = require("../../models/Instructor");
const emailService = require("../../utils/emailService");

class OnlineCourseNotificationController {
  constructor() {
    // Track scheduled notifications to prevent duplicates
    this.scheduledNotifications = new Map();

    // Track when courses were created to manage 2-hour window
    this.courseCreationTimes = new Map();
    // ADD: Start cleanup interval
    this._startCleanupInterval();
  }

  /**
   * SINGLE standardized method to get instructor names from course
   */
  _getStandardizedInstructorNames(course) {
    const names = [];

    // Primary instructor - use cached name first, fallback to populated object
    if (course.instructors?.primary?.name) {
      names.push(course.instructors.primary.name);
    } else if (course.instructors?.primary?.instructorId?.fullName) {
      names.push(course.instructors.primary.instructorId.fullName);
    } else if (course.instructors?.primary?.instructorId?.firstName) {
      const inst = course.instructors.primary.instructorId;
      names.push(`${inst.firstName} ${inst.lastName}`.trim());
    }

    // Additional instructors
    if (course.instructors?.additional?.length > 0) {
      course.instructors.additional.forEach((inst) => {
        if (inst.name) {
          names.push(inst.name);
        } else if (inst.instructorId?.fullName) {
          names.push(inst.instructorId.fullName);
        } else if (inst.instructorId?.firstName) {
          names.push(
            `${inst.instructorId.firstName} ${inst.instructorId.lastName}`.trim()
          );
        }
      });
    }

    return names.length > 0 ? names.join(", ") : "TBD";
  }

  /**
   * Get instructor emails for notifications (simplified)
   */
  async _getStandardizedInstructorEmails(course) {
    const emails = [];

    // Primary instructor
    if (course.instructors?.primary?.instructorId) {
      let email = null;

      if (course.instructors.primary.instructorId.email) {
        email = course.instructors.primary.instructorId.email;
      } else if (typeof course.instructors.primary.instructorId === "string") {
        try {
          const instructor = await Instructor.findById(
            course.instructors.primary.instructorId
          ).select("email firstName lastName");
          email = instructor?.email;
        } catch (error) {
          console.error("Error fetching primary instructor email:", error);
        }
      }

      if (email) {
        emails.push(email);
      }
    }

    // Additional instructors
    if (course.instructors?.additional?.length > 0) {
      for (const inst of course.instructors.additional) {
        if (inst.instructorId) {
          let email = null;

          if (inst.instructorId.email) {
            email = inst.instructorId.email;
          } else if (typeof inst.instructorId === "string") {
            try {
              const instructor = await Instructor.findById(
                inst.instructorId
              ).select("email");
              email = instructor?.email;
            } catch (error) {
              console.error(
                "Error fetching additional instructor email:",
                error
              );
            }
          }

          if (email && !emails.includes(email)) {
            emails.push(email);
          }
        }
      }
    }

    return emails;
  }

  _startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this._cleanupTrackingMaps();
    }, 60 * 60 * 1000); // 1 hour

    console.log("🧹 Started cleanup interval");
  }

  _cleanupTrackingMaps() {
    const now = new Date();
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    // Clean course creation times older than 24 hours
    for (const [courseId, creationTime] of this.courseCreationTimes.entries()) {
      if (now - creationTime > expirationTime) {
        this.courseCreationTimes.delete(courseId);
        cleanedCount++;
      }
    }

    // Clean completed jobs
    for (const [jobId, job] of this.scheduledNotifications.entries()) {
      const nextInvocation = job.nextInvocation();
      if (!nextInvocation || nextInvocation < now) {
        job.cancel();
        this.scheduledNotifications.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired entries`);
    }
  }

  // ADD: Enhanced cancel method
  cancelScheduledNotification(courseId) {
    const jobId = `new-course-${courseId}`;
    const job = this.scheduledNotifications.get(jobId);

    if (job) {
      job.cancel();
      this.scheduledNotifications.delete(jobId);
      // ALSO clean up creation time tracking
      this.courseCreationTimes.delete(courseId);
      console.log(`❌ Cancelled notification for course ${courseId}`);
      return true;
    }
    return false;
  }

  // ADD: Shutdown method
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const [jobId, job] of this.scheduledNotifications.entries()) {
      job.cancel();
    }

    this.scheduledNotifications.clear();
    this.courseCreationTimes.clear();
    console.log("✅ Notification controller shutdown complete");
  }

  /**
   * Handle notifications when a new course is created
   * Schedules email to be sent after 2 hours
   */
  async handleCourseCreation(course, createdBy) {
    try {
      console.log(
        "📧 Setting up notifications for new online course:",
        course.basic?.title
      );

      // Store creation time
      this.courseCreationTimes.set(course._id.toString(), new Date());

      // Prepare course data for email - ONLINE SPECIFIC
      const courseData = this.prepareCourseDataForEmail(course);

      // Get all recipients using the User model static method
      const recipients = await User.getNotificationRecipients();

      console.log(`📧 Found ${recipients.length} users who want notifications`);

      if (recipients.length === 0) {
        console.log(
          "📧 No users want notifications, skipping email scheduling"
        );
        return {
          success: true,
          message: "No users to notify",
          recipientCount: 0,
        };
      }

      // Schedule email for 2 hours later
      const scheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const jobId = this.scheduleNewCourseNotification(
        course._id.toString(),
        courseData,
        recipients,
        scheduledTime
      );

      // Schedule instructor notification
      await this.scheduleInstructorNotification(course, scheduledTime);

      console.log(`✅ Notifications scheduled for ${scheduledTime}`);

      return {
        success: true,
        scheduledTime,
        recipientCount: recipients.length,
        jobId,
      };
    } catch (error) {
      console.error("❌ Error handling course creation notifications:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle notifications when a course is updated
   */
  async handleCourseUpdate(courseId, updatedCourse, updatedBy, changes = {}) {
    try {
      console.log(
        "📝 Handling online course update notifications for course:",
        courseId
      );

      const creationTime = this.courseCreationTimes.get(courseId);
      const now = new Date();

      // Check if still within 2-hour window
      if (creationTime && now - creationTime < 2 * 60 * 60 * 1000) {
        console.log(
          "📧 Course updated within 2-hour window, no notification needed"
        );
        return {
          success: true,
          message: "Within 2-hour grace period, no notification sent",
        };
      }

      // Check if there are registered students
      const registeredStudents = await this.getRegisteredStudents(courseId);

      if (registeredStudents.length === 0) {
        console.log("📧 No registered students, skipping update notification");
        return {
          success: true,
          message: "No registered students to notify",
        };
      }

      // Prepare update details - ONLINE SPECIFIC
      const updateDetails = this.prepareUpdateDetails(changes);
      const courseData = this.prepareCourseDataForEmail(updatedCourse);

      // Send immediate notification to registered students
      await emailService.sendCourseUpdateEmail(
        courseData,
        updateDetails,
        registeredStudents
      );

      console.log(
        `✅ Update notifications sent to ${registeredStudents.length} students`
      );

      return {
        success: true,
        notifiedCount: registeredStudents.length,
      };
    } catch (error) {
      console.error("❌ Error handling course update notifications:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle notifications when a course is cancelled
   */
  async handleCourseCancellation(courseId, course) {
    try {
      console.log("🚫 Handling online course cancellation notifications");

      // Cancel any scheduled new course notifications
      this.cancelScheduledNotification(courseId);

      // Get registered students
      const registeredStudents = await this.getRegisteredStudents(courseId);

      if (registeredStudents.length > 0) {
        const courseData = this.prepareCourseDataForEmail(course);

        // Send immediate cancellation notification
        await emailService.sendCourseCancellationEmail(
          courseData,
          registeredStudents
        );

        console.log(
          `✅ Cancellation notifications sent to ${registeredStudents.length} students`
        );
      }

      // Clean up tracking data
      this.courseCreationTimes.delete(courseId);

      return {
        success: true,
        notifiedCount: registeredStudents.length,
      };
    } catch (error) {
      console.error("❌ Error handling course cancellation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Schedule new course notification
   */
  scheduleNewCourseNotification(
    courseId,
    courseData,
    recipients,
    scheduledTime
  ) {
    const jobId = `new-course-${courseId}`;

    // Cancel existing job if any
    this.cancelScheduledNotification(courseId);

    // Schedule new job
    const job = schedule.scheduleJob(scheduledTime, async () => {
      try {
        console.log(
          "📧 Executing scheduled new online course notification for course:",
          courseId
        );

        // Check if course still exists and is active
        const currentCourse = await this.verifyCourseStatus(courseId);

        if (currentCourse && currentCourse.basic?.status !== "cancelled") {
          await emailService.sendNewCourseAnnouncement(courseData, recipients);
          console.log(
            `✅ New course announcement sent to ${recipients.length} recipients`
          );
        } else {
          console.log(
            "❌ Course cancelled or not found, skipping notification"
          );
        }

        // Clean up
        this.scheduledNotifications.delete(jobId);
        this.courseCreationTimes.delete(courseId);
      } catch (error) {
        console.error("❌ Error sending scheduled notification:", error);
      }
    });

    this.scheduledNotifications.set(jobId, job);
    console.log(`📅 Scheduled notification job ${jobId} for ${scheduledTime}`);
    return jobId;
  }

  /**
   * Schedule instructor notification
   */
  async scheduleInstructorNotification(course, scheduledTime) {
    try {
      // Use the standardized method to get emails
      const instructorEmails = await this._getStandardizedInstructorEmails(
        course
      );

      if (instructorEmails.length > 0) {
        const courseData = this.prepareCourseDataForEmail(course);

        // Send instructor notification immediately
        await emailService.sendInstructorNotification(
          courseData,
          instructorEmails
        );
        console.log(
          `✅ Instructor notifications sent to ${instructorEmails.length} instructors`
        );
      } else {
        console.log("📧 No instructor emails found for notifications");
      }
    } catch (error) {
      console.error("❌ Error scheduling instructor notification:", error);
    }
  }

  /**
   * Cancel scheduled notification
   */
  cancelScheduledNotification(courseId) {
    const jobId = `new-course-${courseId}`;
    const job = this.scheduledNotifications.get(jobId);

    if (job) {
      job.cancel();
      this.scheduledNotifications.delete(jobId);
      console.log(`❌ Cancelled scheduled notification for course ${courseId}`);
      return true;
    }
    return false;
  }

  /**
   * Get registered students for an online course
   */
  async getRegisteredStudents(courseId) {
    try {
      // For online live courses
      const onlineStudents = await User.find({
        "myOnlineLiveCourses.courseId": courseId,
        "myOnlineLiveCourses.status": {
          $in: ["Paid and Registered", "Registered (promo code)"],
        },
      }).select("email firstName lastName");

      return onlineStudents;
    } catch (error) {
      console.error("Error getting registered students:", error);
      return [];
    }
  }

  /**
   * Prepare course data for email - ONLINE SPECIFIC VERSION
   */
  prepareCourseDataForEmail(course) {
    return {
      _id: course._id,
      courseType: "OnlineLiveTraining",
      title: course.basic?.title || "Untitled Course",
      courseCode: course.basic?.courseCode || "N/A",
      description: course.basic?.description || "",
      category: course.basic?.category || "general",
      status: course.basic?.status || "open",

      // Schedule info
      startDate: course.schedule?.startDate,
      endDate: course.schedule?.endDate,
      duration: course.schedule?.duration,
      primaryTimezone: course.schedule?.primaryTimezone || "UTC",
      displayTimezones: course.schedule?.displayTimezones || [],
      pattern: course.schedule?.pattern || "single",

      // Platform info
      platform: course.platform?.name || "Online Platform",
      accessUrl: course.platform?.accessUrl,
      meetingId: course.platform?.meetingId,

      // Pricing
      price: course.enrollment?.price || 0,
      earlyBirdPrice: course.enrollment?.earlyBirdPrice,
      currency: course.enrollment?.currency || "USD",

      // FIX: Use the model's virtual field OR our standardized method
      instructor:
        course.instructorNames || this._getStandardizedInstructorNames(course),

      // Rest remains the same...
      seatsAvailable: course.enrollment?.seatsAvailable,
      certificateProvided: course.certification?.enabled || false,
      objectives: course.content?.objectives || [],
      technicalRequirements: {
        equipment: course.technical?.equipment,
        internetSpeed: course.technical?.internetSpeed,
        requiredSoftware: course.technical?.requiredSoftware || [],
      },
      recordingAvailable:
        course.recording?.enabled &&
        course.recording?.availability?.forStudents,
      recordingDuration: course.recording?.availability?.duration || 0,
      interactionFeatures: course.interaction?.features || {},
    };
  }

  /**
   * Prepare update details for email - ONLINE SPECIFIC
   */
  prepareUpdateDetails(changes) {
    const updateList = [];

    if (changes.schedule) {
      updateList.push(
        "<li><strong>Schedule:</strong> Course dates, times, or timezone have been updated</li>"
      );
    }
    if (changes.platform) {
      updateList.push(
        "<li><strong>Platform:</strong> Online platform or access details have changed</li>"
      );
    }
    if (changes.instructors) {
      updateList.push(
        "<li><strong>Instructors:</strong> Instructor assignments updated</li>"
      );
    }
    if (changes.enrollment) {
      updateList.push(
        "<li><strong>Enrollment:</strong> Pricing or seat availability changed</li>"
      );
    }
    if (changes.content) {
      updateList.push(
        "<li><strong>Content:</strong> Course materials or objectives updated</li>"
      );
    }
    if (changes.technical) {
      updateList.push(
        "<li><strong>Technical Requirements:</strong> System or software requirements updated</li>"
      );
    }
    if (changes.recording) {
      updateList.push(
        "<li><strong>Recording:</strong> Recording availability or settings changed</li>"
      );
    }
    if (changes.interaction) {
      updateList.push(
        "<li><strong>Interaction:</strong> Interactive features or tools updated</li>"
      );
    }

    if (updateList.length === 0) {
      updateList.push("<li>Course information has been updated</li>");
    }

    return `<ul>${updateList.join("")}</ul>`;
  }

  /**
   * Verify course status
   */
  async verifyCourseStatus(courseId) {
    try {
      const OnlineLiveTraining = require("../../models/OnlineLiveTraining");
      const course = await OnlineLiveTraining.findById(courseId);
      return course;
    } catch (error) {
      console.error("Error verifying course status:", error);
      return null;
    }
  }

  /**
   * Send immediate notification (bypass 2-hour delay)
   */
  async sendImmediateNotification(courseId) {
    try {
      console.log(
        "📧 Sending immediate notification for online course:",
        courseId
      );

      const course = await this.verifyCourseStatus(courseId);
      if (!course) {
        throw new Error("Course not found");
      }

      const recipients = await User.getNotificationRecipients();
      if (recipients.length === 0) {
        return {
          success: true,
          message: "No users to notify",
        };
      }

      const courseData = this.prepareCourseDataForEmail(course);
      await emailService.sendNewCourseAnnouncement(courseData, recipients);

      console.log(
        `✅ Immediate notification sent to ${recipients.length} recipients`
      );

      return {
        success: true,
        message: "Immediate notification sent successfully",
        recipientCount: recipients.length,
      };
    } catch (error) {
      console.error("❌ Error sending immediate notification:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send test notification (for debugging)
   */
  async sendTestNotification(courseId, recipientEmail) {
    try {
      const course = await this.verifyCourseStatus(courseId);
      if (!course) {
        throw new Error("Course not found");
      }

      const courseData = this.prepareCourseDataForEmail(course);
      const testRecipient = [
        {
          email: recipientEmail,
          firstName: "Test",
          lastName: "User",
        },
      ];

      await emailService.sendNewCourseAnnouncement(courseData, testRecipient);

      return {
        success: true,
        message: "Test notification sent successfully",
      };
    } catch (error) {
      console.error("Error sending test notification:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get notification status
   */
  getNotificationStatus() {
    const scheduled = [];

    for (const [jobId, job] of this.scheduledNotifications) {
      scheduled.push({
        jobId,
        nextInvocation: job.nextInvocation()?.toISOString() || "Not scheduled",
      });
    }

    return {
      scheduledJobs: scheduled,
      trackedCourses: Array.from(this.courseCreationTimes.keys()),
      activeJobs: this.scheduledNotifications.size,
    };
  }
}

// Create and export singleton instance
const onlineCourseNotificationController =
  new OnlineCourseNotificationController();
module.exports = onlineCourseNotificationController;
