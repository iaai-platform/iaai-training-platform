// test/manageUserNotifications.js
/**
 * Utility to manage and verify user notification preferences
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function manageNotifications() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training');
        console.log('✅ Connected to database\n');

        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'list':
                await listUsers();
                break;
            case 'enable-all':
                await enableAllNotifications();
                break;
            case 'create-test-users':
                await createTestUsers();
                break;
            case 'fix-preferences':
                await fixNotificationPreferences();
                break;
            case 'find-by-email':
                await findUserByEmail(args[1]);
                break;
            default:
                showHelp();
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
    }
}

function showHelp() {
    console.log('User Notification Management Tool\n');
    console.log('Usage: node manageUserNotifications.js [command] [options]\n');
    console.log('Commands:');
    console.log('  list                    - List all users and their notification status');
    console.log('  enable-all             - Enable notifications for all confirmed users');
    console.log('  create-test-users      - Create test users with notifications enabled');
    console.log('  fix-preferences        - Fix missing notification preferences');
    console.log('  find-by-email [email]  - Find specific user and show their settings');
}

async function listUsers() {
    console.log('📋 User Notification Status\n');
    
    const users = await User.find({})
        .select('email firstName lastName isConfirmed notificationSettings')
        .sort({ createdAt: -1 })
        .limit(50);
    
    console.log(`Showing ${users.length} users (most recent first):\n`);
    
    const confirmed = [];
    const unconfirmed = [];
    
    users.forEach(user => {
        const status = {
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            confirmed: user.isConfirmed,
            emailNotif: user.notificationSettings?.email !== false,
            courseUpdates: user.notificationSettings?.courseUpdates !== false,
            willReceive: user.isConfirmed && user.notificationSettings?.courseUpdates !== false
        };
        
        if (user.isConfirmed) {
            confirmed.push(status);
        } else {
            unconfirmed.push(status);
        }
    });
    
    console.log('✅ CONFIRMED USERS:');
    console.log('Email | Name | Email Notif | Course Updates | Will Receive');
    console.log('------|------|-------------|----------------|-------------');
    confirmed.forEach(u => {
        console.log(
            `${u.email.padEnd(30)} | ${u.name.padEnd(20)} | ${u.emailNotif ? '✓' : '✗'} | ${u.courseUpdates ? '✓' : '✗'} | ${u.willReceive ? '✅ YES' : '❌ NO'}`
        );
    });
    
    console.log('\n❌ UNCONFIRMED USERS:');
    unconfirmed.forEach(u => {
        console.log(`${u.email} - ${u.name} (needs to confirm email)`);
    });
    
    // Summary
    const stats = await User.aggregate([
        {
            $group: {
                _id: {
                    confirmed: '$isConfirmed',
                    courseUpdates: '$notificationSettings.courseUpdates'
                },
                count: { $sum: 1 }
            }
        }
    ]);
    
    console.log('\n📊 SUMMARY:');
    let totalWillReceive = 0;
    stats.forEach(stat => {
        const confirmed = stat._id.confirmed ? 'Confirmed' : 'Unconfirmed';
        const updates = stat._id.courseUpdates === false ? 'Opted Out' : 'Opted In';
        console.log(`${confirmed} + ${updates}: ${stat.count} users`);
        
        if (stat._id.confirmed && stat._id.courseUpdates !== false) {
            totalWillReceive = stat.count;
        }
    });
    
    console.log(`\n🎯 Total users who WILL receive course notifications: ${totalWillReceive}`);
}

async function enableAllNotifications() {
    console.log('🔧 Enabling notifications for all confirmed users...\n');
    
    const result = await User.updateMany(
        { isConfirmed: true },
        {
            $set: {
                'notificationSettings.email': true,
                'notificationSettings.courseUpdates': true
            }
        }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} users`);
    console.log(`   Matched: ${result.matchedCount}`);
    console.log(`   Modified: ${result.modifiedCount}`);
}

async function createTestUsers() {
    console.log('👥 Creating test users...\n');
    
    const testUsers = [
        {
            email: 'test.user1@example.com',
            firstName: 'Test',
            lastName: 'User One',
            password: 'password123',
            isConfirmed: true,
            notificationSettings: {
                email: true,
                courseUpdates: true
            }
        },
        {
            email: 'test.user2@example.com',
            firstName: 'Test',
            lastName: 'User Two',
            password: 'password123',
            isConfirmed: true,
            notificationSettings: {
                email: true,
                courseUpdates: true
            }
        },
        {
            email: 'test.user3@example.com',
            firstName: 'Test',
            lastName: 'User Three',
            password: 'password123',
            isConfirmed: true,
            notificationSettings: {
                email: true,
                courseUpdates: false // This one opted out
            }
        }
    ];
    
    for (const userData of testUsers) {
        try {
            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                console.log(`⚠️  User already exists: ${userData.email}`);
                // Update their notification settings
                existingUser.isConfirmed = true;
                existingUser.notificationSettings = userData.notificationSettings;
                await existingUser.save();
                console.log(`   ✅ Updated notification settings`);
            } else {
                await User.create(userData);
                console.log(`✅ Created: ${userData.email}`);
            }
        } catch (error) {
            console.error(`❌ Error creating ${userData.email}:`, error.message);
        }
    }
}

async function fixNotificationPreferences() {
    console.log('🔧 Fixing missing notification preferences...\n');
    
    // Find users with missing notificationSettings
    const usersWithoutSettings = await User.find({
        $or: [
            { notificationSettings: { $exists: false } },
            { 'notificationSettings.courseUpdates': { $exists: false } }
        ]
    });
    
    console.log(`Found ${usersWithoutSettings.length} users with missing settings\n`);
    
    for (const user of usersWithoutSettings) {
        console.log(`Fixing: ${user.email}`);
        
        // Initialize notificationSettings if it doesn't exist
        if (!user.notificationSettings) {
            user.notificationSettings = {};
        }
        
        // Set default values
        if (user.notificationSettings.email === undefined) {
            user.notificationSettings.email = true;
        }
        if (user.notificationSettings.courseUpdates === undefined) {
            user.notificationSettings.courseUpdates = true;
        }
        
        await user.save();
        console.log(`✅ Fixed notification settings`);
    }
    
    console.log('\n✅ All users now have proper notification settings');
}

async function findUserByEmail(email) {
    if (!email) {
        console.log('❌ Please provide an email address');
        return;
    }
    
    console.log(`🔍 Finding user: ${email}\n`);
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
        console.log('❌ User not found');
        return;
    }
    
    console.log('User Details:');
    console.log('-------------');
    console.log(`Name: ${user.firstName} ${user.lastName}`);
    console.log(`Email: ${user.email}`);
    console.log(`Confirmed: ${user.isConfirmed ? '✅ Yes' : '❌ No'}`);
    console.log(`Role: ${user.role}`);
    console.log(`Created: ${user.createdAt}`);
    
    console.log('\nNotification Settings:');
    console.log(`Email Notifications: ${user.notificationSettings?.email !== false ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Course Updates: ${user.notificationSettings?.courseUpdates !== false ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Promotions: ${user.notificationSettings?.promotions ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Reminders: ${user.notificationSettings?.reminders !== false ? '✅ Enabled' : '❌ Disabled'}`);
    
    const willReceiveNotifications = user.isConfirmed && user.notificationSettings?.courseUpdates !== false;
    console.log(`\n${willReceiveNotifications ? '✅ WILL' : '❌ WILL NOT'} receive course notifications`);
    
    if (!willReceiveNotifications) {
        if (!user.isConfirmed) {
            console.log('Reason: Email not confirmed');
        } else {
            console.log('Reason: Opted out of course updates');
        }
    }
}

// Run the tool
if (require.main === module) {
    manageNotifications();
}