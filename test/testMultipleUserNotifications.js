// test/testMultipleUserNotifications.js
/**
 * Test sending notifications to multiple users
 * This will help verify that all users receive emails
 */

require('dotenv').config();
const mongoose = require('mongoose');
const emailService = require('../utils/emailService');
const User = require('../models/user');

// Test email addresses - add your test emails here
const TEST_USERS = [
    { email: 'test1@example.com', firstName: 'Test', lastName: 'User1' },
    { email: 'test2@example.com', firstName: 'Test', lastName: 'User2' },
    { email: 'test3@example.com', firstName: 'Test', lastName: 'User3' },
    // Add more test emails as needed
];

async function testMultipleUserNotifications() {
    console.log('\n🚀 Testing Multiple User Notifications\n');
    
    try {
        // Option 1: Test with hardcoded test users (no database needed)
        console.log('📧 Option 1: Testing with hardcoded email list...\n');
        await testWithHardcodedUsers();
        
        // Option 2: Test with actual users from database
        console.log('\n📧 Option 2: Testing with database users...\n');
        await testWithDatabaseUsers();
        
        // Option 3: Test individual emails (not BCC)
        console.log('\n📧 Option 3: Testing individual emails to each user...\n');
        await testIndividualEmails();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Test 1: Using hardcoded test users
async function testWithHardcodedUsers() {
    const mockCourse = createMockCourse();
    
    // Get test email addresses
    const testEmails = TEST_USERS.map(u => u.email);
    
    console.log(`Sending to ${testEmails.length} test users:`, testEmails);
    
    // This uses BCC - all users get the same email
    await emailService.sendNewCourseAnnouncement(mockCourse, testEmails);
    
    console.log('✅ Emails sent via BCC to all test users');
}

// Test 2: Using actual database users
async function testWithDatabaseUsers() {
    try {
        // Connect to database if not connected
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training');
            console.log('📊 Connected to database');
        }
        
        // Get users who want notifications
        const users = await User.find({
            isConfirmed: true,
            'notificationSettings.courseUpdates': { $ne: false }
        }).select('email firstName lastName').limit(5); // Limit to 5 for testing
        
        console.log(`Found ${users.length} users who want notifications`);
        
        if (users.length === 0) {
            console.log('⚠️  No confirmed users found with notifications enabled');
            console.log('Creating test users in database...');
            
            // Create test users
            for (const testUser of TEST_USERS) {
                try {
                    await User.create({
                        ...testUser,
                        password: 'testpassword123',
                        isConfirmed: true,
                        notificationSettings: {
                            email: true,
                            courseUpdates: true
                        }
                    });
                    console.log(`✅ Created test user: ${testUser.email}`);
                } catch (err) {
                    if (err.code === 11000) {
                        console.log(`User already exists: ${testUser.email}`);
                    }
                }
            }
            
            // Retry getting users
            const retryUsers = await User.find({
                isConfirmed: true,
                'notificationSettings.courseUpdates': { $ne: false }
            }).select('email firstName lastName');
            
            if (retryUsers.length > 0) {
                await sendToUsers(retryUsers);
            }
        } else {
            await sendToUsers(users);
        }
        
    } catch (error) {
        console.error('Database test error:', error);
    }
}

// Test 3: Send individual emails (not BCC)
async function testIndividualEmails() {
    const mockCourse = createMockCourse();
    
    console.log('Sending individual emails to each user...\n');
    
    for (const user of TEST_USERS) {
        try {
            // Modify the email service to send individual emails
            await sendIndividualCourseAnnouncement(user, mockCourse);
            console.log(`✅ Email sent to: ${user.email}`);
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`❌ Failed to send to ${user.email}:`, error.message);
        }
    }
}

// Helper function to send to users
async function sendToUsers(users) {
    const mockCourse = createMockCourse();
    const emails = users.map(u => u.email);
    
    console.log('Sending to users:', emails);
    
    await emailService.sendNewCourseAnnouncement(mockCourse, emails);
    
    console.log(`✅ Course announcement sent to ${users.length} users`);
}

// Helper function to send individual announcement
async function sendIndividualCourseAnnouncement(user, course) {
    const sendEmail = require('../utils/sendEmail');
    
    const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎓 New Course Available!</h1>
                </div>
                <div class="content">
                    <p>Dear ${user.firstName},</p>
                    <h2>${course.title}</h2>
                    <p>${course.description}</p>
                    
                    <h3>Course Details:</h3>
                    <ul>
                        <li><strong>Start Date:</strong> ${new Date(course.startDate).toLocaleDateString()}</li>
                        <li><strong>Duration:</strong> ${course.duration}</li>
                        <li><strong>Price:</strong> $${course.price}</li>
                        <li><strong>Location:</strong> ${course.location}</li>
                    </ul>
                    
                    <center>
                        <a href="${process.env.BASE_URL}/courses/${course._id}" class="button">Learn More</a>
                    </center>
                    
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">
                        This is a test email sent individually to: ${user.email}
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    return await sendEmail({
        to: user.email,
        subject: `New Course: ${course.title} - Individual Email Test`,
        html: emailContent
    });
}

// Create mock course data
function createMockCourse() {
    return {
        _id: 'test-' + Date.now(),
        courseType: 'InPersonAestheticTraining',
        title: 'TEST: Advanced Botox Training Course',
        courseCode: 'TEST-BOT-001',
        description: 'This is a TEST email to verify all users receive notifications. Comprehensive training in advanced botox techniques.',
        category: 'aesthetic',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        duration: '3 days',
        price: 2500,
        earlyBirdPrice: 2000,
        location: 'IAAI Training Center, Istanbul',
        instructor: 'Dr. Test Instructor',
        seatsAvailable: 15,
        certificateProvided: true,
        objectives: [
            'Master advanced injection techniques',
            'Understand facial anatomy',
            'Learn patient consultation'
        ]
    };
}

// Verify email delivery
async function verifyEmailDelivery() {
    console.log('\n📊 Email Delivery Verification Tips:\n');
    console.log('1. Check SPAM/JUNK folders - bulk emails often go there');
    console.log('2. Check email service logs (if available)');
    console.log('3. Gmail: Check "All Mail" folder');
    console.log('4. Add sender email to contacts to prevent spam filtering');
    console.log('5. Use email testing services like Mail Tester');
    
    console.log('\n🔍 Current Email Configuration:');
    console.log('FROM:', process.env.EMAIL_USER);
    console.log('SERVICE:', process.env.EMAIL_SERVICE || 'gmail');
    console.log('BASE_URL:', process.env.BASE_URL || 'http://localhost:3000');
}

// Run tests
if (require.main === module) {
    console.log('====================================');
    console.log('Multiple User Email Notification Test');
    console.log('====================================\n');
    
    // You can modify TEST_USERS array at the top with your test emails
    console.log('ℹ️  Using test emails:', TEST_USERS.map(u => u.email));
    console.log('\nStarting tests...\n');
    
    testMultipleUserNotifications()
        .then(() => {
            verifyEmailDelivery();
            console.log('\n✅ All tests completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}