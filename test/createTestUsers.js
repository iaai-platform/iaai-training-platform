// test/createTestUsers.js
/**
 * Create test users for notification testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

async function createTestUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iaai-training');
        console.log('✅ Connected to database\n');

        // Check current user count
        const existingCount = await User.countDocuments();
        console.log(`📊 Current users in database: ${existingCount}\n`);

        // Define test users - CHANGE THESE EMAILS TO YOUR TEST EMAILS
        const testUsers = [
            {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@test.com', // Change to your test email
                password: 'Test123!',
                phoneNumber: '+1234567890',
                profession: 'Aesthetic Practitioner',
                country: 'USA',
                isConfirmed: true, // Already confirmed for testing
                role: 'user',
                notificationSettings: {
                    email: true,
                    courseUpdates: true, // Will receive notifications
                    promotions: false,
                    reminders: true
                }
            },
            {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@test.com', // Change to your test email
                password: 'Test123!',
                phoneNumber: '+1234567891',
                profession: 'Dermatologist',
                country: 'Canada',
                isConfirmed: true,
                role: 'user',
                notificationSettings: {
                    email: true,
                    courseUpdates: true, // Will receive notifications
                    promotions: true,
                    reminders: true
                }
            },
            {
                firstName: 'Robert',
                lastName: 'Johnson',
                email: 'robert.johnson@test.com', // Change to your test email
                password: 'Test123!',
                phoneNumber: '+1234567892',
                profession: 'Nurse Practitioner',
                country: 'UK',
                isConfirmed: true,
                role: 'user',
                notificationSettings: {
                    email: true,
                    courseUpdates: false, // Opted out - won't receive
                    promotions: false,
                    reminders: true
                }
            },
            {
                firstName: 'Emily',
                lastName: 'Wilson',
                email: 'emily.wilson@test.com', // Change to your test email
                password: 'Test123!',
                phoneNumber: '+1234567893',
                profession: 'Plastic Surgeon',
                country: 'Australia',
                isConfirmed: false, // Not confirmed - won't receive
                role: 'user',
                notificationSettings: {
                    email: true,
                    courseUpdates: true,
                    promotions: true,
                    reminders: true
                }
            },
            {
                firstName: 'Admin',
                lastName: 'User',
                email: process.env.EMAIL_USER || 'admin@test.com', // Uses your env email
                password: 'Admin123!',
                phoneNumber: '+1234567894',
                profession: 'Administrator',
                country: 'USA',
                isConfirmed: true,
                role: 'admin',
                notificationSettings: {
                    email: true,
                    courseUpdates: true, // Admin will receive notifications
                    promotions: true,
                    reminders: true
                }
            }
        ];

        console.log('🚀 Creating test users...\n');

        for (const userData of testUsers) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({ email: userData.email });
                
                if (existingUser) {
                    console.log(`⚠️  User already exists: ${userData.email}`);
                    // Update their settings
                    existingUser.isConfirmed = userData.isConfirmed;
                    existingUser.notificationSettings = userData.notificationSettings;
                    await existingUser.save();
                    console.log(`   ✅ Updated settings`);
                } else {
                    // Hash password
                    const hashedPassword = await bcrypt.hash(userData.password, 10);
                    userData.password = hashedPassword;
                    
                    // Create user
                    const newUser = await User.create(userData);
                    console.log(`✅ Created: ${userData.email}`);
                    console.log(`   Name: ${userData.firstName} ${userData.lastName}`);
                    console.log(`   Confirmed: ${userData.isConfirmed ? 'Yes' : 'No'}`);
                    console.log(`   Notifications: ${userData.notificationSettings.courseUpdates ? 'Enabled' : 'Disabled'}`);
                    console.log(`   Will receive emails: ${userData.isConfirmed && userData.notificationSettings.courseUpdates ? '✅ YES' : '❌ NO'}`);
                }
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error with ${userData.email}:`, error.message);
            }
        }

        // Show summary
        console.log('\n📊 Summary after creation:');
        const totalUsers = await User.countDocuments();
        const confirmedUsers = await User.countDocuments({ isConfirmed: true });
        const notificationUsers = await User.countDocuments({
            isConfirmed: true,
            'notificationSettings.courseUpdates': { $ne: false }
        });

        console.log(`Total users: ${totalUsers}`);
        console.log(`Confirmed users: ${confirmedUsers}`);
        console.log(`Users who will receive notifications: ${notificationUsers}`);

        // List users who will receive notifications
        console.log('\n✅ These users WILL receive course notifications:');
        const eligibleUsers = await User.find({
            isConfirmed: true,
            'notificationSettings.courseUpdates': { $ne: false }
        }).select('email firstName lastName');

        eligibleUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
        });

        // List users who won't receive notifications
        console.log('\n❌ These users WON\'T receive notifications:');
        const ineligibleUsers = await User.find({
            $or: [
                { isConfirmed: false },
                { 'notificationSettings.courseUpdates': false }
            ]
        }).select('email firstName lastName isConfirmed notificationSettings.courseUpdates');

        ineligibleUsers.forEach((user, index) => {
            const reason = !user.isConfirmed ? 'Not confirmed' : 'Opted out';
            console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName} (${reason})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

// Also fix the duplicate index warnings
async function fixIndexWarnings() {
    console.log('\n🔧 Fixing duplicate index warnings...\n');
    
    try {
        const db = mongoose.connection.db;
        
        // Drop the duplicate indexes
        const collections = ['users'];
        
        for (const collectionName of collections) {
            const collection = db.collection(collectionName);
            const indexes = await collection.indexes();
            
            console.log(`Indexes on ${collectionName}:`, indexes.map(idx => idx.name));
            
            // You can drop specific duplicate indexes if needed
            // await collection.dropIndex('indexName');
        }
        
        console.log('ℹ️  To fix the warnings, remove duplicate index definitions from your User model');
        console.log('   Either remove { unique: true } from the schema field definitions');
        console.log('   OR remove the userSchema.index() calls at the bottom');
        
    } catch (error) {
        console.error('Error checking indexes:', error);
    }
}

// Run the script
if (require.main === module) {
    console.log('====================================');
    console.log('Test User Creation Script');
    console.log('====================================\n');
    
    console.log('⚠️  IMPORTANT: Edit this file to use your actual test email addresses!\n');
    console.log('This script will create 5 test users:');
    console.log('- 2 confirmed users with notifications enabled (will receive emails)');
    console.log('- 1 confirmed user who opted out (won\'t receive emails)');
    console.log('- 1 unconfirmed user (won\'t receive emails)');
    console.log('- 1 admin user\n');
    
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    readline.question('Do you want to proceed? (y/n): ', (answer) => {
        readline.close();
        
        if (answer.toLowerCase() === 'y') {
            createTestUsers();
        } else {
            console.log('Cancelled');
            process.exit(0);
        }
    });
}