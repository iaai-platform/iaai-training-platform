// test/simpleEmailTest.js
/**
 * Simple Direct Email Test
 * Run this first to ensure basic email functionality works
 */

require('dotenv').config();

async function testEmail() {
    console.log('\n🔧 Simple Email Test\n');
    
    // Display configuration
    console.log('Configuration:');
    console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'Not set ❌');
    console.log('EMAIL_USER:', process.env.EMAIL_USER || 'Not set ❌');
    console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set (hidden)' : 'Not set ❌');
    console.log('');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email configuration missing!');
        console.error('Please set EMAIL_USER and EMAIL_PASS in your .env file');
        return;
    }
    
    try {
        // Direct nodemailer test
        const nodemailer = require('nodemailer');
        
        console.log('Creating transporter...');
        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('✅ Connection verified!');
        
        const testEmail = process.argv[2] || process.env.EMAIL_USER;
        console.log(`\nSending test email to: ${testEmail}`);
        
        const info = await transporter.sendMail({
            from: `"IAAI Test" <${process.env.EMAIL_USER}>`,
            to: testEmail,
            subject: 'Test Email - ' + new Date().toLocaleTimeString(),
            text: 'This is a test email from IAAI Training System',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h1 style="color: #10b981; text-align: center;">✅ Email Test Successful!</h1>
                        <p style="font-size: 16px; color: #333;">This is a test email from your IAAI Training System.</p>
                        <p style="font-size: 14px; color: #666;">If you can see this message, your email configuration is working correctly!</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #999;">Sent at: ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            `
        });
        
        console.log('\n✅ SUCCESS! Email sent!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log(`\n📧 Check your inbox at: ${testEmail}`);
        
    } catch (error) {
        console.error('\n❌ EMAIL FAILED!');
        console.error('Error:', error.message);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔐 Authentication Error - Fix:');
            console.error('1. Go to: https://myaccount.google.com/security');
            console.error('2. Enable 2-Step Verification');
            console.error('3. Go to: https://myaccount.google.com/apppasswords');
            console.error('4. Generate an app password for "Mail"');
            console.error('5. Use that 16-character password in EMAIL_PASS');
            console.error('\nDO NOT use your regular Gmail password!');
        } else if (error.code === 'ESOCKET') {
            console.error('\n🌐 Network Error - Check:');
            console.error('- Internet connection');
            console.error('- Firewall settings');
            console.error('- VPN (try disabling)');
        }
    }
}

// Run test
testEmail();