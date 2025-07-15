// controllers/admin/courseNotificationController.js
/**
 * Course Notification Controller - UPDATED VERSION
 * Handles all notification logic for course creation, updates, and management
 */

const schedule = require('node-schedule');
const User = require('../../models/user'); // Make sure this path is correct
const Instructor = require('../../models/Instructor');
const emailService = require('../../utils/emailService');

class CourseNotificationController {
    constructor() {
        // Track scheduled notifications to prevent duplicates
        this.scheduledNotifications = new Map();
        
        // Track when courses were created to manage 2-hour window
        this.courseCreationTimes = new Map();
    }

    /**
     * Handle notifications when a new course is created
     * Schedules email to be sent after 2 hours
     */
    async handleCourseCreation(course, createdBy) {
        try {
            console.log('📧 Setting up notifications for new course:', course.title);
            
            // Store creation time
            this.courseCreationTimes.set(course._id.toString(), new Date());
            
            // Prepare course data for email
            const courseData = this.prepareCourseDataForEmail(course);
            
            // Get all recipients using the User model static method
            const recipients = await User.getNotificationRecipients();
            
            console.log(`📧 Found ${recipients.length} users who want notifications`);
            
            if (recipients.length === 0) {
                console.log('📧 No users want notifications, skipping email scheduling');
                return {
                    success: true,
                    message: 'No users to notify',
                    recipientCount: 0
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
                jobId
            };
            
        } catch (error) {
            console.error('❌ Error handling course creation notifications:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle notifications when a course is updated
     */
    async handleCourseUpdate(courseId, updatedCourse, updatedBy, changes = {}) {
        try {
            console.log('📝 Handling course update notifications for course:', courseId);
            
            const creationTime = this.courseCreationTimes.get(courseId);
            const now = new Date();
            
            // Check if still within 2-hour window
            if (creationTime && (now - creationTime) < 2 * 60 * 60 * 1000) {
                console.log('📧 Course updated within 2-hour window, no notification needed');
                return {
                    success: true,
                    message: 'Within 2-hour grace period, no notification sent'
                };
            }
            
            // Check if there are registered students
            const registeredStudents = await this.getRegisteredStudents(courseId);
            
            if (registeredStudents.length === 0) {
                console.log('📧 No registered students, skipping update notification');
                return {
                    success: true,
                    message: 'No registered students to notify'
                };
            }
            
            // Prepare update details
            const updateDetails = this.prepareUpdateDetails(changes);
            const courseData = this.prepareCourseDataForEmail(updatedCourse);
            
            // Send immediate notification to registered students
            await emailService.sendCourseUpdateEmail(
                courseData,
                updateDetails,
                registeredStudents
            );
            
            console.log(`✅ Update notifications sent to ${registeredStudents.length} students`);
            
            return {
                success: true,
                notifiedCount: registeredStudents.length
            };
            
        } catch (error) {
            console.error('❌ Error handling course update notifications:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Handle notifications when a course is cancelled
     */
    async handleCourseCancellation(courseId, course) {
        try {
            console.log('🚫 Handling course cancellation notifications');
            
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
                
                console.log(`✅ Cancellation notifications sent to ${registeredStudents.length} students`);
            }
            
            // Clean up tracking data
            this.courseCreationTimes.delete(courseId);
            
            return {
                success: true,
                notifiedCount: registeredStudents.length
            };
            
        } catch (error) {
            console.error('❌ Error handling course cancellation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Schedule new course notification
     */
    scheduleNewCourseNotification(courseId, courseData, recipients, scheduledTime) {
        const jobId = `new-course-${courseId}`;
        
        // Cancel existing job if any
        this.cancelScheduledNotification(courseId);
        
        // Schedule new job
        const job = schedule.scheduleJob(scheduledTime, async () => {
            try {
                console.log('📧 Executing scheduled new course notification for course:', courseId);
                
                // Check if course still exists and is active
                const currentCourse = await this.verifyCourseStatus(courseId);
                
                if (currentCourse && currentCourse.status !== 'cancelled' && currentCourse.status !== 'Cancelled') {
                    await emailService.sendNewCourseAnnouncement(courseData, recipients);
                    console.log(`✅ New course announcement sent to ${recipients.length} recipients`);
                } else {
                    console.log('❌ Course cancelled or not found, skipping notification');
                }
                
                // Clean up
                this.scheduledNotifications.delete(jobId);
                this.courseCreationTimes.delete(courseId);
                
            } catch (error) {
                console.error('❌ Error sending scheduled notification:', error);
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
            const instructorEmails = [];
            
            // Get instructor emails from the course instructors array
            if (course.instructors && Array.isArray(course.instructors)) {
                for (const inst of course.instructors) {
                    if (inst.instructorId) {
                        const instructor = await Instructor.findById(inst.instructorId)
                            .select('email');
                        if (instructor?.email) {
                            instructorEmails.push(instructor.email);
                        }
                    }
                }
            }
            
            // Alternative: if course has instructors object with primary/additional structure
            if (course.instructors?.primary?.instructorId) {
                const primaryInstructor = await Instructor.findById(
                    course.instructors.primary.instructorId
                ).select('email');
                
                if (primaryInstructor?.email) {
                    instructorEmails.push(primaryInstructor.email);
                }
            }
            
            if (course.instructors?.additional?.length > 0) {
                for (const inst of course.instructors.additional) {
                    if (inst.instructorId) {
                        const instructor = await Instructor.findById(inst.instructorId)
                            .select('email');
                        if (instructor?.email) {
                            instructorEmails.push(instructor.email);
                        }
                    }
                }
            }
            
            if (instructorEmails.length > 0) {
                const courseData = this.prepareCourseDataForEmail(course);
                
                // Send instructor notification immediately (not scheduled)
                await emailService.sendInstructorNotification(courseData, instructorEmails);
                console.log(`✅ Instructor notifications sent to ${instructorEmails.length} instructors`);
            } else {
                console.log('📧 No instructor emails found for notifications');
            }
            
        } catch (error) {
            console.error('❌ Error scheduling instructor notification:', error);
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
     * Get registered students for a course
     */
    async getRegisteredStudents(courseId) {
        try {
            // For in-person courses
            const inPersonStudents = await User.find({
                'myInPersonCourses.courseId': courseId,
                'myInPersonCourses.status': { $in: ['Paid and Registered', 'Registered (promo code)'] }
            }).select('email firstName lastName');
            
            // For live courses
            const liveStudents = await User.find({
                'myLiveCourses.courseId': courseId,
                'myLiveCourses.status': { $in: ['Paid and Registered', 'Registered (promo code)'] }
            }).select('email firstName lastName');
            
            // For self-paced courses
            const selfPacedStudents = await User.find({
                'mySelfPacedCourses.courseId': courseId,
                'mySelfPacedCourses.status': { $in: ['Paid and Registered', 'Registered (promo code)'] }
            }).select('email firstName lastName');
            
            // Combine and deduplicate
            const allStudents = [...inPersonStudents, ...liveStudents, ...selfPacedStudents];
            const uniqueStudents = Array.from(
                new Map(allStudents.map(s => [s.email, s])).values()
            );
            
            return uniqueStudents;
            
        } catch (error) {
            console.error('Error getting registered students:', error);
            return [];
        }
    }

    /**
     * Prepare course data for email
     */
    prepareCourseDataForEmail(course) {
        return {
            _id: course._id,
            courseType: 'In-Person Training',
            title: course.title || 'Untitled Course',
            courseCode: course.courseCode || 'N/A',
            description: course.description || '',
            category: course.category || 'general',
            status: course.status || 'open',
            
            // Schedule info
            startDate: course.startDate,
            endDate: course.endDate,
            duration: course.duration,
            
            // Pricing
            price: course.price || 0,
            earlyBirdPrice: course.earlyBirdPrice,
            currency: course.currency || 'USD',
            
            // Location
            location: this.formatLocation(course),
            venue: course.venue || {},
            
            // Instructor
            instructor: course.instructorNames || 'TBD',
            
            // Additional info
            seatsAvailable: course.seatsAvailable,
            certificateProvided: course.certificateProvided,
            objectives: course.objectives || []
        };
    }

    /**
     * Format location for display
     */
    formatLocation(course) {
        if (course.venue) {
            const parts = [
                course.venue.name,
                course.venue.city,
                course.venue.country
            ].filter(Boolean);
            return parts.join(', ');
        }
        return course.location || 'TBD';
    }

    /**
     * Prepare update details for email
     */
    prepareUpdateDetails(changes) {
        const updateList = [];
        
        if (changes.schedule) {
            updateList.push('<li><strong>Schedule:</strong> Course dates or times have been updated</li>');
        }
        if (changes.venue) {
            updateList.push('<li><strong>Location:</strong> Venue details have changed</li>');
        }
        if (changes.instructors) {
            updateList.push('<li><strong>Instructors:</strong> Instructor assignments updated</li>');
        }
        if (changes.enrollment) {
            updateList.push('<li><strong>Enrollment:</strong> Pricing or seat availability changed</li>');
        }
        if (changes.content) {
            updateList.push('<li><strong>Content:</strong> Course materials or objectives updated</li>');
        }
        
        if (updateList.length === 0) {
            updateList.push('<li>Course information has been updated</li>');
        }
        
        return `<ul>${updateList.join('')}</ul>`;
    }

    /**
     * Verify course status
     */
    async verifyCourseStatus(courseId) {
        try {
            // Try different course models
            const InPersonCourse = require('../../models/InPersonAestheticTraining');
            
            let course = await InPersonCourse.findById(courseId);
            
            // Try other course models if you have them
            if (!course) {
                try {
                    const OnlineCourse = require('../../models/OnlineLiveTraining');
                    course = await OnlineCourse.findById(courseId);
                } catch (err) {
                    // Model might not exist
                }
            }
            
            if (!course) {
                try {
                    const SelfPacedCourse = require('../../models/SelfPacedOnlineTraining');
                    course = await SelfPacedCourse.findById(courseId);
                } catch (err) {
                    // Model might not exist
                }
            }
            
            return course;
            
        } catch (error) {
            console.error('Error verifying course status:', error);
            return null;
        }
    }

    /**
     * Send immediate notification (bypass 2-hour delay)
     */
    async sendImmediateNotification(courseId) {
        try {
            console.log('📧 Sending immediate notification for course:', courseId);
            
            const course = await this.verifyCourseStatus(courseId);
            if (!course) {
                throw new Error('Course not found');
            }
            
            const recipients = await User.getNotificationRecipients();
            if (recipients.length === 0) {
                return {
                    success: true,
                    message: 'No users to notify'
                };
            }
            
            const courseData = this.prepareCourseDataForEmail(course);
            await emailService.sendNewCourseAnnouncement(courseData, recipients);
            
            console.log(`✅ Immediate notification sent to ${recipients.length} recipients`);
            
            return {
                success: true,
                message: 'Immediate notification sent successfully',
                recipientCount: recipients.length
            };
            
        } catch (error) {
            console.error('❌ Error sending immediate notification:', error);
            return {
                success: false,
                error: error.message
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
                throw new Error('Course not found');
            }
            
            const courseData = this.prepareCourseDataForEmail(course);
            const testRecipient = [{
                email: recipientEmail,
                firstName: 'Test',
                lastName: 'User'
            }];
            
            await emailService.sendNewCourseAnnouncement(courseData, testRecipient);
            
            return {
                success: true,
                message: 'Test notification sent successfully'
            };
            
        } catch (error) {
            console.error('Error sending test notification:', error);
            return {
                success: false,
                error: error.message
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
                nextInvocation: job.nextInvocation()?.toISOString() || 'Not scheduled'
            });
        }
        
        return {
            scheduledJobs: scheduled,
            trackedCourses: Array.from(this.courseCreationTimes.keys()),
            activeJobs: this.scheduledNotifications.size
        };
    }
}

// Create and export singleton instance
const courseNotificationController = new CourseNotificationController();
module.exports = courseNotificationController;