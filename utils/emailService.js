// utils/emailService.js - COMPLETE UPDATED VERSION
const sendEmail = require("./sendEmail");
const schedule = require("node-schedule");
const User = require("../models/user");

class EmailService {
  constructor() {
    // Store scheduled jobs
    this.scheduledJobs = new Map();

    // Check if we're in mock mode
    this.mockMode =
      process.env.EMAIL_MODE === "mock" || !process.env.EMAIL_USER;

    if (this.mockMode) {
      console.log("📧 Email service running in MOCK mode");
    }

    // Configuration for bulk email methods
    this.bulkEmailMethod = "bcc"; // Options: 'bcc', 'individual', 'batch'
  }

  // ============================================
  // EXISTING METHODS (UNCHANGED)
  // ============================================

  async sendUserApprovalEmail(user) {
    if (this.mockMode) {
      console.log("📧 [MOCK] Would send approval email to:", user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: "Your IAAI Account Has Been Approved",
        html: `
          <h2>Welcome to IAAI Training Institute!</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your account has been approved. You can now log in and access all our courses.</p>
          <p>Thank you for joining us!</p>
          <p>Best regards,<br>IAAI Team</p>
        `,
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error("Error sending approval email:", error);
      return { success: false, error: error.message };
    }
  }

  async sendUserRejectionEmail(user, reason) {
    if (this.mockMode) {
      console.log("📧 [MOCK] Would send rejection email to:", user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: "IAAI Account Application Update",
        html: `
          <h2>Account Application Update</h2>
          <p>Dear ${user.firstName},</p>
          <p>We regret to inform you that your account application has not been approved at this time.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ""}
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br>IAAI Team</p>
        `,
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error("Error sending rejection email:", error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    if (this.mockMode) {
      console.log("📧 [MOCK] Would send password reset to:", user.email);
      return { success: true };
    }

    try {
      const resetUrl = `${process.env.BASE_URL}/reset-password/${resetToken}`;

      const mailOptions = {
        to: user.email,
        subject: "Password Reset Request - IAAI",
        html: `
          <h2>Password Reset Request</h2>
          <p>Dear ${user.firstName},</p>
          <p>You have requested to reset your password. Click the link below to reset it:</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>Or copy this link: ${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>IAAI Team</p>
        `,
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // NEW ENHANCED COURSE REGISTRATION EMAIL
  // ============================================

  async sendCourseRegistrationConfirmation(
    user,
    registeredCourses,
    transactionInfo,
    isPromoCode = false
  ) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send registration confirmation to:",
        user.email
      );
      return { success: true };
    }

    try {
      // Determine registration type
      const registrationType =
        transactionInfo.finalAmount <= 0 ? "FREE" : "PAID";
      const isFreeRegistration = registrationType === "FREE";

      // Calculate totals
      const totalOriginalPrice = registeredCourses.reduce(
        (sum, course) => sum + (course.originalPrice || course.price || 0),
        0
      );
      const totalFinalPrice = registeredCourses.reduce(
        (sum, course) => sum + (course.finalPrice || 0),
        0
      );
      const totalSavings = totalOriginalPrice - totalFinalPrice;

      // Generate course list HTML
      const courseListHtml = registeredCourses
        .map((course) => {
          const startDate = course.startDate
            ? new Date(course.startDate).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "To be announced";

          const priceDisplay = course.isLinkedCourseFree
            ? '<span style="color: #10b981; font-weight: bold;">FREE (Included)</span>'
            : isFreeRegistration
            ? '<span style="color: #10b981; font-weight: bold;">FREE</span>'
            : `€${(course.finalPrice || 0).toFixed(2)}`;

          const courseTypeLabel =
            {
              InPersonAestheticTraining: "In-Person Training",
              OnlineLiveTraining: "Live Online Training",
              SelfPacedOnlineTraining: "Self-Paced Online Course",
            }[course.courseType] ||
            course.displayType ||
            "Training Course";

          return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 20px 0; vertical-align: top;">
              <div style="margin-bottom: 8px;">
                <h3 style="margin: 0; color: #1f2937; font-size: 18px;">${
                  course.title
                }</h3>
                <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
                  <strong>Course Code:</strong> ${course.courseCode} | 
                  <strong>Type:</strong> ${courseTypeLabel}
                </p>
              </div>
              
              <div style="margin-top: 12px;">
                <p style="margin: 4px 0; color: #374151; font-size: 14px;">
                  <strong>📅 Start Date:</strong> ${startDate}
                </p>
                ${
                  course.courseType === "SelfPacedOnlineTraining"
                    ? '<p style="margin: 4px 0; color: #10b981; font-size: 14px;"><strong>✅ Access:</strong> Immediate</p>'
                    : ""
                }
                ${
                  course.isLinkedCourseFree
                    ? '<p style="margin: 4px 0; color: #3b82f6; font-size: 14px;"><strong>🔗 Linked Course:</strong> Included with primary course</p>'
                    : ""
                }
              </div>
            </td>
            <td style="padding: 20px 0; text-align: right; vertical-align: top;">
              <div style="font-size: 18px; font-weight: bold;">${priceDisplay}</div>
              ${
                course.originalPrice &&
                course.originalPrice > (course.finalPrice || 0)
                  ? `<div style="color: #6b7280; text-decoration: line-through; font-size: 14px;">€${course.originalPrice.toFixed(
                      2
                    )}</div>`
                  : ""
              }
            </td>
          </tr>
        `;
        })
        .join("");

      // Generate access instructions HTML
      const accessInstructionsHtml = registeredCourses
        .map((course) => {
          if (course.courseType === "SelfPacedOnlineTraining") {
            return `
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 12px 0;">
              <h4 style="margin: 0 0 8px 0; color: #0369a1;">📚 ${course.title}</h4>
              <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
                <strong>✅ Ready to start!</strong> Access your course materials immediately in your <a href="${process.env.BASE_URL}/library" style="color: #0369a1;">Student Library</a>.
              </p>
            </div>
          `;
          } else if (course.courseType === "OnlineLiveTraining") {
            return `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 12px 0;">
              <h4 style="margin: 0 0 8px 0; color: #15803d;">💻 ${
                course.title
              }</h4>
              <p style="margin: 0; color: #14532d; font-size: 14px;">
                <strong>📅 Starts:</strong> ${
                  course.startDate
                    ? new Date(course.startDate).toLocaleDateString()
                    : "TBA"
                }<br>
                You'll receive joining instructions 24 hours before the session starts.
              </p>
            </div>
          `;
          } else {
            return `
            <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 16px; margin: 12px 0;">
              <h4 style="margin: 0 0 8px 0; color: #a16207;">🏢 ${
                course.title
              }</h4>
              <p style="margin: 0; color: #713f12; font-size: 14px;">
                <strong>📅 Starts:</strong> ${
                  course.startDate
                    ? new Date(course.startDate).toLocaleDateString()
                    : "TBA"
                }<br>
                Detailed venue and preparation information will be sent 1 week before the course.
              </p>
            </div>
          `;
          }
        })
        .join("");

      const mailOptions = {
        to: user.email,
        subject: `Registration Confirmed: ${
          registeredCourses.length > 1
            ? `${registeredCourses.length} Courses`
            : registeredCourses[0].title
        } - IAAI Training`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Course Registration Confirmed</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb; }
              .container { max-width: 700px; margin: 0 auto; background: #ffffff; }
              .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 40px 30px; text-align: center; }
              .content { padding: 40px 30px; }
              .course-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
              .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 30px 0; }
              .button { display: inline-block; padding: 14px 28px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .footer { background: #f8fafc; padding: 30px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
              .success-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; display: inline-block; margin-bottom: 20px; }
              .next-steps { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 32px;">🎉 Registration Confirmed!</h1>
                <p style="margin: 16px 0 0 0; font-size: 18px; opacity: 0.9;">Welcome to IAAI Training Institute</p>
              </div>
              
              <div class="content">
                <div class="success-badge">
                  ${
                    isFreeRegistration
                      ? "✅ FREE Registration"
                      : "✅ Payment Confirmed"
                  }
                </div>
                
                <h2 style="color: #1f2937; margin-bottom: 8px;">Dear ${
                  user.firstName
                } ${user.lastName},</h2>
                
                <p style="font-size: 16px; color: #4b5563; margin-bottom: 30px;">
                  Congratulations! Your registration has been successfully confirmed for ${
                    registeredCourses.length > 1
                      ? `${registeredCourses.length} courses`
                      : `<strong>${registeredCourses[0].title}</strong>`
                  }. 
                  We're excited to have you join our professional aesthetic training program${
                    registeredCourses.length > 1 ? "s" : ""
                  }.
                </p>

                <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📋 Registration Summary</h3>
                
                <table class="course-table">
                  <thead>
                    <tr style="background: #f8fafc;">
                      <th style="padding: 16px 0; text-align: left; color: #374151; font-weight: 600;">Course Details</th>
                      <th style="padding: 16px 0; text-align: right; color: #374151; font-weight: 600;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${courseListHtml}
                  </tbody>
                </table>

                ${
                  totalSavings > 0
                    ? `
                <div class="summary-box">
                  <h4 style="margin: 0 0 16px 0; color: #059669;">💰 Your Savings Summary</h4>
                  <table style="width: 100%; font-size: 14px;">
                    <tr>
                      <td style="padding: 4px 0; color: #6b7280;">Original Total:</td>
                      <td style="text-align: right; color: #6b7280;">€${totalOriginalPrice.toFixed(
                        2
                      )}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #10b981; font-weight: 600;">Total Savings:</td>
                      <td style="text-align: right; color: #10b981; font-weight: 600;">-€${totalSavings.toFixed(
                        2
                      )}</td>
                    </tr>
                    <tr style="border-top: 2px solid #e5e7eb;">
                      <td style="padding: 8px 0 0 0; font-weight: 600; font-size: 16px;">Final Amount:</td>
                      <td style="text-align: right; font-weight: 600; font-size: 16px; padding: 8px 0 0 0;">€${totalFinalPrice.toFixed(
                        2
                      )}</td>
                    </tr>
                  </table>
                </div>
                `
                    : ""
                }

                <div class="summary-box">
                  <h4 style="margin: 0 0 12px 0; color: #1f2937;">📄 Transaction Details</h4>
                  <p style="margin: 6px 0; font-size: 14px;"><strong>Reference Number:</strong> ${
                    transactionInfo.referenceNumber ||
                    transactionInfo.receiptNumber ||
                    "N/A"
                  }</p>
                  <p style="margin: 6px 0; font-size: 14px;"><strong>Registration Date:</strong> ${new Date().toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}</p>
                  <p style="margin: 6px 0; font-size: 14px;"><strong>Payment Method:</strong> ${
                    isPromoCode
                      ? "Promo Code Applied"
                      : isFreeRegistration
                      ? "Free Registration"
                      : "CCAvenue Payment Gateway"
                  }</p>
                  ${
                    transactionInfo.orderNumber
                      ? `<p style="margin: 6px 0; font-size: 14px;"><strong>Order Number:</strong> ${transactionInfo.orderNumber}</p>`
                      : ""
                  }
                </div>

                <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🚀 What's Next?</h3>
                
                ${accessInstructionsHtml}

                <div class="next-steps">
                  <h4 style="margin: 0 0 12px 0; color: #1e40af;">🎯 Important Next Steps:</h4>
                  <ul style="margin: 0; padding-left: 20px; color: #1e3a8a;">
                    <li style="margin: 8px 0;">📚 <strong>Access your Student Library:</strong> View all your courses and materials</li>
                    <li style="margin: 8px 0;">👤 <strong>Complete your profile:</strong> Ensure your professional information is up to date</li>
                    <li style="margin: 8px 0;">📧 <strong>Check your email regularly:</strong> We'll send important updates and joining instructions</li>
                    <li style="margin: 8px 0;">🏆 <strong>Prepare for success:</strong> Review any pre-course materials provided</li>
                  </ul>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                  <a href="${
                    process.env.BASE_URL
                  }/library" class="button">Access My Courses</a>
                </div>

                <div style="border-top: 1px solid #e5e7eb; padding-top: 30px; margin-top: 40px;">
                  <h4 style="color: #374151; margin-bottom: 16px;">📞 Need Help?</h4>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                    Our support team is here to help! If you have any questions about your registration or courses:
                    <br>📧 Email: <a href="mailto:support@iaai-institute.com" style="color: #10b981;">support@iaai-institute.com</a>
                    <br>🌐 Visit: <a href="${
                      process.env.BASE_URL
                    }/contact-us" style="color: #10b981;">Contact Support</a>
                  </p>
                </div>

                <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                  <p style="margin: 0; color: #1e40af; font-weight: 600;">
                    🌟 Thank you for choosing IAAI Training Institute for your professional development!
                  </p>
                </div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>IAAI Training Institute</strong></p>
                <p style="margin: 0 0 16px 0;">International Aesthetic Academic Institution</p>
                <p style="margin: 0; font-size: 12px;">
                  This is an automated confirmation email. Please do not reply to this email address.
                  <br>If you need assistance, please contact our support team.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sendEmail(mailOptions);

      console.log(
        `✅ Course registration confirmation email sent to ${user.email}`
      );
      console.log(`📊 Courses registered: ${registeredCourses.length}`);
      console.log(
        `💰 Total amount: €${totalFinalPrice.toFixed(
          2
        )} (Original: €${totalOriginalPrice.toFixed(2)})`
      );

      return { success: true };
    } catch (error) {
      console.error(
        "❌ Error sending course registration confirmation email:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // NEW COURSE REMINDER EMAILS
  // ============================================

  // Course reminder email method
  async sendCourseStartingReminder(user, course, courseType, enrollment) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send course starting reminder to:",
        user.email
      );
      return { success: true };
    }

    try {
      const startDate = new Date(
        course.schedule?.startDate || course.startDate
      );
      const isOnline = courseType === "OnlineLiveTraining" || course.platform;

      // Generate course-specific information
      const courseInfo = this.generateCourseReminderInfo(
        course,
        courseType,
        isOnline
      );

      const mailOptions = {
        to: user.email,
        subject: `Reminder: ${
          course.basic?.title || course.title
        } starts tomorrow!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Course Starting Tomorrow</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f9fafb; }
              .container { max-width: 650px; margin: 0 auto; background: #ffffff; }
              .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 40px 30px; text-align: center; }
              .content { padding: 40px 30px; }
              .course-details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 30px 0; }
              .checklist { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 30px 0; }
              .checklist-item { padding: 8px 0; font-size: 15px; color: #374151; }
              .button { display: inline-block; padding: 14px 28px; background: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 8px; }
              .urgent-box { background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
              .footer { background: #f8fafc; padding: 30px; text-align: center; font-size: 14px; color: #6b7280; border-top: 1px solid #e5e7eb; }
              .countdown { background: #dc2626; color: white; padding: 12px 20px; border-radius: 25px; font-weight: bold; display: inline-block; margin: 10px 0; }
              .info-table { width: 100%; border-collapse: collapse; }
              .info-table td { padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
              .info-table td:first-child { font-weight: 600; color: #374151; width: 140px; }
              .tech-req { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .location-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="countdown">⏰ STARTS TOMORROW</div>
                <h1 style="margin: 16px 0 8px 0; font-size: 28px;">Course Reminder</h1>
                <p style="margin: 0; font-size: 18px; opacity: 0.9;">${
                  course.basic?.title || course.title
                }</p>
              </div>
              
              <div class="content">
                <h2 style="color: #1f2937; margin-bottom: 8px;">Dear ${
                  user.firstName
                },</h2>
                
                <div class="urgent-box">
                  <h3 style="margin: 0 0 8px 0; color: #92400e;">📅 Your course starts tomorrow!</h3>
                  <p style="margin: 0; color: #92400e; font-weight: 500;">
                    We're excited to see you at <strong>${
                      course.basic?.title || course.title
                    }</strong>
                  </p>
                </div>

                <div class="course-details">
                  <h3 style="margin: 0 0 20px 0; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                    📋 Course Information
                  </h3>
                  
                  <table class="info-table">
                    <tr>
                      <td>📅 Date:</td>
                      <td>${startDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</td>
                    </tr>
                    <tr>
                      <td>🕐 Time:</td>
                      <td>${startDate.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}</td>
                    </tr>
                    ${
                      course.schedule?.duration
                        ? `
                    <tr>
                      <td>⏱️ Duration:</td>
                      <td>${course.schedule.duration}</td>
                    </tr>
                    `
                        : ""
                    }
                    <tr>
                      <td>👨‍🏫 Instructor:</td>
                      <td>${courseInfo.instructorName}</td>
                    </tr>
                    <tr>
                      <td>📚 Course Code:</td>
                      <td><strong>${
                        course.basic?.courseCode || course.courseCode || "N/A"
                      }</strong></td>
                    </tr>
                    ${
                      isOnline && course.schedule?.timezone
                        ? `
                    <tr>
                      <td>🌍 Timezone:</td>
                      <td>${course.schedule.timezone}</td>
                    </tr>
                    `
                        : ""
                    }
                  </table>
                </div>

                ${
                  isOnline
                    ? this.generateOnlineReminderContent(course)
                    : this.generateInPersonReminderContent(course)
                }

                <div class="checklist">
                  <h3 style="margin: 0 0 20px 0; color: #1f2937;">✅ Pre-Course Checklist</h3>
                  ${courseInfo.checklistItems
                    .map(
                      (item) => `<div class="checklist-item">• ${item}</div>`
                    )
                    .join("")}
                </div>

                ${
                  courseInfo.specialInstructions
                    ? `
                <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 30px 0;">
                  <h4 style="margin: 0 0 12px 0; color: #92400e;">⚠️ Important Instructions</h4>
                  <div style="color: #92400e;">${courseInfo.specialInstructions}</div>
                </div>
                `
                    : ""
                }

                <div style="text-align: center; margin: 40px 0;">
                  <a href="${
                    process.env.BASE_URL
                  }/library" class="button">View Course Details</a>
                  ${
                    isOnline && course.platform?.accessUrl
                      ? `<a href="${course.platform.accessUrl}" class="button" style="background: #10b981;">Join Online Session</a>`
                      : ""
                  }
                </div>

                <div style="border-top: 1px solid #e5e7eb; padding-top: 30px; margin-top: 40px;">
                  <h4 style="color: #374151; margin-bottom: 16px;">📞 Need Help?</h4>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                    If you have any questions or concerns before the course starts:
                    <br>📧 Email: <a href="mailto:support@iaai-institute.com" style="color: #f59e0b;">support@iaai-institute.com</a>
                    <br>📱 Emergency contact: Available in your course materials
                    <br>🌐 Support: <a href="${
                      process.env.BASE_URL
                    }/contact-us" style="color: #f59e0b;">Contact Us</a>
                  </p>
                </div>

                <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                  <p style="margin: 0; color: #1e40af; font-weight: 600;">
                    🌟 We look forward to seeing you tomorrow! Come prepared to learn and grow.
                  </p>
                </div>
              </div>

              <div class="footer">
                <p style="margin: 0 0 8px 0;"><strong>IAAI Training Institute</strong></p>
                <p style="margin: 0 0 16px 0;">Professional Aesthetic Training Excellence</p>
                <p style="margin: 0; font-size: 12px;">
                  This is an automated reminder email. If you need to make changes to your registration,
                  <br>please contact our support team as soon as possible.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sendEmail(mailOptions);

      console.log(
        `✅ Course reminder email sent to ${user.email} for ${
          course.basic?.title || course.title
        }`
      );
      return { success: true };
    } catch (error) {
      console.error("❌ Error sending course reminder email:", error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to generate online course reminder content
  generateOnlineReminderContent(course) {
    return `
      <div class="tech-req">
        <h4 style="margin: 0 0 16px 0; color: #1e40af;">💻 Online Session Information</h4>
        <div style="color: #1e3a8a;">
          <p style="margin: 8px 0;"><strong>Platform:</strong> ${
            course.platform?.name || "Will be provided"
          }</p>
          ${
            course.platform?.accessUrl
              ? `<p style="margin: 8px 0;"><strong>Join Link:</strong> <a href="${course.platform.accessUrl}" style="color: #1e40af;">Click here to join</a></p>`
              : '<p style="margin: 8px 0;"><strong>Join Link:</strong> Will be sent 30 minutes before session</p>'
          }
          ${
            course.platform?.meetingId
              ? `<p style="margin: 8px 0;"><strong>Meeting ID:</strong> ${course.platform.meetingId}</p>`
              : ""
          }
          ${
            course.platform?.passcode
              ? `<p style="margin: 8px 0;"><strong>Passcode:</strong> ${course.platform.passcode}</p>`
              : ""
          }
        </div>
      </div>
    `;
  }

  // Helper method to generate in-person course reminder content
  generateInPersonReminderContent(course) {
    const venue = course.venue || {};
    return `
      <div class="location-box">
        <h4 style="margin: 0 0 16px 0; color: #065f46;">🏢 Venue Information</h4>
        <div style="color: #064e3b;">
          <p style="margin: 8px 0;"><strong>Location:</strong> ${
            venue.name || "TBA"
          }</p>
          ${
            venue.address
              ? `<p style="margin: 8px 0;"><strong>Address:</strong> ${venue.address}</p>`
              : ""
          }
          ${
            venue.city
              ? `<p style="margin: 8px 0;"><strong>City:</strong> ${venue.city}</p>`
              : ""
          }
          ${
            venue.directions
              ? `<p style="margin: 8px 0;"><strong>Directions:</strong> ${venue.directions}</p>`
              : ""
          }
          ${
            venue.parking
              ? `<p style="margin: 8px 0;"><strong>Parking:</strong> ${venue.parking}</p>`
              : ""
          }
          ${
            venue.contactNumber
              ? `<p style="margin: 8px 0;"><strong>Contact:</strong> ${venue.contactNumber}</p>`
              : ""
          }
        </div>
      </div>
    `;
  }

  // Helper method to generate course-specific reminder information
  generateCourseReminderInfo(course, courseType, isOnline) {
    const instructorName =
      course.instructors?.primary?.name ||
      course.instructor?.name ||
      "Your instructor";

    const baseChecklist = [
      "Review course materials if provided in advance",
      "Prepare any questions you might have",
      "Ensure you have a notebook and pen for taking notes",
    ];

    let checklistItems = [...baseChecklist];
    let specialInstructions = "";

    if (isOnline) {
      checklistItems.unshift(
        "Test your internet connection (stable broadband recommended)",
        "Check your camera and microphone are working",
        "Find a quiet, well-lit space for the session",
        "Have the platform app/browser ready 15 minutes early"
      );

      if (course.technicalRequirements) {
        const tech = course.technicalRequirements;
        if (tech.internetSpeed?.recommended) {
          specialInstructions += `<p>• Internet Speed: ${tech.internetSpeed.recommended} required</p>`;
        }
        if (tech.equipment?.camera) {
          specialInstructions += `<p>• Camera: ${tech.equipment.camera}</p>`;
        }
        if (tech.requiredSoftware?.length > 0) {
          specialInstructions += `<p>• Required Software: ${tech.requiredSoftware.join(
            ", "
          )}</p>`;
        }
      }
    } else {
      checklistItems.unshift(
        "Plan your route and allow extra time for travel",
        "Check the weather forecast and dress appropriately",
        "Bring required identification (if specified)",
        "Arrive 15-20 minutes early for registration"
      );

      if (course.requirements?.materials?.length > 0) {
        specialInstructions += `<p><strong>Required Materials:</strong> ${course.requirements.materials.join(
          ", "
        )}</p>`;
      }
      if (course.requirements?.attire) {
        specialInstructions += `<p><strong>Dress Code:</strong> ${course.requirements.attire}</p>`;
      }
    }

    return {
      instructorName,
      checklistItems,
      specialInstructions,
    };
  }

  // ============================================
  // CERTIFICATE EMAILS
  // ============================================

  async sendCertificateEarnedEmail(user, certificate, course) {
    if (this.mockMode) {
      console.log("📧 [MOCK] Would send certificate email to:", user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: `Congratulations! Certificate Earned - ${course.title}`,
        html: `
          <h2>🎉 Congratulations!</h2>
          <p>Dear ${user.firstName},</p>
          <p>You have successfully completed <strong>${
            course.title
          }</strong> and earned your certificate!</p>
          <h3>Certificate Details:</h3>
          <ul>
            <li>Certificate ID: ${certificate.certificateId}</li>
            <li>Course: ${course.title}</li>
            <li>Completion Date: ${new Date(
              certificate.certificateDetails.completionDate
            ).toLocaleDateString()}</li>
            <li>Verification Code: ${
              certificate.certificateDetails.verificationCode
            }</li>
          </ul>
          <p>You can download your certificate from your dashboard.</p>
          <p>Congratulations on your achievement!</p>
          <p>Best regards,<br>IAAI Team</p>
        `,
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error("Error sending certificate email:", error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // COURSE ANNOUNCEMENT EMAILS
  // ============================================

  // Schedule new course notification (2 hours after creation)
  scheduleNewCourseNotification(courseId, courseData, recipients) {
    const jobId = `new-course-${courseId}`;
    const sendTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    console.log(`📧 Scheduling new course email for ${sendTime}`);

    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would schedule email to",
        recipients.length,
        "recipients"
      );
      return jobId;
    }

    const job = schedule.scheduleJob(sendTime, async () => {
      await this.sendNewCourseAnnouncement(courseData, recipients);
      this.scheduledJobs.delete(jobId);
    });

    this.scheduledJobs.set(jobId, job);
    return jobId;
  }

  // Cancel scheduled notification
  cancelScheduledNotification(courseId) {
    const jobId = `new-course-${courseId}`;
    const job = this.scheduledJobs.get(jobId);

    if (job) {
      job.cancel();
      this.scheduledJobs.delete(jobId);
      console.log(`❌ Cancelled scheduled email for course ${courseId}`);
    }
  }

  // Enhanced sendNewCourseAnnouncement that handles both in-person and online courses
  async sendNewCourseAnnouncement(course, recipients = null) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send course announcement for:",
        course.title
      );
      return { success: true };
    }

    try {
      // If no recipients provided, get all subscribed users
      if (!recipients) {
        const users = await User.find(
          {
            isConfirmed: true,
            "notificationSettings.courseUpdates": true,
          },
          "email firstName lastName"
        );
        recipients = users;
      }

      // Determine if it's an online course
      const isOnlineCourse =
        course.courseType === "OnlineLiveTraining" || course.platform;

      const courseTypeLabel =
        {
          InPersonAestheticTraining: "In-Person Training",
          OnlineLiveTraining: "Live Online Training",
          SelfPacedOnlineTraining: "Self-Paced Online Course",
        }[course.courseType] ||
        course.courseType ||
        "Training Course";

      const mailOptions = {
        to: process.env.EMAIL_FROM || process.env.EMAIL_USER, // Send to self
        bcc: recipients
          .map((r) => (typeof r === "string" ? r : r.email))
          .join(","), // BCC all recipients
        subject: `New Course Available: ${course.title}`,
        html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                        .course-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                        .badge { display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #3730a3; border-radius: 20px; font-size: 14px; margin-bottom: 10px; }
                        .platform-badge { background: #10b981; color: white; }
                        .tech-req { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎓 New ${courseTypeLabel} Available!</h1>
                        </div>
                        <div class="content">
                            <span class="badge">${
                              course.category || "Professional Training"
                            }</span>
                            ${
                              isOnlineCourse
                                ? `<span class="badge platform-badge">${
                                    course.platform || "Online"
                                  }</span>`
                                : ""
                            }
                            
                            <h2>${course.title}</h2>
                            <p>${course.description}</p>
                            
                            <div class="course-details">
                                <h3>Course Details:</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Course Code:</strong></td>
                                        <td>${course.courseCode}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Start Date:</strong></td>
                                        <td>${new Date(
                                          course.startDate
                                        ).toLocaleDateString("en-US", {
                                          weekday: "long",
                                          year: "numeric",
                                          month: "long",
                                          day: "numeric",
                                        })}</td>
                                    </tr>
                                    ${
                                      isOnlineCourse && course.primaryTimezone
                                        ? `
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Timezone:</strong></td>
                                        <td>${course.primaryTimezone} ${
                                            course.displayTimezones?.length > 0
                                              ? `(Also shown in: ${course.displayTimezones.join(
                                                  ", "
                                                )})`
                                              : ""
                                          }</td>
                                    </tr>
                                    `
                                        : ""
                                    }
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Duration:</strong></td>
                                        <td>${
                                          course.duration ||
                                          "See course details"
                                        }</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Instructor:</strong></td>
                                        <td>${course.instructor}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Price:</strong></td>
                                        <td>${
                                          course.currency === "USD"
                                            ? "$"
                                            : course.currency
                                        }${course.price}</td>
                                    </tr>
                                    ${
                                      course.earlyBirdPrice
                                        ? `
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Early Bird Price:</strong></td>
                                        <td style="color: #10b981; font-weight: bold;">${
                                          course.currency === "USD"
                                            ? "$"
                                            : course.currency
                                        }${course.earlyBirdPrice}</td>
                                    </tr>
                                    `
                                        : ""
                                    }
                                    ${
                                      !isOnlineCourse && course.location
                                        ? `
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Location:</strong></td>
                                        <td>${course.location}</td>
                                    </tr>
                                    `
                                        : ""
                                    }
                                    ${
                                      isOnlineCourse && course.platform
                                        ? `
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Platform:</strong></td>
                                        <td>${course.platform}</td>
                                    </tr>
                                    `
                                        : ""
                                    }
                                    <tr>
                                        <td style="padding: 8px 0;"><strong>Certificate:</strong></td>
                                        <td>${
                                          course.certificateProvided
                                            ? "✅ Certificate Provided"
                                            : "No Certificate"
                                        }</td>
                                    </tr>
                                </table>
                            </div>
                            
                            ${
                              course.objectives && course.objectives.length > 0
                                ? `
                            <div style="margin: 20px 0;">
                                <h3>What You'll Learn:</h3>
                                <ul style="margin: 0; padding-left: 20px;">
                                    ${course.objectives
                                      .slice(0, 3)
                                      .map((obj) => `<li>${obj}</li>`)
                                      .join("")}
                                    ${
                                      course.objectives.length > 3
                                        ? "<li>And more...</li>"
                                        : ""
                                    }
                                </ul>
                            </div>
                            `
                                : ""
                            }
                            
                            <center>
                                <a href="${process.env.BASE_URL}/courses/${
          course._id
        }" class="button">View Course Details & Register</a>
                            </center>
                            
                            <p style="text-align: center; color: #666; margin-top: 20px;">
                                <em>Limited seats available - Register early to secure your spot!</em>
                            </p>
                        </div>
                        <div class="footer">
                            <p>You received this email because you're subscribed to course updates from IAAI Training Institute.</p>
                            <p><a href="${
                              process.env.BASE_URL
                            }/account/notifications">Update Preferences</a> | <a href="${
          process.env.BASE_URL
        }/unsubscribe">Unsubscribe</a></p>
                        </div>
                    </div>
                </body>
                </html>
            `,
      };

      // Send in batches if many recipients
      if (recipients.length > 50) {
        const batchSize = 50;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          mailOptions.bcc = batch
            .map((r) => (typeof r === "string" ? r : r.email))
            .join(",");
          await sendEmail(mailOptions);
          console.log(
            `✅ Sent new course email to batch ${Math.floor(i / batchSize) + 1}`
          );
        }
      } else {
        await sendEmail(mailOptions);
      }

      return { success: true };
    } catch (error) {
      console.error("Error sending course announcement:", error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // ADDITIONAL COURSE COMMUNICATION METHODS
  // ============================================

  // Send course update notification to registered students
  async sendCourseUpdateEmail(courseData, updateDetails, registeredStudents) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send update email to",
        registeredStudents.length,
        "students"
      );
      return { success: true };
    }

    try {
      for (const student of registeredStudents) {
        const mailOptions = {
          to: student.email,
          subject: `Important Update: ${courseData.title}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .update-box { background: #fff3cd; border: 2px solid #ffeaa7; padding: 20px; margin: 20px 0; border-radius: 8px; }
                .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📢 Course Update</h1>
                </div>
                <div class="content">
                  <h2>${courseData.title}</h2>
                  <p>Dear ${student.firstName},</p>
                  <p>There have been important updates to your registered course:</p>
                  
                  <div class="update-box">
                    <h3>What's Changed:</h3>
                    ${updateDetails}
                  </div>
                  
                  <p>Please review these changes carefully as they may affect your attendance.</p>
                  
                  <center>
                    <a href="${process.env.BASE_URL}/library" class="button">View My Courses</a>
                  </center>
                  
                  <p>If you have any questions, please don't hesitate to contact us.</p>
                  <p>Best regards,<br>IAAI Team</p>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        await sendEmail(mailOptions);
      }

      console.log(
        `✅ Sent update emails to ${registeredStudents.length} students`
      );
      return { success: true };
    } catch (error) {
      console.error("Error sending update emails:", error);
      return { success: false, error: error.message };
    }
  }

  // Send course cancellation notification
  async sendCourseCancellationEmail(courseData, registeredStudents) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send cancellation email to",
        registeredStudents.length,
        "students"
      );
      return { success: true };
    }

    try {
      for (const student of registeredStudents) {
        const mailOptions = {
          to: student.email,
          subject: `Course Cancelled: ${courseData.title}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert-box { background: #f8d7da; border: 2px solid #f5c6cb; padding: 20px; margin: 20px 0; border-radius: 8px; color: #721c24; }
                .button { display: inline-block; padding: 12px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>❌ Course Cancellation Notice</h1>
                </div>
                <div class="content">
                  <p>Dear ${student.firstName},</p>
                  
                  <div class="alert-box">
                    <h2>Important: Course Cancelled</h2>
                    <p>We regret to inform you that the following course has been cancelled:</p>
                    <ul style="margin: 10px 0;">
                      <li><strong>Course:</strong> ${courseData.title}</li>
                      <li><strong>Course Code:</strong> ${
                        courseData.courseCode
                      }</li>
                      <li><strong>Original Date:</strong> ${new Date(
                        courseData.startDate
                      ).toLocaleDateString()}</li>
                    </ul>
                  </div>
                  
                  <h3>Next Steps:</h3>
                  <ul>
                    <li>You will receive a full refund within 5-7 business days</li>
                    <li>Alternatively, you can transfer your registration to another course</li>
                    <li>Our team will contact you within 24 hours to assist you</li>
                  </ul>
                  
                  <p>We sincerely apologize for any inconvenience caused.</p>
                  
                  <center>
                    <a href="${
                      process.env.BASE_URL
                    }/contact" class="button">Contact Support</a>
                  </center>
                  
                  <p>Best regards,<br>IAAI Team</p>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        await sendEmail(mailOptions);
      }

      console.log(
        `✅ Sent cancellation emails to ${registeredStudents.length} students`
      );
      return { success: true };
    } catch (error) {
      console.error("Error sending cancellation emails:", error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // INSTRUCTOR NOTIFICATIONS
  // ============================================

  // Send notification to instructors
  async sendInstructorNotification(courseData, instructorEmails) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send instructor notification to:",
        instructorEmails
      );
      return { success: true };
    }

    const jobId = `instructor-${courseData._id}-${Date.now()}`;
    const sendTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

    const job = schedule.scheduleJob(sendTime, async () => {
      try {
        for (const email of instructorEmails) {
          const mailOptions = {
            to: email,
            subject: `Course Assignment: ${courseData.title}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                  .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>📚 Course Assignment</h1>
                  </div>
                  <div class="content">
                    <h2>You've been assigned to teach:</h2>
                    <h3>${courseData.title}</h3>
                    
                    <table style="width: 100%; margin: 20px 0;">
                      <tr>
                        <td style="padding: 8px 0;"><strong>Course Code:</strong></td>
                        <td>${courseData.courseCode}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Start Date:</strong></td>
                        <td>${new Date(
                          courseData.startDate
                        ).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Duration:</strong></td>
                        <td>${courseData.duration || "TBD"}</td>
                      </tr>
                      ${
                        courseData.location
                          ? `
                      <tr>
                        <td style="padding: 8px 0;"><strong>Location:</strong></td>
                        <td>${courseData.location}</td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        courseData.platform
                          ? `
                      <tr>
                        <td style="padding: 8px 0;"><strong>Platform:</strong></td>
                        <td>${courseData.platform}</td>
                      </tr>
                      `
                          : ""
                      }
                    </table>
                    
                    <p>Please log in to your instructor portal to view complete course details and materials.</p>
                    
                    <center>
                      <a href="${
                        process.env.BASE_URL
                      }/instructor/dashboard" class="button">View Course Details</a>
                    </center>
                    
                    <p>If you have any questions, please contact the admin team.</p>
                    <p>Best regards,<br>IAAI Team</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          };

          await sendEmail(mailOptions);
        }

        console.log(
          `✅ Sent instructor notifications to ${instructorEmails.length} instructors`
        );
        this.scheduledJobs.delete(jobId);
      } catch (error) {
        console.error("Error sending instructor notifications:", error);
      }
    });

    this.scheduledJobs.set(jobId, job);
    return { success: true };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  // Test email configuration
  async testEmailConfiguration() {
    if (this.mockMode) {
      return {
        success: true,
        message:
          "Email service is in MOCK mode. Set EMAIL_USER and EMAIL_PASS in .env to enable real emails.",
      };
    }

    try {
      const testEmail = {
        to: process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER,
        subject: "IAAI Email Service Test",
        html: `
          <h2>Email Service Test</h2>
          <p>This is a test email from IAAI Training Institute.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <p>Timestamp: ${new Date().toLocaleString()}</p>
        `,
      };

      const result = await sendEmail(testEmail);
      return {
        success: true,
        message: "Test email sent successfully!",
        details: result,
      };
    } catch (error) {
      return {
        success: false,
        message: "Email test failed",
        error: error.message,
      };
    }
  }

  // Configuration methods
  configureBulkEmailMethod(method = "bcc") {
    // Options: 'bcc' (default), 'individual', 'batch'
    this.bulkEmailMethod = method;
    console.log(`📧 Bulk email method set to: ${method}`);
  }

  // Get notification recipients
  static async getNotificationRecipients(emailType = "course_announcement") {
    const filter = {
      isConfirmed: true,
      "accountStatus.isLocked": { $ne: true },
      "notificationSettings.email": true,
    };

    // For commercial emails (new course announcements)
    if (emailType === "course_announcement") {
      filter["notificationSettings.courseUpdates"] = true;
    }

    return User.find(filter).select("email firstName lastName");
  }

  // ============================================
  // LEGACY METHODS (FOR BACKWARD COMPATIBILITY)
  // ============================================

  async sendCourseRegistrationEmail(user, courses, paymentInfo) {
    // Legacy method - redirect to new enhanced method
    const transactionInfo = {
      referenceNumber: paymentInfo?.transactionId || "N/A",
      receiptNumber: paymentInfo?.transactionId || "N/A",
      orderNumber: paymentInfo?.orderNumber || "N/A",
      finalAmount: paymentInfo?.totalAmount || 0,
      paymentMethod: paymentInfo?.paymentMethod || "Unknown",
    };

    return await this.sendCourseRegistrationConfirmation(
      user,
      courses,
      transactionInfo,
      false
    );
  }

  // ============================================
  // ADDITIONAL REMINDER AND NOTIFICATION METHODS
  // ============================================

  // Send custom course message
  async sendCustomCourseMessage(user, course, customMessage) {
    if (this.mockMode) {
      console.log("📧 [MOCK] Would send custom message to:", user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: `Important Update: ${course.title}`,
        html: `
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
                <h2>${course.title}</h2>
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
        `,
      };

      await sendEmail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Error sending custom course message:", error);
      return { success: false, error: error.message };
    }
  }

  // Send certificate completion notification (1 day after course ends)
  async sendCertificateCompletionNotification(user, course) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send certificate completion notification to:",
        user.email
      );
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: `Course Completed: ${course.title} - Certificate Available`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Course Completed!</h1>
              </div>
              <div class="content">
                <h2>${course.title}</h2>
                <p>Dear ${user.firstName},</p>
                <p>Congratulations on completing the course! We hope you found it valuable and informative.</p>
                
                ${
                  course.certificateProvided
                    ? `
                  <p><strong>🏆 Certificate Available:</strong> Your certificate is ready for download in your course library.</p>
                `
                    : ""
                }
                
                <h3>Next Steps:</h3>
                <ul>
                  <li>Access your course materials anytime in your library</li>
                  ${
                    course.certificateProvided
                      ? "<li>Download your certificate of completion</li>"
                      : ""
                  }
                  <li>Leave a review to help other students</li>
                  <li>Explore our other courses to continue learning</li>
                </ul>
                
                <center>
                  <a href="${
                    process.env.BASE_URL
                  }/library" class="button">Access My Library</a>
                </center>
                
                <p>Thank you for choosing IAAI Training Institute. We look forward to seeing you in future courses!</p>
                <p>Best regards,<br>IAAI Team</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await sendEmail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error(
        "Error sending certificate completion notification:",
        error
      );
      return { success: false, error: error.message };
    }
  }

  // Schedule post-course notification (1 day after course ends)
  schedulePostCourseNotification(courseId, courseData, recipients) {
    const courseEndDate = new Date(courseData.endDate || courseData.startDate);
    const notificationDate = new Date(
      courseEndDate.getTime() + 24 * 60 * 60 * 1000
    ); // 1 day after

    const jobId = `post-course-${courseId}`;

    console.log(
      `📧 Scheduling post-course notification for ${notificationDate}`
    );

    if (this.mockMode) {
      console.log("📧 [MOCK] Would schedule post-course notification");
      return jobId;
    }

    const job = schedule.scheduleJob(notificationDate, async () => {
      for (const recipient of recipients) {
        await this.sendCertificateCompletionNotification(recipient, courseData);
      }
      this.scheduledJobs.delete(jobId);
    });

    this.scheduledJobs.set(jobId, job);
    return jobId;
  }

  // Send tech check reminder (specific to online courses)
  async sendTechCheckReminder(user, course) {
    if (this.mockMode) {
      console.log("📧 [MOCK] Would send tech check reminder to:", user.email);
      return { success: true };
    }

    try {
      const techCheckDate = new Date(course.technical?.techCheckDate);

      const mailOptions = {
        to: user.email,
        subject: `Tech Check Reminder: ${course.title}`,
        html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .tech-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #e5e7eb; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🖥️ Tech Check Reminder</h1>
                        </div>
                        <div class="content">
                            <h2>${course.title}</h2>
                            <p>Dear ${user.firstName},</p>
                            <p>Your technical check session is scheduled for:</p>
                            
                            <div class="tech-box">
                                <h3>📅 Tech Check Details</h3>
                                <p><strong>Date:</strong> ${techCheckDate.toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                )}</p>
                                <p><strong>Time:</strong> ${techCheckDate.toLocaleTimeString(
                                  "en-US",
                                  { hour: "2-digit", minute: "2-digit" }
                                )}</p>
                                <p><strong>Platform:</strong> ${
                                  course.platform
                                }</p>
                                ${
                                  course.technical?.techCheckUrl
                                    ? `<p><strong>Join Link:</strong> <a href="${course.technical.techCheckUrl}">Click here to join</a></p>`
                                    : ""
                                }
                            </div>
                            
                            <h3>📋 Please Check:</h3>
                            <ul>
                                <li>✅ Your internet connection (${
                                  course.technicalRequirements?.internetSpeed
                                    ?.recommended || "stable connection"
                                } recommended)</li>
                                <li>✅ Camera and microphone are working</li>
                                <li>✅ You have installed any required software</li>
                                <li>✅ You can access the course platform</li>
                            </ul>
                            
                            <center>
                                ${
                                  course.technical?.techCheckUrl
                                    ? `<a href="${course.technical.techCheckUrl}" class="button">Join Tech Check</a>`
                                    : `<a href="${process.env.BASE_URL}/library" class="button">View Course Details</a>`
                                }
                            </center>
                            
                            <p>This tech check ensures you're ready for the course and helps resolve any technical issues in advance.</p>
                            <p>Best regards,<br>IAAI Team</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
      };

      await sendEmail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Error sending tech check reminder:", error);
      return { success: false, error: error.message };
    }
  }

  // Send post-course recording access notification
  async sendRecordingAvailableNotification(user, course) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send recording notification to:",
        user.email
      );
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: `Course Recording Available: ${course.title}`,
        html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎥 Course Recording Available</h1>
                        </div>
                        <div class="content">
                            <h2>${course.title}</h2>
                            <p>Dear ${user.firstName},</p>
                            <p>Great news! The recording for your recent online course is now available.</p>
                            
                            <h3>📺 Recording Access:</h3>
                            <ul>
                                <li>Available for ${
                                  course.recordingDuration || 90
                                } days</li>
                                ${
                                  course.recording?.autoTranscription
                                    ? "<li>✅ Includes automatic transcription</li>"
                                    : ""
                                }
                                ${
                                  course.recording?.availability?.downloadable
                                    ? "<li>✅ Download available</li>"
                                    : "<li>Streaming only (no download)</li>"
                                }
                            </ul>
                            
                            <center>
                                <a href="${
                                  process.env.BASE_URL
                                }/library" class="button">Access Recording</a>
                            </center>
                            
                            <p>Don't forget to download any course materials before your access expires.</p>
                            <p>Best regards,<br>IAAI Team</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
      };

      await sendEmail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Error sending recording notification:", error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // BULK EMAIL METHODS (ENHANCED)
  // ============================================

  // Send individual emails to each recipient (for better personalization)
  async sendNewCourseAnnouncementIndividual(course, recipients) {
    if (this.mockMode) {
      console.log(
        "📧 [MOCK] Would send individual course announcements to:",
        recipients.length,
        "recipients"
      );
      return {
        success: true,
        sent: recipients.length,
        failed: 0,
        failedEmails: [],
      };
    }

    let sent = 0;
    let failed = 0;
    let failedEmails = [];

    for (const recipient of recipients) {
      try {
        const recipientEmail =
          typeof recipient === "string" ? recipient : recipient.email;
        const recipientName =
          typeof recipient === "string"
            ? "Valued Student"
            : recipient.firstName || "Valued Student";

        // Create personalized email
        const personalizedMailOptions = {
          to: recipientEmail,
          subject: `New Course Available: ${course.title} - IAAI Training`,
          html: await this.generatePersonalizedCourseAnnouncementHTML(
            course,
            recipientName
          ),
        };

        await sendEmail(personalizedMailOptions);
        sent++;

        // Small delay between emails to avoid overwhelming SMTP
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(
          `❌ Failed to send announcement to ${recipient.email || recipient}:`,
          error
        );
        failed++;
        failedEmails.push(recipient.email || recipient);
      }
    }

    console.log(
      `✅ Individual announcement emails complete - Sent: ${sent}, Failed: ${failed}`
    );
    return { success: true, sent, failed, failedEmails };
  }

  // Generate personalized course announcement HTML
  async generatePersonalizedCourseAnnouncementHTML(course, recipientName) {
    const isOnlineCourse =
      course.courseType === "OnlineLiveTraining" || course.platform;
    const courseTypeLabel =
      {
        InPersonAestheticTraining: "In-Person Training",
        OnlineLiveTraining: "Live Online Training",
        SelfPacedOnlineTraining: "Self-Paced Online Course",
      }[course.courseType] ||
      course.courseType ||
      "Training Course";

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
              .course-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
              .badge { display: inline-block; padding: 4px 12px; background: #e0e7ff; color: #3730a3; border-radius: 20px; font-size: 14px; margin-bottom: 10px; }
              .platform-badge { background: #10b981; color: white; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎓 New ${courseTypeLabel} Available!</h1>
                  <p style="margin: 0; opacity: 0.9;">Exclusively for IAAI Students</p>
              </div>
              <div class="content">
                  <p style="font-size: 16px; margin-bottom: 20px;">Dear ${recipientName},</p>
                  
                  <span class="badge">${
                    course.category || "Professional Training"
                  }</span>
                  ${
                    isOnlineCourse
                      ? `<span class="badge platform-badge">Online</span>`
                      : '<span class="badge" style="background: #f59e0b; color: white;">In-Person</span>'
                  }
                  
                  <h2>${course.title}</h2>
                  <p>${course.description}</p>
                  
                  <div class="course-details">
                      <h3>Course Highlights:</h3>
                      <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                              <td style="padding: 8px 0;"><strong>Start Date:</strong></td>
                              <td>${new Date(
                                course.startDate
                              ).toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}</td>
                          </tr>
                          <tr>
                              <td style="padding: 8px 0;"><strong>Instructor:</strong></td>
                              <td>${course.instructor}</td>
                          </tr>
                          <tr>
                              <td style="padding: 8px 0;"><strong>Investment:</strong></td>
                              <td>${
                                course.currency === "USD"
                                  ? "$"
                                  : course.currency
                              }${course.price}</td>
                          </tr>
                          ${
                            course.earlyBirdPrice
                              ? `
                          <tr>
                              <td style="padding: 8px 0;"><strong>Early Bird Special:</strong></td>
                              <td style="color: #10b981; font-weight: bold;">${
                                course.currency === "USD"
                                  ? "$"
                                  : course.currency
                              }${course.earlyBirdPrice} - Limited Time!</td>
                          </tr>
                          `
                              : ""
                          }
                          <tr>
                              <td style="padding: 8px 0;"><strong>Certificate:</strong></td>
                              <td>${
                                course.certificateProvided
                                  ? "✅ Professional Certificate Included"
                                  : "No Certificate"
                              }</td>
                          </tr>
                      </table>
                  </div>
                  
                  ${
                    course.objectives && course.objectives.length > 0
                      ? `
                  <div style="margin: 20px 0;">
                      <h3>What You'll Master:</h3>
                      <ul style="margin: 0; padding-left: 20px;">
                          ${course.objectives
                            .slice(0, 4)
                            .map(
                              (obj) => `<li style="margin: 6px 0;">${obj}</li>`
                            )
                            .join("")}
                          ${
                            course.objectives.length > 4
                              ? '<li style="color: #666;">And much more...</li>'
                              : ""
                          }
                      </ul>
                  </div>
                  `
                      : ""
                  }
                  
                  <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
                      <p style="margin: 0; color: #1e40af; font-weight: 600;">
                          ⚡ ${recipientName}, as a valued IAAI student, you get priority access to register before this course opens to the public!
                      </p>
                  </div>
                  
                  <center>
                      <a href="${process.env.BASE_URL}/courses/${
      course._id
    }?ref=email" class="button">Secure Your Spot Now</a>
                  </center>
                  
                  <p style="text-align: center; color: #666; margin-top: 20px; font-style: italic;">
                      Limited seats available • Early bird pricing ends soon
                  </p>
              </div>
              <div class="footer">
                  <p>You received this personalized invitation because you're a valued member of IAAI Training Institute.</p>
                  <p><a href="${
                    process.env.BASE_URL
                  }/account/notifications">Update Preferences</a> | <a href="${
      process.env.BASE_URL
    }/unsubscribe">Unsubscribe</a></p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  // Flexible method that supports different bulk email approaches
  async sendNewCourseAnnouncementFlexible(course, recipients = null) {
    const method = this.bulkEmailMethod || "bcc";

    switch (method) {
      case "individual":
        return await this.sendNewCourseAnnouncementIndividual(
          course,
          recipients
        );

      case "batch":
        // Send in batches but still as individual emails
        const batchSize = 10;
        let allResults = { sent: 0, failed: 0, failedEmails: [] };

        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          const result = await this.sendNewCourseAnnouncementIndividual(
            course,
            batch
          );
          allResults.sent += result.sent || 0;
          allResults.failed += result.failed || 0;
          allResults.failedEmails.push(...(result.failedEmails || []));

          // Longer delay between batches
          if (i + batchSize < recipients.length) {
            console.log(`⏳ Waiting 5 seconds before next batch...`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }

        return allResults;

      case "bcc":
      default:
        // Original BCC method
        return await this.sendNewCourseAnnouncement(course, recipients);
    }
  }

  // ============================================
  // SCHEDULING AND JOB MANAGEMENT
  // ============================================

  // Schedule reminder for a specific course (integrate with courseReminderScheduler)
  scheduleReminderEmail(
    courseId,
    courseType,
    courseData,
    enrolledUsers,
    startDate
  ) {
    const reminderDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
    const now = new Date();

    // Only schedule if reminder date is in the future
    if (reminderDate <= now) {
      console.log(
        `⚠️ Cannot schedule reminder for ${
          courseData.basic?.title || courseData.title
        } - start date is too soon`
      );
      return null;
    }

    const jobId = `reminder-${courseType}-${courseId}`;

    console.log(
      `📧 Scheduling course reminder for ${reminderDate.toLocaleString()}`
    );
    console.log(`📚 Course: ${courseData.basic?.title || courseData.title}`);
    console.log(`👥 Recipients: ${enrolledUsers.length} users`);

    if (this.mockMode) {
      console.log("📧 [MOCK] Would schedule reminder email");
      return jobId;
    }

    const job = schedule.scheduleJob(reminderDate, async () => {
      console.log(
        `📧 Sending course reminders for ${
          courseData.basic?.title || courseData.title
        }`
      );

      let successCount = 0;
      let failureCount = 0;

      for (const user of enrolledUsers) {
        try {
          const enrollment = user.getCourseEnrollment(courseId, courseType);
          await this.sendCourseStartingReminder(
            user,
            courseData,
            courseType,
            enrollment
          );
          successCount++;

          // Small delay between emails to avoid overwhelming the SMTP server
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`❌ Failed to send reminder to ${user.email}:`, error);
          failureCount++;
        }
      }

      console.log(
        `✅ Course reminder summary - Success: ${successCount}, Failed: ${failureCount}`
      );
      this.scheduledJobs.delete(jobId);
    });

    this.scheduledJobs.set(jobId, job);
    return jobId;
  }

  // Get all scheduled jobs status
  getScheduledJobsStatus() {
    const jobs = [];
    this.scheduledJobs.forEach((job, jobId) => {
      jobs.push({
        jobId,
        nextInvocation: job.nextInvocation(),
        name: job.name || "Email Job",
      });
    });
    return {
      totalJobs: this.scheduledJobs.size,
      jobs: jobs,
      mockMode: this.mockMode,
    };
  }

  // Cancel all scheduled jobs (for shutdown)
  cancelAllScheduledJobs() {
    console.log(
      `📧 Cancelling ${this.scheduledJobs.size} scheduled email jobs...`
    );
    this.scheduledJobs.forEach((job, jobId) => {
      job.cancel();
      console.log(`❌ Cancelled job: ${jobId}`);
    });
    this.scheduledJobs.clear();
    console.log("✅ All email jobs cancelled");
  }

  // ============================================
  // SHUTDOWN AND CLEANUP
  // ============================================

  shutdown() {
    console.log("📧 Shutting down Email Service...");
    this.cancelAllScheduledJobs();
    console.log("✅ Email Service shutdown complete");
  }
}

// Create and export singleton instance
module.exports = new EmailService();
