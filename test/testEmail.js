// test/testEmail.js
/**
 * Email Testing Script
 * Run this file to test your email configuration and notifications
 */

require('dotenv').config();
const emailService = require('../utils/emailService');
const sendEmail = require('../utils/sendEmail');
const courseNotificationController = require('../controllers/admin/courseNotificationController');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

class EmailTester {
    constructor() {
        this.testEmail = process.env.TEST_EMAIL || process.env.EMAIL_USER;
        this.testResults = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = {
            info: `${colors.blue}ℹ️`,
            success: `${colors.green}✅`,
            error: `${colors.red}❌`,
            warning: `${colors.yellow}⚠️`,
            test: `${colors.cyan}🧪`
        }[type] || '';
        
        console.log(`${prefix} [${timestamp}] ${message}${colors.reset}`);
    }

    async runAllTests() {
        console.log(`${colors.bright}${colors.blue}`);
        console.log('╔════════════════════════════════════════╗');
        console.log('║       EMAIL SYSTEM TEST SUITE          ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(colors.reset);
        
        this.log(`Testing email to: ${this.testEmail}`, 'info');
        console.log('');

        // Run tests in sequence
        await this.testEmailConfiguration();
        await this.testBasicEmail();
        await this.testUserApprovalEmail();
        await this.testCourseRegistrationEmail();
        await this.testCourseAnnouncementEmail();
        await this.testCourseUpdateEmail();
        await this.testCourseReminderEmail();
        await this.testCertificateEmail();
        await this.testScheduledNotification();
        
        this.printTestSummary();
    }

    async testEmailConfiguration() {
        this.log('Testing email configuration...', 'test');
        
        try {
            // Check environment variables
            const requiredVars = ['EMAIL_USER', 'EMAIL_PASS', 'EMAIL_SERVICE'];
            const missingVars = requiredVars.filter(v => !process.env[v]);
            
            if (missingVars.length > 0) {
                throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
            }
            
            // Test email service
            const result = await emailService.testEmailConfiguration();
            
            if (result.success) {
                this.log('Email configuration is valid', 'success');
                this.testResults.push({ test: 'Email Configuration', status: 'PASSED' });
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            this.log(`Email configuration test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Email Configuration', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testBasicEmail() {
        this.log('Testing basic email sending...', 'test');
        
        try {
            const result = await sendEmail({
                to: this.testEmail,
                subject: 'Test Email - Basic Functionality',
                html: `
                    <h2>Basic Email Test</h2>
                    <p>This is a test email to verify basic email functionality.</p>
                    <p>If you received this email, the basic email system is working correctly!</p>
                    <p>Timestamp: ${new Date().toLocaleString()}</p>
                `
            });
            
            this.log('Basic email sent successfully', 'success');
            this.testResults.push({ test: 'Basic Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Basic email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Basic Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testUserApprovalEmail() {
        this.log('Testing user approval email...', 'test');
        
        try {
            const mockUser = {
                email: this.testEmail,
                firstName: 'Test',
                lastName: 'User'
            };
            
            await emailService.sendUserApprovalEmail(mockUser);
            
            this.log('User approval email sent successfully', 'success');
            this.testResults.push({ test: 'User Approval Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`User approval email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'User Approval Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testCourseRegistrationEmail() {
        this.log('Testing course registration email...', 'test');
        
        try {
            const mockUser = {
                email: this.testEmail,
                firstName: 'Test',
                lastName: 'User'
            };
            
            const mockCourses = [{
                title: 'Advanced Botox Training',
                courseCode: 'BOT-2024-001',
                startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                price: 1500,
                courseType: 'In-Person Training'
            }];
            
            const mockPaymentInfo = {
                transactionId: 'TEST-' + Date.now(),
                totalAmount: 1500,
                paymentMethod: 'Credit Card'
            };
            
            await emailService.sendCourseRegistrationEmail(mockUser, mockCourses, mockPaymentInfo);
            
            this.log('Course registration email sent successfully', 'success');
            this.testResults.push({ test: 'Course Registration Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Course registration email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Course Registration Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testCourseAnnouncementEmail() {
        this.log('Testing new course announcement email...', 'test');
        
        try {
            const mockCourse = {
                _id: 'test-course-id',
                title: 'Facial Aesthetics Masterclass',
                courseCode: 'FAM-2024-001',
                description: 'Comprehensive training in facial aesthetics including botox, fillers, and advanced techniques.',
                startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                duration: '3 days',
                price: 2500,
                earlyBirdPrice: 2000,
                instructor: 'Dr. Jane Smith',
                location: 'Istanbul, Turkey',
                category: 'aesthetic',
                seatsAvailable: 15,
                objectives: [
                    'Master injection techniques',
                    'Understand facial anatomy',
                    'Learn patient consultation skills'
                ],
                certificateProvided: true,
                courseType: 'InPersonAestheticTraining'
            };
            
            const mockRecipients = [{
                email: this.testEmail,
                firstName: 'Test',
                lastName: 'User'
            }];
            
            await emailService.sendNewCourseAnnouncement(mockCourse, mockRecipients.map(r => r.email));
            
            this.log('Course announcement email sent successfully', 'success');
            this.testResults.push({ test: 'Course Announcement Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Course announcement email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Course Announcement Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testCourseUpdateEmail() {
        this.log('Testing course update email...', 'test');
        
        try {
            const mockCourse = {
                title: 'Advanced Botox Training',
                courseCode: 'BOT-2024-001'
            };
            
            const updateDetails = `
                <ul>
                    <li><strong>Schedule:</strong> Course dates have been updated</li>
                    <li><strong>Venue:</strong> Location changed to Conference Center B</li>
                </ul>
            `;
            
            const mockStudents = [{
                email: this.testEmail,
                firstName: 'Test',
                lastName: 'User'
            }];
            
            await emailService.sendCourseUpdateEmail(mockCourse, updateDetails, mockStudents);
            
            this.log('Course update email sent successfully', 'success');
            this.testResults.push({ test: 'Course Update Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Course update email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Course Update Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testCourseReminderEmail() {
        this.log('Testing course reminder email...', 'test');
        
        try {
            const mockUser = {
                email: this.testEmail,
                firstName: 'Test',
                lastName: 'User'
            };
            
            const mockCourse = {
                title: 'Botox Training Workshop',
                courseCode: 'BOT-2024-001',
                startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                location: 'Training Center, Room 101',
                instructor: 'Dr. John Doe',
                courseType: 'In-Person Training'
            };
            
            await emailService.sendCourseStartingReminder(mockUser, mockCourse);
            
            this.log('Course reminder email sent successfully', 'success');
            this.testResults.push({ test: 'Course Reminder Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Course reminder email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Course Reminder Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testCertificateEmail() {
        this.log('Testing certificate earned email...', 'test');
        
        try {
            const mockUser = {
                email: this.testEmail,
                firstName: 'Test',
                lastName: 'User'
            };
            
            const mockCertificate = {
                certificateId: 'CERT-' + Date.now(),
                certificateDetails: {
                    completionDate: new Date(),
                    verificationCode: 'VERIFY-12345'
                }
            };
            
            const mockCourse = {
                title: 'Advanced Aesthetics Training'
            };
            
            await emailService.sendCertificateEarnedEmail(mockUser, mockCertificate, mockCourse);
            
            this.log('Certificate email sent successfully', 'success');
            this.testResults.push({ test: 'Certificate Email', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Certificate email test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Certificate Email', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    async testScheduledNotification() {
        this.log('Testing scheduled notification (5 seconds delay)...', 'test');
        
        try {
            const mockCourse = {
                _id: 'test-scheduled-' + Date.now(),
                basic: {
                    title: 'Test Scheduled Course',
                    courseCode: 'TEST-001',
                    status: 'open'
                },
                schedule: {
                    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                },
                enrollment: {
                    price: 1000
                },
                instructors: {
                    primary: {
                        name: 'Test Instructor'
                    }
                }
            };
            
            // Schedule for 5 seconds from now (for testing)
            const scheduledTime = new Date(Date.now() + 5000);
            const jobId = courseNotificationController.scheduleNewCourseNotification(
                mockCourse._id.toString(),
                courseNotificationController.prepareCourseDataForEmail(mockCourse),
                [{ email: this.testEmail, firstName: 'Test', lastName: 'User' }],
                scheduledTime
            );
            
            this.log(`Notification scheduled for ${scheduledTime.toLocaleTimeString()}`, 'info');
            this.log('Waiting 6 seconds for scheduled email...', 'info');
            
            // Wait for the scheduled email
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            this.log('Scheduled notification test completed', 'success');
            this.testResults.push({ test: 'Scheduled Notification', status: 'PASSED' });
            
        } catch (error) {
            this.log(`Scheduled notification test failed: ${error.message}`, 'error');
            this.testResults.push({ test: 'Scheduled Notification', status: 'FAILED', error: error.message });
        }
        
        console.log('');
    }

    printTestSummary() {
        console.log(`${colors.bright}${colors.cyan}`);
        console.log('╔════════════════════════════════════════╗');
        console.log('║           TEST SUMMARY                 ║');
        console.log('╚════════════════════════════════════════╝');
        console.log(colors.reset);
        
        const passed = this.testResults.filter(r => r.status === 'PASSED').length;
        const failed = this.testResults.filter(r => r.status === 'FAILED').length;
        
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
        console.log('');
        
        console.log('Test Results:');
        console.log('─────────────────────────────────────────');
        
        this.testResults.forEach(result => {
            const statusColor = result.status === 'PASSED' ? colors.green : colors.red;
            const statusIcon = result.status === 'PASSED' ? '✓' : '✗';
            console.log(`${statusColor}${statusIcon} ${result.test}: ${result.status}${colors.reset}`);
            if (result.error) {
                console.log(`  └─ Error: ${result.error}`);
            }
        });
        
        console.log('');
        
        if (failed === 0) {
            console.log(`${colors.green}${colors.bright}All tests passed! Your email system is working correctly.${colors.reset}`);
        } else {
            console.log(`${colors.red}${colors.bright}Some tests failed. Please check your configuration.${colors.reset}`);
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new EmailTester();
    
    // Allow custom test email via command line
    if (process.argv[2]) {
        tester.testEmail = process.argv[2];
    }
    
    console.log('');
    tester.runAllTests()
        .then(() => {
            console.log('');
            console.log('Test suite completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Test suite error:', error);
            process.exit(1);
        });
}

module.exports = EmailTester;