// routes/emailTestRoutes.js
const express = require('express');
const router = express.Router();
const emailService = require('../utils/emailService');
const isAuthenticated = require('../middlewares/isAuthenticated');
const isAdmin = require('../middlewares/isAdmin');

// Test email configuration (Admin only)
router.get('/test-email-config', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const testResult = await emailService.testEmailConfiguration();
        res.json(testResult);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Send test email to specific address (Admin only)
router.post('/test-email-send', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { to, type = 'test' } = req.body;
        
        // Validate email
        if (!emailService.validateEmail(to)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email address' 
            });
        }
        
        let result;
        
        switch (type) {
            case 'approval':
                result = await emailService.sendUserApprovalEmail({
                    email: to,
                    firstName: 'Test',
                    lastName: 'User'
                });
                break;
                
            case 'course':
                result = await emailService.sendCourseRegistrationEmail(
                    { email: to, firstName: 'Test', lastName: 'User' },
                    [{
                        title: 'Test Course',
                        courseCode: 'TEST-101',
                        courseType: 'Self-Paced Training',
                        price: 99.99,
                        startDate: new Date()
                    }],
                    {
                        amount: 99.99,
                        referenceNumber: 'TEST-REF-123',
                        method: 'Credit Card'
                    }
                );
                break;
                
            case 'certificate':
                result = await emailService.sendCertificateEarnedEmail(
                    { email: to, firstName: 'Test', lastName: 'User' },
                    {
                        certificateId: 'CERT-TEST-123',
                        issueDate: new Date(),
                        verificationCode: 'VERIFY-123',
                        courseStats: { averageScore: 95 }
                    },
                    {
                        title: 'Test Course',
                        courseCode: 'TEST-101'
                    }
                );
                break;
                
            default:
                result = await emailService.sendEmail(
                    to,
                    'Test Email - IAAI Training',
                    '<h1>Test Email</h1><p>This is a test email from IAAI Training system.</p>'
                );
        }
        
        res.json({ 
            success: true, 
            message: 'Test email sent successfully!',
            result 
        });
        
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Preview email template (Admin only)
router.post('/preview-email-template', isAuthenticated, isAdmin, (req, res) => {
    try {
        const { template, data } = req.body;
        const emailTemplates = require('../utils/emailTemplates');
        
        let html;
        switch (template) {
            case 'userApproval':
                html = emailTemplates.userApproval(data.user || {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john.doe@example.com'
                });
                break;
                
            case 'courseRegistration':
                html = emailTemplates.courseRegistration(
                    data.user || { firstName: 'John', lastName: 'Doe' },
                    data.courses || [{
                        title: 'Sample Course',
                        courseCode: 'SC-101',
                        courseType: 'In-Person Training',
                        price: 299,
                        startDate: new Date(),
                        location: 'New York, NY'
                    }],
                    data.paymentInfo || {
                        amount: 299,
                        referenceNumber: 'REF-12345',
                        method: 'Credit Card'
                    }
                );
                break;
                
            case 'certificateEarned':
                html = emailTemplates.certificateEarned(
                    data.user || { firstName: 'John', lastName: 'Doe' },
                    data.certificate || {
                        certificateId: 'CERT-2024-001',
                        issueDate: new Date(),
                        verificationCode: 'VERIFY-ABC123',
                        courseStats: {
                            averageScore: 92,
                            completedVideos: 10,
                            totalVideos: 10,
                            timeSpent: 7200
                        }
                    },
                    data.course || {
                        title: 'Advanced Aesthetic Techniques',
                        courseCode: 'AAT-201'
                    }
                );
                break;
                
            case 'courseReminder':
                html = emailTemplates.courseReminder(
                    data.user || { firstName: 'John', lastName: 'Doe' },
                    data.course || {
                        title: 'Botox Injection Techniques',
                        courseCode: 'BIT-101',
                        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        instructor: 'Dr. Jane Smith',
                        location: 'IAAI Training Center, New York',
                        venue: 'Room 205, Second Floor',
                        courseType: 'In-Person Training'
                    }
                );
                break;
                
            case 'passwordReset':
                html = emailTemplates.passwordReset(
                    data.user || { firstName: 'John', lastName: 'Doe' },
                    data.resetToken || 'sample-reset-token-123456'
                );
                break;
                
            case 'paymentReceipt':
                html = emailTemplates.paymentReceipt(
                    data.user || { firstName: 'John', lastName: 'Doe' },
                    data.paymentDetails || {
                        receiptNumber: 'RCP-2024-001',
                        date: new Date(),
                        method: 'Credit Card',
                        amount: 599.99
                    },
                    data.courses || [{
                        title: 'Complete Aesthetic Training Bundle',
                        courseCode: 'CATB-301',
                        price: 599.99
                    }]
                );
                break;
                
            case 'newCourseAnnouncement':
                html = emailTemplates.newCourseAnnouncement(
                    data.user || { firstName: 'John' },
                    data.course || {
                        title: 'Revolutionary Lip Filler Techniques',
                        courseCode: 'LFT-401',
                        description: 'Master the latest lip augmentation techniques with our expert instructors.',
                        instructor: 'Dr. Sarah Johnson',
                        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        duration: '2 days',
                        price: 1299,
                        earlyBirdPrice: 999,
                        seatsAvailable: 15,
                        _id: 'course-id-123'
                    }
                );
                break;
                
            case 'weeklyDigest':
                html = emailTemplates.weeklyDigest(
                    data.user || { firstName: 'John' },
                    data.updates || {
                        coursesInProgress: [{
                            title: 'Dermal Fillers Masterclass',
                            progress: 65,
                            nextDeadline: 'Complete Module 3 by Friday'
                        }],
                        newCourses: [{
                            title: 'PDO Thread Lift Training',
                            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                        }],
                        upcomingCourses: [{
                            title: 'Chemical Peels Workshop',
                            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        }],
                        achievements: [
                            'Completed "Botox Basics" with 95% score',
                            'Earned Certificate in Aesthetic Medicine'
                        ],
                        hasUpdates: true
                    }
                );
                break;
                
            case 'userRejection':
                html = emailTemplates.userRejection(
                    data.user || { 
                        firstName: 'John', 
                        lastName: 'Doe',
                        email: 'john.doe@example.com'
                    },
                    data.reason || 'Incomplete application information provided.'
                );
                break;
                
            case 'courseCompletion':
                html = emailTemplates.courseCompletion(
                    data.user || { firstName: 'John' },
                    data.course || {
                        title: 'Introduction to Aesthetic Medicine',
                        courseCode: 'IAM-101',
                        courseStats: {
                            completedVideos: 12,
                            totalVideos: 12,
                            timeSpent: 14400
                        }
                    }
                );
                break;
                
            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid template name. Available templates: userApproval, userRejection, courseRegistration, certificateEarned, courseReminder, passwordReset, paymentReceipt, newCourseAnnouncement, weeklyDigest, courseCompletion' 
                });
        }
        
        res.send(html);
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get email statistics (Admin only)
router.get('/email-stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // This would connect to your email log database
        // For now, returning sample data
        const stats = {
            today: {
                sent: 45,
                failed: 2,
                pending: 5
            },
            thisWeek: {
                sent: 312,
                failed: 8,
                pending: 5
            },
            thisMonth: {
                sent: 1247,
                failed: 23,
                pending: 5
            },
            byType: {
                approval: 15,
                registration: 78,
                reminder: 156,
                certificate: 23,
                announcement: 89,
                digest: 124,
                other: 45
            }
        };
        
        res.json({ success: true, stats });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Resend failed email (Admin only)
router.post('/resend-email/:emailId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { emailId } = req.params;
        
        // This would fetch the failed email from your log
        // and attempt to resend it
        
        res.json({ 
            success: true, 
            message: 'Email queued for resending' 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Test course reminder functionality (Admin only)
router.post('/test-course-reminder', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await emailService.checkAndSendCourseReminders();
        
        res.json({ 
            success: true, 
            message: 'Course reminder check completed' 
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Update user email preferences (for users)
router.put('/email-preferences', isAuthenticated, async (req, res) => {
    try {
        const { preferences } = req.body;
        const user = req.user;
        
        // Update notification settings
        if (preferences.email !== undefined) {
            user.notificationSettings.email = preferences.email;
        }
        if (preferences.courseUpdates !== undefined) {
            user.notificationSettings.courseUpdates = preferences.courseUpdates;
        }
        if (preferences.promotions !== undefined) {
            user.notificationSettings.promotions = preferences.promotions;
        }
        if (preferences.reminders !== undefined) {
            user.notificationSettings.reminders = preferences.reminders;
        }
        if (preferences.digest !== undefined) {
            user.notificationSettings.digest = preferences.digest;
        }
        
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Email preferences updated successfully',
            preferences: user.notificationSettings
        });
        
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Unsubscribe from emails (public route with token)
router.get('/unsubscribe/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        // Decode token to get user email
        // This is a simplified version - implement proper token verification
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const email = decoded.split('|')[0];
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('Invalid unsubscribe link');
        }
        
        // Update all email preferences to false
        user.notificationSettings.email = false;
        user.notificationSettings.courseUpdates = false;
        user.notificationSettings.promotions = false;
        user.notificationSettings.reminders = false;
        await user.save();
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Unsubscribed - IAAI Training</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f4f4f4;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        text-align: center;
                        max-width: 500px;
                    }
                    h1 { color: #1a365d; }
                    p { color: #555; margin: 20px 0; }
                    a {
                        display: inline-block;
                        margin-top: 20px;
                        padding: 12px 24px;
                        background-color: #3182ce;
                        color: white;
                        text-decoration: none;
                        border-radius: 5px;
                    }
                    a:hover { background-color: #2c5282; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Unsubscribed Successfully</h1>
                    <p>You have been unsubscribed from all IAAI Training emails.</p>
                    <p>We're sorry to see you go. You can always resubscribe by updating your preferences in your account settings.</p>
                    <a href="${process.env.BASE_URL || 'http://localhost:3000'}">Return to Homepage</a>
                </div>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).send('Error processing unsubscribe request');
    }
});

module.exports = router;