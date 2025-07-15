// test/testRealCourseNotification.js
/**
 * Test sending REAL course notifications to ACTUAL users in database
 * This simulates what happens when a new course is created
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const emailService = require('../utils/emailService');
const courseNotificationController = require('../controllers/admin/courseNotificationController');

async function sendRealCourseNotification() {
    try {
        console.log('\n🚀 REAL Course Notification Test\n');
        console.log('This will send actual emails to real users in your database.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training');
        console.log('✅ Connected to database\n');

        // Step 1: Get ALL users from database
        console.log('📊 DATABASE USER ANALYSIS:\n');
        
        const allUsers = await User.find({}).select('email firstName lastName isConfirmed notificationSettings.courseUpdates');
        console.log(`Total users in database: ${allUsers.length}`);
        
        // Show all users and their status
        console.log('\n👥 ALL USERS IN DATABASE:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        allUsers.forEach((user, index) => {
            const willReceive = user.isConfirmed && user.notificationSettings?.courseUpdates !== false;
            console.log(`${index + 1}. ${user.email}`);
            console.log(`   Name: ${user.firstName} ${user.lastName}`);
            console.log(`   Confirmed: ${user.isConfirmed ? '✅' : '❌'}`);
            console.log(`   Notifications: ${user.notificationSettings?.courseUpdates !== false ? '✅' : '❌'}`);
            console.log(`   Will receive email: ${willReceive ? '✅ YES' : '❌ NO'}`);
            console.log('');
        });

        // Step 2: Get eligible users (same logic as production)
        const eligibleUsers = await courseNotificationController.getAllRecipients();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`\n✅ ELIGIBLE RECIPIENTS: ${eligibleUsers.length} users\n`);
        
        eligibleUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
        });

        if (eligibleUsers.length === 0) {
            console.log('\n❌ No eligible users found!');
            console.log('Users must have:');
            console.log('  - isConfirmed: true');
            console.log('  - notificationSettings.courseUpdates: not false');
            return;
        }

        // Step 3: Create a realistic course (not marked as TEST)
        const realCourse = {
            _id: mongoose.Types.ObjectId(),
            basic: {
                title: 'Advanced Facial Aesthetics Masterclass',
                courseCode: 'AFM-2024-001',
                description: 'Master the latest techniques in facial aesthetics with our comprehensive 3-day intensive training. Learn advanced injection techniques, facial anatomy, and patient consultation skills from industry experts.',
                category: 'aesthetic',
                status: 'open'
            },
            schedule: {
                startDate: new Date('2024-02-15T09:00:00'),
                endDate: new Date('2024-02-17T17:00:00'),
                duration: '3 days'
            },
            enrollment: {
                price: 3500,
                earlyBirdPrice: 2800,
                currency: 'USD',
                seatsAvailable: 20
            },
            venue: {
                name: 'IAAI Training Center',
                city: 'Istanbul',
                country: 'Turkey'
            },
            instructors: {
                primary: {
                    name: 'Dr. Sarah Mitchell'
                }
            },
            content: {
                objectives: [
                    'Master advanced botox and filler injection techniques',
                    'Understand facial anatomy and danger zones',
                    'Learn patient assessment and consultation skills',
                    'Practice on live models under expert supervision',
                    'Understand complications and their management'
                ]
            },
            certification: {
                enabled: true
            }
        };

        // Prepare course data for email
        const courseData = courseNotificationController.prepareCourseDataForEmail(realCourse);
        
        console.log('\n📧 COURSE DETAILS TO BE SENT:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Title: ${courseData.title}`);
        console.log(`Code: ${courseData.courseCode}`);
        console.log(`Start Date: ${new Date(courseData.startDate).toLocaleDateString()}`);
        console.log(`Location: ${courseData.location}`);
        console.log(`Price: $${courseData.price} USD`);
        console.log(`Early Bird: $${courseData.earlyBirdPrice} USD`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Step 4: Confirmation before sending
        console.log('⚠️  CONFIRMATION REQUIRED');
        console.log(`This will send REAL course announcement emails to ${eligibleUsers.length} users.`);
        console.log('The emails will look like actual course announcements (not test emails).\n');
        
        // Wait 5 seconds for user to cancel
        console.log('Sending in 5 seconds... Press Ctrl+C to cancel');
        for (let i = 5; i > 0; i--) {
            process.stdout.write(`\r${i}...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n');

        // Step 5: Send the actual notifications
        console.log('📤 Sending course announcements...\n');
        
        const emails = eligibleUsers.map(u => u.email);
        
        try {
            // Method 1: Using the production email service (BCC)
            await emailService.sendNewCourseAnnouncement(courseData, emails);
            console.log('✅ Course announcement sent successfully via BCC method!');
            
            // Log what was sent
            console.log('\n📋 NOTIFICATION SUMMARY:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`✅ Emails sent to: ${eligibleUsers.length} recipients`);
            console.log(`📧 Subject: "New Course Available: ${courseData.title}"`);
            console.log(`🕐 Sent at: ${new Date().toLocaleString()}`);
            console.log('\n📬 Recipients who should check their email:');
            eligibleUsers.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.email}`);
            });
            
        } catch (error) {
            console.error('❌ Error sending notifications:', error);
            console.error('Details:', error.message);
        }

        // Step 6: Test what happens in production (2-hour delay)
        console.log('\n\n🕐 PRODUCTION BEHAVIOR TEST:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('In production, when you create a course:');
        console.log('1. Course is saved to database');
        console.log('2. If status is "open", notifications are scheduled');
        console.log('3. Emails are sent 2 hours later');
        console.log('4. Updates within 2 hours do NOT trigger new emails');
        console.log('5. Updates after 2 hours notify only registered students\n');

        // Optional: Test the 2-hour delay system
        const testDelaySystem = false; // Set to true to test scheduled notification
        
        if (testDelaySystem) {
            console.log('📅 Testing scheduled notification (5 seconds instead of 2 hours)...\n');
            
            const scheduledTime = new Date(Date.now() + 5000); // 5 seconds
            courseNotificationController.scheduleNewCourseNotification(
                realCourse._id.toString(),
                courseData,
                eligibleUsers,
                scheduledTime
            );
            
            console.log(`Notification scheduled for: ${scheduledTime.toLocaleTimeString()}`);
            console.log('Waiting...');
            
            await new Promise(resolve => setTimeout(resolve, 6000));
            console.log('✅ Scheduled notification test completed');
        }

        // Step 7: Instructions for checking
        console.log('\n\n📋 WHAT TO DO NEXT:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('1. Check email inboxes for all recipients listed above');
        console.log('2. Check SPAM/JUNK folders if not in inbox');
        console.log('3. In Gmail, check "All Mail" or "Promotions" tab');
        console.log('4. The email subject is: "New Course Available: Advanced Facial Aesthetics Masterclass"');
        console.log('5. The email contains course details, pricing, and enrollment button');
        console.log('\n💡 TIP: Add your sending email to contacts to prevent spam filtering');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

// Alternative: Send to specific user only
async function sendToSpecificUser(email) {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training');
        
        const user = await User.findOne({ email: email });
        if (!user) {
            console.log(`❌ User ${email} not found`);
            return;
        }

        if (!user.isConfirmed || user.notificationSettings?.courseUpdates === false) {
            console.log(`❌ User ${email} is not eligible for notifications`);
            console.log(`   Confirmed: ${user.isConfirmed}`);
            console.log(`   Notifications: ${user.notificationSettings?.courseUpdates !== false}`);
            return;
        }

        console.log(`\n📧 Sending course notification to: ${email}`);
        
        const courseData = {
            _id: 'test-single-' + Date.now(),
            courseType: 'InPersonAestheticTraining',
            title: 'Botox and Dermal Fillers Training',
            courseCode: 'BDF-2024-001',
            description: 'Comprehensive training in botox and dermal filler techniques.',
            startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            price: 2500,
            location: 'Istanbul, Turkey',
            instructor: 'Dr. John Smith'
        };

        await emailService.sendNewCourseAnnouncement(courseData, [email]);
        console.log('✅ Email sent successfully!');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === '--user' && args[1]) {
        // Send to specific user: node test/testRealCourseNotification.js --user email@example.com
        sendToSpecificUser(args[1]);
    } else {
        // Send to all eligible users
        console.log('====================================================');
        console.log('     REAL COURSE NOTIFICATION TEST                  ');
        console.log('====================================================');
        console.log('This will send actual course emails to real users!\n');
        
        sendRealCourseNotification();
    }
}