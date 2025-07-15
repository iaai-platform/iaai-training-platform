// utils/emailTemplates.js
const path = require('path');
const fs = require('fs').promises;

// Base email template wrapper
const wrapEmailTemplate = (content, title = '') => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            /* Email-safe CSS */
            body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333333;
                background-color: #f4f4f4;
            }
            .email-wrapper {
                max-width: 600px;
                margin: 0 auto;
                background-color: #f4f4f4;
                padding: 20px;
            }
            .email-container {
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .email-header {
                background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .email-header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 700;
            }
            .email-header p {
                margin: 10px 0 0 0;
                font-size: 16px;
                opacity: 0.9;
            }
            .email-body {
                padding: 40px 30px;
            }
            .email-body h2 {
                color: #1a365d;
                margin-top: 0;
                margin-bottom: 20px;
                font-size: 24px;
            }
            .email-body p {
                margin-bottom: 15px;
                color: #555555;
            }
            .button {
                display: inline-block;
                padding: 14px 30px;
                background-color: #3182ce;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
            }
            .button:hover {
                background-color: #2c5282;
            }
            .info-box {
                background-color: #f7fafc;
                border-left: 4px solid #3182ce;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            }
            .warning-box {
                background-color: #fff5f5;
                border-left: 4px solid #feb2b2;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                color: #c53030;
            }
            .success-box {
                background-color: #f0fff4;
                border-left: 4px solid #48bb78;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                color: #22543d;
            }
            .email-footer {
                background-color: #f7fafc;
                padding: 30px;
                text-align: center;
                border-top: 1px solid #e2e8f0;
            }
            .email-footer p {
                margin: 5px 0;
                color: #718096;
                font-size: 14px;
            }
            .social-links {
                margin: 20px 0;
            }
            .social-links a {
                display: inline-block;
                margin: 0 10px;
                color: #4a5568;
                text-decoration: none;
            }
            ul {
                padding-left: 20px;
                color: #555555;
            }
            .course-details {
                background-color: #f7fafc;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .course-details h3 {
                color: #2d3748;
                margin-top: 0;
                margin-bottom: 15px;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #e2e8f0;
            }
            .detail-row:last-child {
                border-bottom: none;
            }
            .detail-label {
                font-weight: bold;
                color: #4a5568;
            }
            .detail-value {
                color: #2d3748;
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-container">
                ${content}
                <div class="email-footer">
                    <div class="social-links">
                        <a href="https://facebook.com/iaaitraining">Facebook</a>
                        <a href="https://twitter.com/iaaitraining">Twitter</a>
                        <a href="https://linkedin.com/company/iaaitraining">LinkedIn</a>
                    </div>
                    <p><strong>IAAI Training Institute</strong></p>
                    <p>123 Training Avenue, Education City, EC 12345</p>
                    <p>Email: support@iaai-training.com | Phone: +1 (555) 123-4567</p>
                    <p style="margin-top: 20px; font-size: 12px;">
                        This is an automated message. Please do not reply to this email.<br>
                        © ${new Date().getFullYear()} IAAI Training Institute. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Email Templates
const emailTemplates = {
  // 1. User Account Approval
  userApproval: (user) => {
    const content = `
      <div class="email-header">
          <h1>Welcome to IAAI Training Institute!</h1>
          <p>Your Account Has Been Approved</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName} ${user.lastName}! 👋</h2>
          
          <div class="success-box">
              <strong>Great news!</strong> Your account has been successfully approved by our admin team.
          </div>
          
          <p>You now have full access to the IAAI Training platform and can start your learning journey.</p>
          
          <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/login" class="button">
                  Login to Your Account
              </a>
          </div>
          
          <h3>What You Can Do Now:</h3>
          <ul>
              <li>Browse and enroll in aesthetic training courses</li>
              <li>Access self-paced online training materials</li>
              <li>Register for live online sessions</li>
              <li>Sign up for in-person training programs</li>
              <li>Track your learning progress</li>
              <li>Earn certificates upon course completion</li>
          </ul>
          
          <h3>Getting Started:</h3>
          <ol>
              <li><strong>Complete Your Profile:</strong> Add professional information and preferences</li>
              <li><strong>Explore Courses:</strong> Browse our catalog and add courses to your wishlist</li>
              <li><strong>Enroll:</strong> Register for courses that interest you</li>
          </ol>
          
          <div class="info-box">
              <strong>Need Help?</strong><br>
              Our support team is here to assist you. Feel free to reach out at 
              <a href="mailto:${process.env.SUPPORT_EMAIL}">support@iaai-training.com</a>
          </div>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Welcome to IAAI Training - Account Approved!');
  },

  // 2. User Account Rejection
  userRejection: (user, reason) => {
    const content = `
      <div class="email-header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
          <h1>Account Application Update</h1>
          <p>Important Information About Your Application</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName} ${user.lastName},</h2>
          
          <p>Thank you for your interest in IAAI Training Institute. After careful review, we regret to inform you that we are unable to approve your account at this time.</p>
          
          ${reason ? `
          <div class="warning-box">
              <strong>Reason for rejection:</strong><br>
              ${reason}
          </div>
          ` : ''}
          
          <h3>What You Can Do:</h3>
          <ul>
              <li>Review the reason provided above</li>
              <li>Address any concerns mentioned</li>
              <li>Contact our support team if you believe this is an error</li>
              <li>You may reapply after addressing the issues</li>
          </ul>
          
          <p>If you have questions or would like to discuss this decision, please don't hesitate to contact us.</p>
          
          <div class="info-box">
              <strong>Contact Support:</strong><br>
              Email: <a href="mailto:${process.env.SUPPORT_EMAIL}">support@iaai-training.com</a><br>
              Phone: +1 (555) 123-4567
          </div>
          
          <p>We appreciate your understanding and wish you the best in your professional journey.</p>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'IAAI Training - Account Application Update');
  },

  // 3. Course Registration Confirmation
  courseRegistration: (user, courses, paymentInfo) => {
    const content = `
      <div class="email-header">
          <h1>Course Registration Confirmed! 🎉</h1>
          <p>Your enrollment has been successfully processed</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName} ${user.lastName},</h2>
          
          <div class="success-box">
              <strong>Congratulations!</strong> You have successfully registered for the following course(s).
          </div>
          
          <h3>Registration Details:</h3>
          ${courses.map(course => `
              <div class="course-details">
                  <h3>${course.title}</h3>
                  <div class="detail-row">
                      <span class="detail-label">Course Code:</span>
                      <span class="detail-value">${course.courseCode}</span>
                  </div>
                  <div class="detail-row">
                      <span class="detail-label">Type:</span>
                      <span class="detail-value">${course.courseType}</span>
                  </div>
                  ${course.startDate ? `
                  <div class="detail-row">
                      <span class="detail-label">Start Date:</span>
                      <span class="detail-value">${new Date(course.startDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                      })}</span>
                  </div>
                  ` : ''}
                  ${course.location ? `
                  <div class="detail-row">
                      <span class="detail-label">Location:</span>
                      <span class="detail-value">${course.location}</span>
                  </div>
                  ` : ''}
                  <div class="detail-row">
                      <span class="detail-label">Price:</span>
                      <span class="detail-value">$${course.price} USD</span>
                  </div>
              </div>
          `).join('')}
          
          ${paymentInfo ? `
          <h3>Payment Information:</h3>
          <div class="info-box">
              <div class="detail-row">
                  <span class="detail-label">Total Amount:</span>
                  <span class="detail-value">$${paymentInfo.amount} USD</span>
              </div>
              ${paymentInfo.promoCode ? `
              <div class="detail-row">
                  <span class="detail-label">Promo Code:</span>
                  <span class="detail-value">${paymentInfo.promoCode} (${paymentInfo.discount}% off)</span>
              </div>
              ` : ''}
              <div class="detail-row">
                  <span class="detail-label">Reference Number:</span>
                  <span class="detail-value">${paymentInfo.referenceNumber}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${paymentInfo.method}</span>
              </div>
          </div>
          ` : ''}
          
          <h3>Next Steps:</h3>
          <ol>
              <li><strong>Save this email</strong> for your records</li>
              <li><strong>Add to calendar:</strong> Mark the course dates</li>
              <li><strong>Prepare:</strong> Review any prerequisites or materials</li>
              <li><strong>Check your dashboard</strong> for course updates</li>
          </ol>
          
          <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/my-courses" class="button">
                  View My Courses
              </a>
          </div>
          
          <div class="info-box">
              <strong>Important:</strong> You will receive a reminder email 24 hours before your course starts.
          </div>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Course Registration Confirmed - IAAI Training');
  },

  // 4. New Course Announcement
  newCourseAnnouncement: (user, course) => {
    const content = `
      <div class="email-header">
          <h1>New Course Available! 🚀</h1>
          <p>Expand your skills with our latest offering</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName},</h2>
          
          <p>We're excited to announce a new course that might interest you!</p>
          
          <div class="course-details">
              <h3>${course.title}</h3>
              <p style="font-style: italic; color: #4a5568;">${course.description}</p>
              
              <div class="detail-row">
                  <span class="detail-label">Course Code:</span>
                  <span class="detail-value">${course.courseCode}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Instructor:</span>
                  <span class="detail-value">${course.instructor}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Start Date:</span>
                  <span class="detail-value">${new Date(course.startDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">${course.duration || 'See course details'}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Price:</span>
                  <span class="detail-value">$${course.price} USD</span>
              </div>
              ${course.earlyBirdPrice ? `
              <div class="detail-row">
                  <span class="detail-label">Early Bird Price:</span>
                  <span class="detail-value" style="color: #38a169; font-weight: bold;">$${course.earlyBirdPrice} USD</span>
              </div>
              ` : ''}
          </div>
          
          <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/courses/${course._id}" class="button">
                  Learn More & Enroll
              </a>
          </div>
          
          ${course.seatsAvailable ? `
          <div class="warning-box" style="background-color: #fef3c7; border-color: #f59e0b; color: #92400e;">
              <strong>Limited Seats Available!</strong> Only ${course.seatsAvailable} spots remaining.
          </div>
          ` : ''}
          
          <p>Don't miss this opportunity to enhance your skills and advance your career!</p>
      </div>
    `;
    
    return wrapEmailTemplate(content, `New Course: ${course.title} - IAAI Training`);
  },

  // 5. Course Reminder (24 hours before)
  courseReminder: (user, course) => {
    const content = `
      <div class="email-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
          <h1>Course Starting Tomorrow! ⏰</h1>
          <p>Your course begins in 24 hours</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName},</h2>
          
          <p>This is a friendly reminder that your course starts tomorrow!</p>
          
          <div class="course-details">
              <h3>${course.title}</h3>
              
              <div class="detail-row">
                  <span class="detail-label">Course Code:</span>
                  <span class="detail-value">${course.courseCode}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Start Time:</span>
                  <span class="detail-value">${new Date(course.startDate).toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                  })}</span>
              </div>
              ${course.location ? `
              <div class="detail-row">
                  <span class="detail-label">Location:</span>
                  <span class="detail-value">${course.location}</span>
              </div>
              ${course.venue ? `
              <div class="detail-row">
                  <span class="detail-label">Venue:</span>
                  <span class="detail-value">${course.venue}</span>
              </div>
              ` : ''}
              ` : ''}
              ${course.courseUrl ? `
              <div class="detail-row">
                  <span class="detail-label">Online Meeting Link:</span>
                  <span class="detail-value"><a href="${course.courseUrl}">Join Online Session</a></span>
              </div>
              ` : ''}
              <div class="detail-row">
                  <span class="detail-label">Instructor:</span>
                  <span class="detail-value">${course.instructor}</span>
              </div>
          </div>
          
          <h3>Pre-Course Checklist:</h3>
          <ul>
              ${course.courseType === 'In-Person Training' ? `
                  <li>Confirm the venue location and parking information</li>
                  <li>Plan your route and travel time</li>
                  <li>Bring any required materials or equipment</li>
                  <li>Arrive 15 minutes early for registration</li>
              ` : `
                  <li>Test your internet connection</li>
                  <li>Check your camera and microphone</li>
                  <li>Download any required software</li>
                  <li>Find a quiet space for the session</li>
                  <li>Have your course materials ready</li>
              `}
          </ul>
          
          ${course.prerequisites ? `
          <div class="info-box">
              <strong>Prerequisites Reminder:</strong><br>
              ${course.prerequisites}
          </div>
          ` : ''}
          
          <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/my-courses" class="button">
                  View Course Details
              </a>
          </div>
          
          <p>We look forward to seeing you tomorrow!</p>
      </div>
    `;
    
    return wrapEmailTemplate(content, `Reminder: ${course.title} Starts Tomorrow!`);
  },

  // 6. Certificate Earned
  certificateEarned: (user, certificate, course) => {
    const content = `
      <div class="email-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
          <h1>Congratulations! 🏆</h1>
          <p>You've earned your certificate!</p>
      </div>
      <div class="email-body">
          <h2>Well done, ${user.firstName}!</h2>
          
          <div class="success-box">
              <strong>Achievement Unlocked!</strong> You have successfully completed the course and earned your certificate.
          </div>
          
          <div class="course-details">
              <h3>Certificate Details</h3>
              
              <div class="detail-row">
                  <span class="detail-label">Course:</span>
                  <span class="detail-value">${course.title}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Certificate ID:</span>
                  <span class="detail-value">${certificate.certificateId}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Issue Date:</span>
                  <span class="detail-value">${new Date(certificate.issueDate).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Verification Code:</span>
                  <span class="detail-value">${certificate.verificationCode}</span>
              </div>
              ${certificate.courseStats ? `
              <div class="detail-row">
                  <span class="detail-label">Average Score:</span>
                  <span class="detail-value">${certificate.courseStats.averageScore}%</span>
              </div>
              ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/certificate/${certificate.certificateId}" class="button" style="background-color: #10b981;">
                  View & Download Certificate
              </a>
          </div>
          
          <h3>Share Your Achievement!</h3>
          <p>You can now:</p>
          <ul>
              <li>Download your certificate as a PDF</li>
              <li>Share it on LinkedIn and other social media</li>
              <li>Add it to your professional portfolio</li>
              <li>Include the verification code on your resume</li>
          </ul>
          
          <div class="info-box">
              <strong>Certificate Verification:</strong><br>
              Anyone can verify your certificate authenticity by visiting:<br>
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/verify/${certificate.verificationCode}">
                  ${process.env.BASE_URL || 'http://localhost:3000'}/verify/${certificate.verificationCode}
              </a>
          </div>
          
          <p>Congratulations once again on your achievement! We're proud of your dedication to professional development.</p>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Certificate Earned - IAAI Training');
  },

  // 7. Password Reset
  passwordReset: (user, resetToken) => {
    const resetUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    const content = `
      <div class="email-header" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);">
          <h1>Password Reset Request</h1>
          <p>Security notification from IAAI Training</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName},</h2>
          
          <p>We received a request to reset your password for your IAAI Training account.</p>
          
          <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button">
                  Reset Your Password
              </a>
          </div>
          
          <div class="warning-box">
              <strong>Important:</strong> This link will expire in 1 hour for security reasons.
          </div>
          
          <p>If you did not request this password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <h3>Security Tips:</h3>
          <ul>
              <li>Never share your password with anyone</li>
              <li>Use a strong, unique password</li>
              <li>Enable two-factor authentication if available</li>
              <li>Be cautious of phishing emails</li>
          </ul>
          
          <div class="info-box">
              <strong>Need help?</strong><br>
              If you're having trouble resetting your password, contact our support team:<br>
              Email: <a href="mailto:${process.env.SUPPORT_EMAIL}">support@iaai-training.com</a>
          </div>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Password Reset Request - IAAI Training');
  },

  // 8. Payment Receipt
  paymentReceipt: (user, paymentDetails, courses) => {
    const content = `
      <div class="email-header">
          <h1>Payment Receipt</h1>
          <p>Thank you for your payment</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName},</h2>
          
          <p>This email confirms that we have received your payment.</p>
          
          <div class="course-details">
              <h3>Payment Details</h3>
              
              <div class="detail-row">
                  <span class="detail-label">Receipt Number:</span>
                  <span class="detail-value">${paymentDetails.receiptNumber}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Payment Date:</span>
                  <span class="detail-value">${new Date(paymentDetails.date).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Payment Method:</span>
                  <span class="detail-value">${paymentDetails.method}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Amount Paid:</span>
                  <span class="detail-value" style="font-weight: bold; color: #10b981;">$${paymentDetails.amount} USD</span>
              </div>
          </div>
          
          <h3>Course(s) Purchased:</h3>
          ${courses.map(course => `
              <div class="info-box">
                  <strong>${course.title}</strong><br>
                  Course Code: ${course.courseCode}<br>
                  Price: $${course.price} USD
              </div>
          `).join('')}
          
          <p>This receipt serves as confirmation of your payment. Please keep it for your records.</p>
          
          <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/my-courses" class="button">
                  Access Your Courses
              </a>
          </div>
          
          <div class="info-box">
              <strong>Tax Information:</strong><br>
              You may be eligible to claim this training expense for tax purposes. 
              Please consult with your tax advisor.
          </div>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Payment Receipt - IAAI Training');
  },

  // 9. Course Completion (without certificate)
  courseCompletion: (user, course) => {
    const content = `
      <div class="email-header" style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);">
          <h1>Course Completed! ✅</h1>
          <p>Congratulations on finishing your course</p>
      </div>
      <div class="email-body">
          <h2>Great job, ${user.firstName}!</h2>
          
          <p>You have successfully completed the course:</p>
          
          <div class="course-details">
              <h3>${course.title}</h3>
              
              <div class="detail-row">
                  <span class="detail-label">Course Code:</span>
                  <span class="detail-value">${course.courseCode}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Completion Date:</span>
                  <span class="detail-value">${new Date().toLocaleDateString()}</span>
              </div>
              ${course.courseStats ? `
              <div class="detail-row">
                  <span class="detail-label">Videos Completed:</span>
                  <span class="detail-value">${course.courseStats.completedVideos}/${course.courseStats.totalVideos}</span>
              </div>
              <div class="detail-row">
                  <span class="detail-label">Time Spent:</span>
                  <span class="detail-value">${Math.round(course.courseStats.timeSpent / 60)} hours</span>
              </div>
              ` : ''}
          </div>
          
          <h3>What's Next?</h3>
          <ul>
              <li>Review your course materials anytime</li>
              <li>Apply your new skills in practice</li>
              <li>Explore more advanced courses</li>
              <li>Share your experience with others</li>
          </ul>
          
          <div style="text-align: center;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/training-programs" class="button">
                  Explore More Courses
              </a>
          </div>
          
          <p>Thank you for choosing IAAI Training for your professional development!</p>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Course Completed - IAAI Training');
  },

  // 10. Weekly Digest
  weeklyDigest: (user, updates) => {
    const content = `
      <div class="email-header">
          <h1>Your Weekly Update 📊</h1>
          <p>What's happening at IAAI Training</p>
      </div>
      <div class="email-body">
          <h2>Hello ${user.firstName},</h2>
          
          <p>Here's your personalized weekly digest from IAAI Training:</p>
          
          ${updates.coursesInProgress ? `
          <h3>📚 Your Active Courses</h3>
          <div class="info-box">
              ${updates.coursesInProgress.map(course => `
                  <strong>${course.title}</strong><br>
                  Progress: ${course.progress}% complete<br>
                  ${course.nextDeadline ? `Next deadline: ${course.nextDeadline}<br>` : ''}
                  <br>
              `).join('')}
          </div>
          ` : ''}
          
          ${updates.newCourses && updates.newCourses.length > 0 ? `
          <h3>🆕 New Courses This Week</h3>
          <ul>
              ${updates.newCourses.map(course => `
                  <li><strong>${course.title}</strong> - Starting ${new Date(course.startDate).toLocaleDateString()}</li>
              `).join('')}
          </ul>
          ` : ''}
          
          ${updates.upcomingCourses && updates.upcomingCourses.length > 0 ? `
          <h3>📅 Your Upcoming Courses</h3>
          <ul>
              ${updates.upcomingCourses.map(course => `
                  <li><strong>${course.title}</strong> - ${new Date(course.startDate).toLocaleDateString()}</li>
              `).join('')}
          </ul>
          ` : ''}
          
          ${updates.achievements ? `
          <h3>🏆 Your Achievements</h3>
          <div class="success-box">
              ${updates.achievements.map(achievement => `
                  • ${achievement}<br>
              `).join('')}
          </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/dashboard" class="button">
                  Visit Your Dashboard
              </a>
          </div>
          
          <p style="margin-top: 30px; font-size: 14px; color: #718096;">
              You're receiving this because you opted in to weekly updates. 
              <a href="${process.env.BASE_URL || 'http://localhost:3000'}/settings/notifications">Manage your email preferences</a>
          </p>
      </div>
    `;
    
    return wrapEmailTemplate(content, 'Your Weekly Update - IAAI Training');
  }
};

module.exports = emailTemplates;