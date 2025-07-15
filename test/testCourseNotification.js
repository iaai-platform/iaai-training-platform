// test/testCourseNotification.js
/**
 * Fixed Course Notification Test
 * This version doesn't rely on database lookups
 */

require('dotenv').config();
const emailService = require('../utils/emailService');

async function testNotification() {
    console.log('\n📧 Testing Course Notification System\n');
    
    try {
        // 1. First test basic email configuration
        console.log('1️⃣ Testing email configuration...');
        const configTest = await emailService.testEmailConfiguration();
        if (!configTest.success) {
            throw new Error('Email configuration test failed: ' + configTest.message);
        }
        console.log('✅ Email configuration is working\n');

        // 2. Test new course announcement directly
        console.log('2️⃣ Testing new course announcement email...');
        
        const mockCourse = {
            _id: 'test-123',
            courseType: 'InPersonAestheticTraining',
            title: 'Advanced Botox and Filler Training',
            courseCode: 'BOT-2024-TEST',
            description: 'Comprehensive hands-on training in facial aesthetics including botox and dermal fillers.',
            category: 'aesthetic',
            status: 'open',
            
            // Schedule
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
            endDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000), // 16 days from now
            duration: '3 days',
            
            // Pricing
            price: 2500,
            earlyBirdPrice: 2000,
            currency: 'USD',
            
            // Location
            location: 'IAAI Training Center, Istanbul, Turkey',
            
            // Instructor
            instructor: 'Dr. Sarah Johnson',
            
            // Additional info
            seatsAvailable: 12,
            certificateProvided: true,
            objectives: [
                'Master injection techniques for botox and fillers',
                'Understand facial anatomy and danger zones',
                'Learn patient consultation and assessment',
                'Practice on live models under supervision'
            ]
        };

        // Send to test email
        const testRecipient = process.env.TEST_EMAIL || process.env.EMAIL_USER;
        console.log(`📬 Sending test announcement to: ${testRecipient}`);
        
        await emailService.sendNewCourseAnnouncement(mockCourse, [testRecipient]);
        
        console.log('✅ Course announcement email sent successfully!\n');

        // 3. Test course update notification
        console.log('3️⃣ Testing course update notification...');
        
        const updateDetails = `
            <ul>
                <li><strong>Schedule:</strong> Start time changed to 10:00 AM</li>
                <li><strong>Venue:</strong> Room changed to Conference Hall A</li>
                <li><strong>Note:</strong> Please arrive 15 minutes early for registration</li>
            </ul>
        `;
        
        const mockStudent = {
            email: testRecipient,
            firstName: 'Test',
            lastName: 'Student'
        };
        
        await emailService.sendCourseUpdateEmail(
            mockCourse,
            updateDetails,
            [mockStudent]
        );
        
        console.log('✅ Course update email sent successfully!\n');

        // 4. Test course reminder
        console.log('4️⃣ Testing course reminder (24 hours before)...');
        
        const reminderCourse = {
            ...mockCourse,
            startDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            venue: {
                name: 'IAAI Training Center',
                address: '123 Medical Plaza, Suite 400',
                city: 'Istanbul',
                country: 'Turkey'
            }
        };
        
        await emailService.sendCourseStartingReminder(mockStudent, reminderCourse);
        
        console.log('✅ Course reminder email sent successfully!\n');

        // 5. Test scheduled notification (5 seconds)
        console.log('5️⃣ Testing scheduled notification (will send in 5 seconds)...');
        
        const schedule = require('node-schedule');
        const scheduledTime = new Date(Date.now() + 5000); // 5 seconds from now
        
        console.log(`⏰ Scheduling email for: ${scheduledTime.toLocaleTimeString()}`);
        
        // Create a promise that resolves when the email is sent
        await new Promise((resolve, reject) => {
            const job = schedule.scheduleJob(scheduledTime, async () => {
                try {
                    await emailService.sendNewCourseAnnouncement(
                        { ...mockCourse, title: 'SCHEDULED: ' + mockCourse.title },
                        [testRecipient]
                    );
                    console.log('✅ Scheduled email sent successfully!');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            // Set a timeout in case the job doesn't run
            setTimeout(() => {
                job.cancel();
                reject(new Error('Scheduled job timeout'));
            }, 10000); // 10 second timeout
        });
        
        console.log('\n🎉 All notification tests completed successfully!');
        console.log(`📧 Check your inbox at: ${testRecipient}`);
        console.log('\nYou should have received:');
        console.log('  1. Course announcement email');
        console.log('  2. Course update notification');
        console.log('  3. Course reminder (24 hours before)');
        console.log('  4. Scheduled course announcement');
        
        // Test summary of what the notification controller would do
        console.log('\n📋 Notification Controller Behavior:');
        console.log('  • New courses: Email sent 2 hours after creation');
        console.log('  • Updates within 2 hours: No email sent');
        console.log('  • Updates after 2 hours: Email sent to registered students only');
        console.log('  • Cancellations: Immediate email to registered students');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        
        if (error.message.includes('EAUTH')) {
            console.error('\n🔐 Email Authentication Error:');
            console.error('1. Make sure you have 2FA enabled on Gmail');
            console.error('2. Generate an app password at: https://myaccount.google.com/apppasswords');
            console.error('3. Use the app password in EMAIL_PASS, not your regular password');
        }
        
        process.exit(1);
    }
}

// Run the test
console.log('🚀 Starting Course Notification Tests');
console.log('====================================');
testNotification().then(() => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
});