// test/testRealUserNotifications.js
/**
 * Test email notifications with actual users from your database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const emailService = require('../utils/emailService');
const sendEmail = require('../utils/sendEmail');

async function testWithRealUsers() {
    console.log('\n🚀 Testing Email Notifications with Real Users\n');
    
    try {
        // 1. Connect to database
        console.log('📊 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to database\n');

        // 2. Get user statistics
        await displayUserStats();

        // 3. Test with different user groups
        console.log('\n🧪 Running notification tests...\n');
        
        // Test 1: Users who want notifications
        await testNotificationEligibleUsers();
        
        // Test 2: All confirmed users (show who's opted out)
        await testAllConfirmedUsers();
        
        // Test 3: Send test email to specific users
        await testSpecificUsers();
        
        // Test 4: Simulate actual course notification
        await testActualCourseNotification();

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n📊 Database connection closed');
    }
}

// Display user statistics
async function displayUserStats() {
    console.log('📈 User Statistics:\n');
    
    const totalUsers = await User.countDocuments();
    const confirmedUsers = await User.countDocuments({ isConfirmed: true });
    const notificationEnabledUsers = await User.countDocuments({
        isConfirmed: true,
        'notificationSettings.courseUpdates': { $ne: false }
    });
    
    console.log(`Total users: ${totalUsers}`);
    console.log(`Confirmed users: ${confirmedUsers}`);
    console.log(`Users with notifications enabled: ${notificationEnabledUsers}`);
    
    // Show breakdown by notification settings
    const notificationStats = await User.aggregate([
        { $match: { isConfirmed: true } },
        {
            $group: {
                _id: {
                    email: '$notificationSettings.email',
                    courseUpdates: '$notificationSettings.courseUpdates'
                },
                count: { $sum: 1 }
            }
        }
    ]);
    
    console.log('\n📊 Notification Preferences Breakdown:');
    notificationStats.forEach(stat => {
        console.log(`  Email: ${stat._id.email}, Course Updates: ${stat._id.courseUpdates} → ${stat.count} users`);
    });
}

// Test 1: Users who are eligible for notifications
async function testNotificationEligibleUsers() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Test 1: Notification-Eligible Users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const eligibleUsers = await User.find({
        isConfirmed: true,
        'notificationSettings.courseUpdates': { $ne: false }
    }).select('email firstName lastName notificationSettings').limit(10);
    
    console.log(`Found ${eligibleUsers.length} eligible users (showing max 10):\n`);
    
    eligibleUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Notifications: ${JSON.stringify(user.notificationSettings)}`);
        console.log('');
    });
    
    if (eligibleUsers.length > 0) {
        console.log('📤 Sending test email to these users...\n');
        
        const mockCourse = createMockCourse();
        const emails = eligibleUsers.map(u => u.email);
        
        // Send using BCC method (current implementation)
        await emailService.sendNewCourseAnnouncement(mockCourse, emails);
        
        console.log('✅ Emails sent via BCC method');
        console.log('ℹ️  Check the inboxes (and spam folders) of the above users');
    }
}

// Test 2: Show all confirmed users and their preferences
async function testAllConfirmedUsers() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Test 2: All Confirmed Users Status');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const allConfirmedUsers = await User.find({
        isConfirmed: true
    }).select('email firstName lastName notificationSettings').limit(20);
    
    console.log(`Showing ${allConfirmedUsers.length} confirmed users (max 20):\n`);
    
    const optedIn = [];
    const optedOut = [];
    
    allConfirmedUsers.forEach(user => {
        const wantsNotifications = user.notificationSettings?.courseUpdates !== false;
        
        if (wantsNotifications) {
            optedIn.push(user);
        } else {
            optedOut.push(user);
        }
    });
    
    console.log(`✅ Opted IN for notifications (${optedIn.length} users):`);
    optedIn.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
    });
    
    console.log(`\n❌ Opted OUT of notifications (${optedOut.length} users):`);
    optedOut.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
    });
}

// Test 3: Send to specific users
async function testSpecificUsers() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Test 3: Individual Emails to Each User');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Get a few users for individual testing
    const testUsers = await User.find({
        isConfirmed: true,
        'notificationSettings.courseUpdates': { $ne: false }
    }).select('email firstName lastName').limit(3);
    
    if (testUsers.length === 0) {
        console.log('⚠️  No eligible users found for individual email test');
        return;
    }
    
    console.log(`Sending individual emails to ${testUsers.length} users:\n`);
    
    const mockCourse = createMockCourse();
    
    for (const user of testUsers) {
        try {
            console.log(`📤 Sending to: ${user.email}...`);
            
            // Send individual email
            await sendEmail({
                to: user.email,
                subject: `[Individual Test] New Course: ${mockCourse.title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Hi ${user.firstName}!</h2>
                        <p>This is a TEST individual email (not BCC) to verify you receive notifications.</p>
                        <h3>${mockCourse.title}</h3>
                        <p>${mockCourse.description}</p>
                        <p><strong>Start Date:</strong> ${new Date(mockCourse.startDate).toLocaleDateString()}</p>
                        <p><strong>Price:</strong> $${mockCourse.price}</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">
                            This individual email was sent directly to: ${user.email}<br>
                            Time: ${new Date().toLocaleTimeString()}
                        </p>
                    </div>
                `
            });
            
            console.log(`   ✅ Sent successfully`);
            
            // Small delay between emails
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}`);
        }
    }
}

// Test 4: Simulate actual course notification system
async function testActualCourseNotification() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Test 4: Simulate Real Course Notification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // This simulates what happens when a course is created
    const courseNotificationController = require('../controllers/admin/courseNotificationController');
    
    // Get all recipients (same logic as the actual system)
    const recipients = await courseNotificationController.getAllRecipients();
    
    console.log(`📊 Found ${recipients.length} recipients who will receive notifications\n`);
    
    if (recipients.length > 10) {
        console.log('Showing first 10 recipients:');
        recipients.slice(0, 10).forEach((r, i) => {
            console.log(`${i + 1}. ${r.email} - ${r.firstName} ${r.lastName}`);
        });
        console.log(`... and ${recipients.length - 10} more\n`);
    } else {
        recipients.forEach((r, i) => {
            console.log(`${i + 1}. ${r.email} - ${r.firstName} ${r.lastName}`);
        });
    }
    
    // Ask for confirmation before sending to all
    if (recipients.length > 5) {
        console.log('\n⚠️  This will send emails to ALL eligible users!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    const mockCourse = createMockCourse();
    mockCourse.title = '[SYSTEM TEST] ' + mockCourse.title;
    
    console.log('📤 Sending course announcement to all recipients...\n');
    
    const emails = recipients.map(r => r.email);
    await emailService.sendNewCourseAnnouncement(mockCourse, emails);
    
    console.log('✅ Course announcement sent to all eligible users!');
}

// Create mock course
function createMockCourse() {
    return {
        _id: 'test-' + Date.now(),
        courseType: 'InPersonAestheticTraining',
        title: 'TEST: Email Notification Verification Course',
        courseCode: 'TEST-EMAIL-' + Date.now().toString().slice(-6),
        description: 'This is a TEST email to verify the notification system is working correctly. This is NOT a real course.',
        category: 'aesthetic',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        duration: '3 days',
        price: 1999,
        earlyBirdPrice: 1499,
        location: 'IAAI Training Center, Test Location',
        instructor: 'Test Instructor',
        seatsAvailable: 20,
        certificateProvided: true,
        objectives: [
            'This is a test objective',
            'To verify email delivery',
            'To ensure all users receive notifications'
        ]
    };
}

// Summary report
async function generateSummaryReport() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const report = {
        totalUsers: await User.countDocuments(),
        confirmedUsers: await User.countDocuments({ isConfirmed: true }),
        unconfirmedUsers: await User.countDocuments({ isConfirmed: false }),
        notificationEnabled: await User.countDocuments({
            isConfirmed: true,
            'notificationSettings.courseUpdates': { $ne: false }
        }),
        notificationDisabled: await User.countDocuments({
            isConfirmed: true,
            'notificationSettings.courseUpdates': false
        })
    };
    
    console.log('User Statistics:');
    console.log(`• Total Users: ${report.totalUsers}`);
    console.log(`• Confirmed: ${report.confirmedUsers} (${((report.confirmedUsers/report.totalUsers)*100).toFixed(1)}%)`);
    console.log(`• Unconfirmed: ${report.unconfirmedUsers} (${((report.unconfirmedUsers/report.totalUsers)*100).toFixed(1)}%)`);
    console.log(`• Will receive notifications: ${report.notificationEnabled}`);
    console.log(`• Opted out of notifications: ${report.notificationDisabled}`);
    
    // Show some sample users who will receive notifications
    console.log('\n📧 Sample users who will receive notifications:');
    const sampleUsers = await User.find({
        isConfirmed: true,
        'notificationSettings.courseUpdates': { $ne: false }
    }).select('email').limit(5);
    
    sampleUsers.forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.email}`);
    });
    
    if (report.notificationEnabled > 5) {
        console.log(`  ... and ${report.notificationEnabled - 5} more users`);
    }
}

// Menu-driven test
async function interactiveTest() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const question = (query) => new Promise((resolve) => readline.question(query, resolve));
    
    console.log('\n🎯 Interactive Email Test Menu\n');
    console.log('1. Show user statistics');
    console.log('2. Test with notification-eligible users (BCC)');
    console.log('3. Test with individual emails');
    console.log('4. Test full system (send to ALL users)');
    console.log('5. Generate summary report');
    console.log('6. Exit\n');
    
    const choice = await question('Select an option (1-6): ');
    
    switch (choice) {
        case '1':
            await displayUserStats();
            break;
        case '2':
            await testNotificationEligibleUsers();
            break;
        case '3':
            await testSpecificUsers();
            break;
        case '4':
            await testActualCourseNotification();
            break;
        case '5':
            await generateSummaryReport();
            break;
        case '6':
            readline.close();
            return false;
        default:
            console.log('Invalid option');
    }
    
    readline.close();
    return true;
}

// Main execution
if (require.main === module) {
    console.log('====================================');
    console.log('Real User Email Notification Test');
    console.log('====================================');
    
    // Check if running in interactive mode
    const isInteractive = process.argv.includes('--interactive') || process.argv.includes('-i');
    
    if (isInteractive) {
        (async () => {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training');
            let continueTest = true;
            while (continueTest) {
                continueTest = await interactiveTest();
                if (continueTest) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            await mongoose.connection.close();
            process.exit(0);
        })();
    } else {
        // Run all tests
        testWithRealUsers()
            .then(async () => {
                await generateSummaryReport();
                console.log('\n✅ All tests completed!');
                console.log('\nTip: Run with --interactive flag for menu-driven testing');
                process.exit(0);
            })
            .catch(error => {
                console.error('\n❌ Test error:', error);
                process.exit(1);
            });
    }
}