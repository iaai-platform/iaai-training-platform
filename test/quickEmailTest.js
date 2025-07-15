// test/quickEmailTest.js
/**
 * Quick Email Test - Run this to quickly test if emails are working
 */

require('dotenv').config();

const sendEmail = require('../utils/sendEmail');

async function quickTest() {
    console.log('\n🚀 Quick Email Test\n');
    console.log('Testing email configuration...');
    console.log('Email Service:', process.env.EMAIL_SERVICE || 'Not set');
    console.log('Email User:', process.env.EMAIL_USER || 'Not set');
    console.log('Email Pass:', process.env.EMAIL_PASS ? '****** (set)' : 'Not set');
    
    const testEmail = process.argv[2] || process.env.EMAIL_USER;
    console.log('Sending test email to:', testEmail);
    
    try {
        const result = await sendEmail({
            to: testEmail,
            subject: `IAAI Email Test - ${new Date().toLocaleTimeString()}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 30px; border-radius: 10px; }
                        .header { background: #2563eb; color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px; }
                        .success { background: #10b981; color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .info { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
                        code { background: #e5e7eb; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>✅ Email Test Successful!</h1>
                        </div>
                        
                        <div class="success">
                            <h2>Your email system is working correctly!</h2>
                        </div>
                        
                        <div class="info">
                            <h3>Test Details:</h3>
                            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>Email Service:</strong> ${process.env.EMAIL_SERVICE || 'gmail'}</p>
                            <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
                            <p><strong>To:</strong> ${testEmail}</p>
                        </div>
                        
                        <div class="info">
                            <h3>Next Steps:</h3>
                            <ol>
                                <li>✅ Basic email functionality confirmed</li>
                                <li>📧 You can now test course notifications</li>
                                <li>🚀 Your notification system is ready to use</li>
                            </ol>
                        </div>
                        
                        <p style="text-align: center; color: #666; margin-top: 30px;">
                            This is an automated test email from IAAI Training System
                        </p>
                    </div>
                </body>
                </html>
            `
        });
        
        console.log('\n✅ SUCCESS! Email sent successfully!');
        console.log('Message ID:', result.messageId);
        console.log('\nPlease check your inbox at:', testEmail);
        
    } catch (error) {
        console.error('\n❌ ERROR! Email failed to send');
        console.error('Error:', error.message);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔐 Authentication Error - Common fixes:');
            console.error('1. For Gmail: Enable 2-factor authentication');
            console.error('2. Generate an app password: https://myaccount.google.com/apppasswords');
            console.error('3. Use the app password in EMAIL_PASS, not your regular password');
            console.error('4. Make sure "Less secure app access" is handled via app passwords');
        }
        
        console.error('\n📋 Checklist:');
        console.error('- [ ] EMAIL_SERVICE is set in .env (e.g., "gmail")');
        console.error('- [ ] EMAIL_USER is set in .env (your full email address)');
        console.error('- [ ] EMAIL_PASS is set in .env (app password, not regular password)');
        console.error('- [ ] Internet connection is working');
        console.error('- [ ] Firewall is not blocking outgoing SMTP');
    }
}

// Run the test
quickTest();