// utils/emailService.js
const sendEmail = require('./sendEmail');
const schedule = require('node-schedule');
const User = require('../models/user');

class EmailService {
  constructor() {
    // Store scheduled jobs
    this.scheduledJobs = new Map();
    
    // Check if we're in mock mode
    this.mockMode = process.env.EMAIL_MODE === 'mock' || !process.env.EMAIL_USER;
    
    if (this.mockMode) {
      console.log('📧 Email service running in MOCK mode');
    }
  }

  // Existing methods with real implementation
  async sendUserApprovalEmail(user) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send approval email to:', user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: 'Your IAAI Account Has Been Approved',
        html: `
          <h2>Welcome to IAAI Training Institute!</h2>
          <p>Dear ${user.firstName},</p>
          <p>Your account has been approved. You can now log in and access all our courses.</p>
          <p>Thank you for joining us!</p>
          <p>Best regards,<br>IAAI Team</p>
        `
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending approval email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendUserRejectionEmail(user, reason) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send rejection email to:', user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: 'IAAI Account Application Update',
        html: `
          <h2>Account Application Update</h2>
          <p>Dear ${user.firstName},</p>
          <p>We regret to inform you that your account application has not been approved at this time.</p>
          ${reason ? `<p>Reason: ${reason}</p>` : ''}
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br>IAAI Team</p>
        `
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending rejection email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCourseRegistrationEmail(user, courses, paymentInfo) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send registration email to:', user.email);
      return { success: true };
    }

    try {
      const courseList = courses.map(course => `
        <li>
          <strong>${course.title}</strong><br>
          Course Code: ${course.courseCode}<br>
          Start Date: ${new Date(course.startDate).toLocaleDateString()}<br>
          Price: $${course.price}
        </li>
      `).join('');

      const mailOptions = {
        to: user.email,
        subject: 'Course Registration Confirmation - IAAI',
        html: `
          <h2>Registration Confirmed!</h2>
          <p>Dear ${user.firstName},</p>
          <p>Thank you for registering for the following courses:</p>
          <ul>${courseList}</ul>
          <h3>Payment Details:</h3>
          <p>Transaction ID: ${paymentInfo.transactionId}</p>
          <p>Total Amount: $${paymentInfo.totalAmount}</p>
          <p>Payment Method: ${paymentInfo.paymentMethod}</p>
          <p>You can access your courses in your dashboard.</p>
          <p>Best regards,<br>IAAI Team</p>
        `
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending registration email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendCertificateEarnedEmail(user, certificate, course) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send certificate email to:', user.email);
      return { success: true };
    }

    try {
      const mailOptions = {
        to: user.email,
        subject: `Congratulations! Certificate Earned - ${course.title}`,
        html: `
          <h2>🎉 Congratulations!</h2>
          <p>Dear ${user.firstName},</p>
          <p>You have successfully completed <strong>${course.title}</strong> and earned your certificate!</p>
          <h3>Certificate Details:</h3>
          <ul>
            <li>Certificate ID: ${certificate.certificateId}</li>
            <li>Course: ${course.title}</li>
            <li>Completion Date: ${new Date(certificate.certificateDetails.completionDate).toLocaleDateString()}</li>
            <li>Verification Code: ${certificate.certificateDetails.verificationCode}</li>
          </ul>
          <p>You can download your certificate from your dashboard.</p>
          <p>Congratulations on your achievement!</p>
          <p>Best regards,<br>IAAI Team</p>
        `
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending certificate email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send password reset to:', user.email);
      return { success: true };
    }

    try {
      const resetUrl = `${process.env.BASE_URL}/reset-password/${resetToken}`;
      
      const mailOptions = {
        to: user.email,
        subject: 'Password Reset Request - IAAI',
        html: `
          <h2>Password Reset Request</h2>
          <p>Dear ${user.firstName},</p>
          <p>You have requested to reset your password. Click the link below to reset it:</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>Or copy this link: ${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br>IAAI Team</p>
        `
      };

      return await sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  // NEW METHODS FOR COURSE NOTIFICATIONS

  // Schedule new course notification (2 hours after creation)
  scheduleNewCourseNotification(courseId, courseData, recipients) {
    const jobId = `new-course-${courseId}`;
    const sendTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    console.log(`📧 Scheduling new course email for ${sendTime}`);
    
    if (this.mockMode) {
      console.log('📧 [MOCK] Would schedule email to', recipients.length, 'recipients');
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

  // Send new course announcement (enhanced version)
  async sendNewCourseAnnouncement(course, recipients = null) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send course announcement for:', course.title);
      return { success: true };
    }

    try {
      // If no recipients provided, get all subscribed users
      if (!recipients) {
        const users = await User.find(
          { 
            isConfirmed: true, 
            'notificationSettings.courseUpdates': true 
          },
          'email'
        );
        recipients = users.map(u => u.email);
      }

      const courseTypeLabel = {
        'InPersonAestheticTraining': 'In-Person Training',
        'OnlineLiveTraining': 'Live Online Training',
        'SelfPacedOnlineTraining': 'Self-Paced Online Course'
      }[course.courseType] || course.courseType;

      const mailOptions = {
        to: process.env.EMAIL_FROM || process.env.EMAIL_USER, // Send to self
        bcc: recipients.join(','), // BCC all recipients
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
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎓 New ${courseTypeLabel} Available!</h1>
              </div>
              <div class="content">
                <span class="badge">${course.category || 'Professional Training'}</span>
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
                      <td>${new Date(course.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Duration:</strong></td>
                      <td>${course.duration || 'See course details'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Instructor:</strong></td>
                      <td>${course.instructor}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0;"><strong>Price:</strong></td>
                      <td>$${course.price}</td>
                    </tr>
                    ${course.earlyBirdPrice ? `
                    <tr>
                      <td style="padding: 8px 0;"><strong>Early Bird Price:</strong></td>
                      <td style="color: #10b981; font-weight: bold;">$${course.earlyBirdPrice}</td>
                    </tr>
                    ` : ''}
                    ${course.location ? `
                    <tr>
                      <td style="padding: 8px 0;"><strong>Location:</strong></td>
                      <td>${course.location}</td>
                    </tr>
                    ` : ''}
                    ${course.platform ? `
                    <tr>
                      <td style="padding: 8px 0;"><strong>Platform:</strong></td>
                      <td>${course.platform}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 8px 0;"><strong>Certificate:</strong></td>
                      <td>${course.certificateProvided ? '✅ Certificate Provided' : 'No Certificate'}</td>
                    </tr>
                  </table>
                </div>
                
                ${course.objectives && course.objectives.length > 0 ? `
                <div style="margin: 20px 0;">
                  <h3>What You'll Learn:</h3>
                  <ul style="margin: 0; padding-left: 20px;">
                    ${course.objectives.slice(0, 3).map(obj => `<li>${obj}</li>`).join('')}
                    ${course.objectives.length > 3 ? '<li>And more...</li>' : ''}
                  </ul>
                </div>
                ` : ''}
                
                <center>
                  <a href="${process.env.BASE_URL}/courses/${course._id}" class="button">View Course Details & Register</a>
                </center>
                
                <p style="text-align: center; color: #666; margin-top: 20px;">
                  <em>Limited seats available - Register early to secure your spot!</em>
                </p>
              </div>
              <div class="footer">
                <p>You received this email because you're subscribed to course updates from IAAI Training Institute.</p>
                <p><a href="${process.env.BASE_URL}/account/notifications">Update Preferences</a> | <a href="${process.env.BASE_URL}/unsubscribe">Unsubscribe</a></p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      // Send in batches if many recipients
      if (recipients.length > 50) {
        const batchSize = 50;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          mailOptions.bcc = batch.join(',');
          await sendEmail(mailOptions);
          console.log(`✅ Sent new course email to batch ${Math.floor(i / batchSize) + 1}`);
        }
      } else {
        await sendEmail(mailOptions);
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending course announcement:', error);
      return { success: false, error: error.message };
    }
  }

  // Send course update notification to registered students
  async sendCourseUpdateEmail(courseData, updateDetails, registeredStudents) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send update email to', registeredStudents.length, 'students');
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
          `
        };

        await sendEmail(mailOptions);
      }
      
      console.log(`✅ Sent update emails to ${registeredStudents.length} students`);
      return { success: true };
    } catch (error) {
      console.error('Error sending update emails:', error);
      return { success: false, error: error.message };
    }
  }

  // Send course cancellation notification
  async sendCourseCancellationEmail(courseData, registeredStudents) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send cancellation email to', registeredStudents.length, 'students');
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
                      <li><strong>Course Code:</strong> ${courseData.courseCode}</li>
                      <li><strong>Original Date:</strong> ${new Date(courseData.startDate).toLocaleDateString()}</li>
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
                    <a href="${process.env.BASE_URL}/contact" class="button">Contact Support</a>
                  </center>
                  
                  <p>Best regards,<br>IAAI Team</p>
                </div>
              </div>
            </body>
            </html>
          `
        };

        await sendEmail(mailOptions);
      }
      
      console.log(`✅ Sent cancellation emails to ${registeredStudents.length} students`);
      return { success: true };
    } catch (error) {
      console.error('Error sending cancellation emails:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to instructors
  async sendInstructorNotification(courseData, instructorEmails) {
    if (this.mockMode) {
      console.log('📧 [MOCK] Would send instructor notification to:', instructorEmails);
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
                        <td>${new Date(courseData.startDate).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;"><strong>Duration:</strong></td>
                        <td>${courseData.duration || 'TBD'}</td>
                      </tr>
                      ${courseData.location ? `
                      <tr>
                        <td style="padding: 8px 0;"><strong>Location:</strong></td>
                        <td>${courseData.location}</td>
                      </tr>
                      ` : ''}
                      ${courseData.platform ? `
                      <tr>
                        <td style="padding: 8px 0;"><strong>Platform:</strong></td>
                        <td>${courseData.platform}</td>
                      </tr>
                      ` : ''}
                    </table>
                    
                    <p>Please log in to your instructor portal to view complete course details and materials.</p>
                    
                    <center>
                      <a href="${process.env.BASE_URL}/instructor/dashboard" class="button">View Course Details</a>
                    </center>
                    
                    <p>If you have any questions, please contact the admin team.</p>
                    <p>Best regards,<br>IAAI Team</p>
                  </div>
                </div>
              </body>
              </html>
            `
          };

          await sendEmail(mailOptions);
        }
        
        console.log(`✅ Sent instructor notifications to ${instructorEmails.length} instructors`);
        this.scheduledJobs.delete(jobId);
      } catch (error) {
        console.error('Error sending instructor notifications:', error);
      }
    });
    
    this.scheduledJobs.set(jobId, job);
    return { success: true };
  }

  // Test email configuration
  async testEmailConfiguration() {
    if (this.mockMode) {
      return { 
        success: true, 
        message: 'Email service is in MOCK mode. Set EMAIL_USER and EMAIL_PASS in .env to enable real emails.' 
      };
    }

    try {
      const testEmail = {
        to: process.env.EMAIL_TEST_RECIPIENT || process.env.EMAIL_USER,
        subject: 'IAAI Email Service Test',
        html: `
          <h2>Email Service Test</h2>
          <p>This is a test email from IAAI Training Institute.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <p>Timestamp: ${new Date().toLocaleString()}</p>
        `
      };

      const result = await sendEmail(testEmail);
      return { 
        success: true, 
        message: 'Test email sent successfully!',
        details: result
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Email test failed',
        error: error.message 
      };
    }
  }





  
// Add these methods to your emailService.js

// Send course starting reminder (1 day before)
async sendCourseStartingReminder(user, course) {
  if (this.mockMode) {
    console.log('📧 [MOCK] Would send course starting reminder to:', user.email);
    return { success: true };
  }

  try {
    const startDate = new Date(course.startDate);
    const isOnline = course.courseType === 'OnlineLiveTraining' || course.platform;
    
    const mailOptions = {
      to: user.email,
      subject: `Reminder: ${course.title} starts tomorrow!`,
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
            .checklist { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Course Starts Tomorrow!</h1>
            </div>
            <div class="content">
              <h2>${course.title}</h2>
              <p>Dear ${user.firstName},</p>
              <p>This is a friendly reminder that your course starts tomorrow!</p>
              
              <div class="checklist">
                <h3>📋 Pre-Course Checklist</h3>
                <ul>
                  ${isOnline ? 
                    `<li>✅ Test your internet connection</li>
                     <li>✅ Check your camera and microphone</li>
                     <li>✅ Join link: <a href="${course.platform?.accessUrl || course.courseUrl}">${course.platform?.name || 'Course Platform'}</a></li>` :
                    `<li>✅ Review the location: ${course.location || course.venue?.name}</li>
                     <li>✅ Plan your travel route</li>
                     <li>✅ Bring required materials</li>`
                  }
                  <li>✅ Review course materials if provided</li>
                  <li>✅ Prepare any questions you might have</li>
                </ul>
              </div>
              
              <table style="width: 100%; margin: 20px 0;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Date:</strong></td>
                  <td>${startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Time:</strong></td>
                  <td>${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
                ${!isOnline ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>Location:</strong></td>
                  <td>${course.location || course.venue?.name}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;"><strong>Instructor:</strong></td>
                  <td>${course.instructor || course.instructorNames}</td>
                </tr>
              </table>
              
              <center>
                <a href="${process.env.BASE_URL}/library" class="button">Access My Courses</a>
              </center>
              
              <p>We're excited to see you tomorrow! If you have any questions, please don't hesitate to contact us.</p>
              <p>Best regards,<br>IAAI Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendEmail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending course starting reminder:', error);
    return { success: false, error: error.message };
  }
}

// Send custom course message
async sendCustomCourseMessage(user, course, customMessage) {
  if (this.mockMode) {
    console.log('📧 [MOCK] Would send custom message to:', user.email);
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
                ${customMessage.replace(/\n/g, '<br>')}
              </div>
              
              <p>If you have any questions about this update, please feel free to contact us.</p>
              <p>Best regards,<br>IAAI Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendEmail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending custom course message:', error);
    return { success: false, error: error.message };
  }
}

// Send certificate completion notification (1 day after course ends)
async sendCertificateCompletionNotification(user, course) {
  if (this.mockMode) {
    console.log('📧 [MOCK] Would send certificate completion notification to:', user.email);
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
              
              ${course.certificateProvided ? `
                <p><strong>🏆 Certificate Available:</strong> Your certificate is ready for download in your course library.</p>
              ` : ''}
              
              <h3>Next Steps:</h3>
              <ul>
                <li>Access your course materials anytime in your library</li>
                ${course.certificateProvided ? '<li>Download your certificate of completion</li>' : ''}
                <li>Leave a review to help other students</li>
                <li>Explore our other courses to continue learning</li>
              </ul>
              
              <center>
                <a href="${process.env.BASE_URL}/library" class="button">Access My Library</a>
              </center>
              
              <p>Thank you for choosing IAAI Training Institute. We look forward to seeing you in future courses!</p>
              <p>Best regards,<br>IAAI Team</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await sendEmail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending certificate completion notification:', error);
    return { success: false, error: error.message };
  }
}

// Schedule post-course notification (1 day after course ends)
schedulePostCourseNotification(courseId, courseData, recipients) {
  const courseEndDate = new Date(courseData.endDate || courseData.startDate);
  const notificationDate = new Date(courseEndDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after
  
  const jobId = `post-course-${courseId}`;
  
  console.log(`📧 Scheduling post-course notification for ${notificationDate}`);
  
  if (this.mockMode) {
    console.log('📧 [MOCK] Would schedule post-course notification');
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





// Add this method to your emailService.js to send individual emails

// Modified version that sends individual emails to each recipient
// Enhanced sendNewCourseAnnouncement that handles both in-person and online courses
async sendNewCourseAnnouncement(course, recipients = null) {
  if (this.mockMode) {
      console.log('📧 [MOCK] Would send course announcement for:', course.title);
      return { success: true };
  }

  try {
      // If no recipients provided, get all subscribed users
      if (!recipients) {
          const users = await User.find(
              { 
                  isConfirmed: true, 
                  'notificationSettings.courseUpdates': true 
              },
              'email firstName lastName'
          );
          recipients = users;
      }

      // Determine if it's an online course
      const isOnlineCourse = course.courseType === 'OnlineLiveTraining' || course.platform;
      
      const courseTypeLabel = {
          'InPersonAestheticTraining': 'In-Person Training',
          'OnlineLiveTraining': 'Live Online Training',
          'SelfPacedOnlineTraining': 'Self-Paced Online Course'
      }[course.courseType] || course.courseType || 'Training Course';

      const mailOptions = {
          to: process.env.EMAIL_FROM || process.env.EMAIL_USER, // Send to self
          bcc: recipients.map(r => typeof r === 'string' ? r : r.email).join(','), // BCC all recipients
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
                          <span class="badge">${course.category || 'Professional Training'}</span>
                          ${isOnlineCourse ? `<span class="badge platform-badge">${course.platform || 'Online'}</span>` : ''}
                          
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
                                      <td>${new Date(course.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                                  </tr>
                                  ${isOnlineCourse && course.primaryTimezone ? `
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Timezone:</strong></td>
                                      <td>${course.primaryTimezone} ${course.displayTimezones?.length > 0 ? `(Also shown in: ${course.displayTimezones.join(', ')})` : ''}</td>
                                  </tr>
                                  ` : ''}
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Duration:</strong></td>
                                      <td>${course.duration || 'See course details'}</td>
                                  </tr>
                                  ${isOnlineCourse && course.pattern && course.pattern !== 'single' ? `
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Schedule:</strong></td>
                                      <td>${course.pattern.charAt(0).toUpperCase() + course.pattern.slice(1)} sessions</td>
                                  </tr>
                                  ` : ''}
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Instructor:</strong></td>
                                      <td>${course.instructor}</td>
                                  </tr>
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Price:</strong></td>
                                      <td>${course.currency === 'USD' ? '$' : course.currency}${course.price}</td>
                                  </tr>
                                  ${course.earlyBirdPrice ? `
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Early Bird Price:</strong></td>
                                      <td style="color: #10b981; font-weight: bold;">${course.currency === 'USD' ? '$' : course.currency}${course.earlyBirdPrice}</td>
                                  </tr>
                                  ` : ''}
                                  ${!isOnlineCourse && course.location ? `
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Location:</strong></td>
                                      <td>${course.location}</td>
                                  </tr>
                                  ` : ''}
                                  ${isOnlineCourse && course.platform ? `
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Platform:</strong></td>
                                      <td>${course.platform}</td>
                                  </tr>
                                  ` : ''}
                                  ${isOnlineCourse && course.recordingAvailable ? `
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Recording:</strong></td>
                                      <td>✅ Available for ${course.recordingDuration} days</td>
                                  </tr>
                                  ` : ''}
                                  <tr>
                                      <td style="padding: 8px 0;"><strong>Certificate:</strong></td>
                                      <td>${course.certificateProvided ? '✅ Certificate Provided' : 'No Certificate'}</td>
                                  </tr>
                              </table>
                          </div>
                          
                          ${isOnlineCourse && course.technicalRequirements ? `
                          <div class="tech-req">
                              <h4>📋 Technical Requirements:</h4>
                              <ul style="margin: 0; padding-left: 20px;">
                                  ${course.technicalRequirements.equipment?.camera ? `<li>Camera: ${course.technicalRequirements.equipment.camera}</li>` : ''}
                                  ${course.technicalRequirements.equipment?.microphone ? `<li>Microphone: ${course.technicalRequirements.equipment.microphone}</li>` : ''}
                                  ${course.technicalRequirements.internetSpeed?.recommended ? `<li>Internet: ${course.technicalRequirements.internetSpeed.recommended} (recommended)</li>` : ''}
                                  ${course.technicalRequirements.requiredSoftware?.length > 0 ? `<li>Software: ${course.technicalRequirements.requiredSoftware.join(', ')}</li>` : ''}
                              </ul>
                          </div>
                          ` : ''}
                          
                          ${course.objectives && course.objectives.length > 0 ? `
                          <div style="margin: 20px 0;">
                              <h3>What You'll Learn:</h3>
                              <ul style="margin: 0; padding-left: 20px;">
                                  ${course.objectives.slice(0, 3).map(obj => `<li>${obj}</li>`).join('')}
                                  ${course.objectives.length > 3 ? '<li>And more...</li>' : ''}
                              </ul>
                          </div>
                          ` : ''}
                          
                          ${isOnlineCourse && course.interactionFeatures ? `
                          <div style="margin: 20px 0;">
                              <h4>🚀 Interactive Features:</h4>
                              <p style="margin: 5px 0;">
                                  ${Object.entries(course.interactionFeatures)
                                      .filter(([feature, enabled]) => enabled)
                                      .map(([feature]) => {
                                          const featureNames = {
                                              polls: '📊 Live Polls',
                                              quizzes: '❓ Interactive Quizzes',
                                              breakoutRooms: '👥 Breakout Rooms',
                                              qa: '💬 Q&A Sessions',
                                              chat: '💭 Live Chat',
                                              reactions: '😊 Reactions'
                                          };
                                          return featureNames[feature] || feature;
                                      })
                                      .join(' • ')
                                  }
                              </p>
                          </div>
                          ` : ''}
                          
                          <center>
                              <a href="${process.env.BASE_URL}/courses/${course._id}" class="button">View Course Details & Register</a>
                          </center>
                          
                          <p style="text-align: center; color: #666; margin-top: 20px;">
                              <em>Limited seats available - Register early to secure your spot!</em>
                          </p>
                      </div>
                      <div class="footer">
                          <p>You received this email because you're subscribed to course updates from IAAI Training Institute.</p>
                          <p><a href="${process.env.BASE_URL}/account/notifications">Update Preferences</a> | <a href="${process.env.BASE_URL}/unsubscribe">Unsubscribe</a></p>
                      </div>
                  </div>
              </body>
              </html>
          `
      };

      // Send in batches if many recipients
      if (recipients.length > 50) {
          const batchSize = 50;
          for (let i = 0; i < recipients.length; i += batchSize) {
              const batch = recipients.slice(i, i + batchSize);
              mailOptions.bcc = batch.map(r => typeof r === 'string' ? r : r.email).join(',');
              await sendEmail(mailOptions);
              console.log(`✅ Sent new course email to batch ${Math.floor(i / batchSize) + 1}`);
          }
      } else {
          await sendEmail(mailOptions);
      }

      return { success: true };
  } catch (error) {
      console.error('Error sending course announcement:', error);
      return { success: false, error: error.message };
  }
}

// Add this configuration option to your emailService class
configureBulkEmailMethod(method = 'bcc') {
  // Options: 'bcc' (default), 'individual', 'batch'
  this.bulkEmailMethod = method;
  console.log(`📧 Bulk email method set to: ${method}`);
}

// Modified sendNewCourseAnnouncement to support different methods
async sendNewCourseAnnouncementFlexible(course, recipients = null) {
  const method = this.bulkEmailMethod || 'bcc';
  
  switch (method) {
      case 'individual':
          return await this.sendNewCourseAnnouncementIndividual(course, recipients);
          
      case 'batch':
          // Send in batches but still as individual emails
          const batchSize = 10;
          let allResults = { sent: 0, failed: 0, failedEmails: [] };
          
          for (let i = 0; i < recipients.length; i += batchSize) {
              const batch = recipients.slice(i, i + batchSize);
              const result = await this.sendNewCourseAnnouncementIndividual(course, batch);
              allResults.sent += result.sent || 0;
              allResults.failed += result.failed || 0;
              allResults.failedEmails.push(...(result.failedEmails || []));
              
              // Longer delay between batches
              if (i + batchSize < recipients.length) {
                  console.log(`⏳ Waiting 5 seconds before next batch...`);
                  await new Promise(resolve => setTimeout(resolve, 5000));
              }
          }
          
          return allResults;
          
      case 'bcc':
      default:
          // Original BCC method
          return await this.sendNewCourseAnnouncement(course, recipients);
  }
}


// Add this method for sending tech check reminders (specific to online courses)
async sendTechCheckReminder(user, course) {
  if (this.mockMode) {
      console.log('📧 [MOCK] Would send tech check reminder to:', user.email);
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
                              <p><strong>Date:</strong> ${techCheckDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                              <p><strong>Time:</strong> ${techCheckDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                              <p><strong>Platform:</strong> ${course.platform}</p>
                              ${course.technical?.techCheckUrl ? `<p><strong>Join Link:</strong> <a href="${course.technical.techCheckUrl}">Click here to join</a></p>` : ''}
                          </div>
                          
                          <h3>📋 Please Check:</h3>
                          <ul>
                              <li>✅ Your internet connection (${course.technicalRequirements?.internetSpeed?.recommended || 'stable connection'} recommended)</li>
                              <li>✅ Camera and microphone are working</li>
                              <li>✅ You have installed any required software</li>
                              <li>✅ You can access the course platform</li>
                          </ul>
                          
                          <center>
                              ${course.technical?.techCheckUrl ? 
                                  `<a href="${course.technical.techCheckUrl}" class="button">Join Tech Check</a>` :
                                  `<a href="${process.env.BASE_URL}/library" class="button">View Course Details</a>`
                              }
                          </center>
                          
                          <p>This tech check ensures you're ready for the course and helps resolve any technical issues in advance.</p>
                          <p>Best regards,<br>IAAI Team</p>
                      </div>
                  </div>
              </body>
              </html>
          `
      };

      await sendEmail(mailOptions);
      return { success: true };
  } catch (error) {
      console.error('Error sending tech check reminder:', error);
      return { success: false, error: error.message };
  }
}

// Add this method for post-course recording access notification
async sendRecordingAvailableNotification(user, course) {
  if (this.mockMode) {
      console.log('📧 [MOCK] Would send recording notification to:', user.email);
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
                              <li>Available for ${course.recordingDuration || 90} days</li>
                              ${course.recording?.autoTranscription ? '<li>✅ Includes automatic transcription</li>' : ''}
                              ${course.recording?.availability?.downloadable ? '<li>✅ Download available</li>' : '<li>Streaming only (no download)</li>'}
                          </ul>
                          
                          <center>
                              <a href="${process.env.BASE_URL}/library" class="button">Access Recording</a>
                          </center>
                          
                          <p>Don't forget to download any course materials before your access expires.</p>
                          <p>Best regards,<br>IAAI Team</p>
                      </div>
                  </div>
              </body>
              </html>
          `
      };

      await sendEmail(mailOptions);
      return { success: true };
  } catch (error) {
      console.error('Error sending recording notification:', error);
      return { success: false, error: error.message };
  }
}




}



module.exports = new EmailService();