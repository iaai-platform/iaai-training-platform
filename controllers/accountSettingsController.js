// controllers/accountSettingsController.js
const User = require('../models/user');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy'); // For 2FA (npm install speakeasy)
const QRCode = require('qrcode'); // For 2FA QR codes (npm install qrcode)

// ✅ 1. SECURITY SETTINGS
exports.getSecurityPage = async (req, res) => {
  try {
    console.log('🔒 Loading security settings page...');
    const user = await User.findById(req.user._id).lean();
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Get recent login activity (you'll need to implement this)
    const recentActivity = []; // Placeholder for now

    res.render('account/security', { 
      user,
      recentActivity,
      title: 'Security Settings'
    });
  } catch (err) {
    console.error('❌ Error loading security page:', err);
    res.status(500).send('Server error');
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

    console.log('✅ Password updated for user:', user.email);
    res.json({ success: true, message: '✅ Password updated successfully!' });
  } catch (err) {
    console.error('❌ Error updating password:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.toggle2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user.twoFactorAuth) {
      // Enable 2FA
      const secret = speakeasy.generateSecret({
        name: `IAAI (${user.email})`,
        issuer: 'IAAI Training'
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      await User.findByIdAndUpdate(req.user._id, {
        'twoFactorAuth.secret': secret.base32,
        'twoFactorAuth.enabled': false // Will be enabled after verification
      });

      res.json({ 
        success: true, 
        message: 'Scan the QR code with your authenticator app',
        qrCode: qrCodeUrl,
        secret: secret.base32
      });
    } else {
      // Disable 2FA
      await User.findByIdAndUpdate(req.user._id, {
        $unset: { twoFactorAuth: 1 }
      });

      res.json({ success: true, message: '✅ Two-factor authentication disabled' });
    }
  } catch (err) {
    console.error('❌ Error toggling 2FA:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getLoginActivity = async (req, res) => {
  try {
    // Placeholder - you'll need to implement login activity tracking
    const activity = [
      {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        loginTime: new Date(),
        location: 'Unknown' // You can use IP geolocation services
      }
    ];

    res.json({ success: true, activity });
  } catch (err) {
    console.error('❌ Error fetching login activity:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 2. NOTIFICATION SETTINGS
exports.getNotificationsPage = async (req, res) => {
  try {
    console.log('🔔 Loading notifications settings page...');
    const user = await User.findById(req.user._id).lean();
    
    res.render('account/notifications', { 
      user,
      title: 'Notification Settings'
    });
  } catch (err) {
    console.error('❌ Error loading notifications page:', err);
    res.status(500).send('Server error');
  }
};

exports.updateNotifications = async (req, res) => {
  try {
    const {
      emailNotifications,
      courseUpdates,
      promotions,
      reminders,
      digest
    } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      'notificationSettings.email': emailNotifications === 'on',
      'notificationSettings.courseUpdates': courseUpdates === 'on',
      'notificationSettings.promotions': promotions === 'on',
      'notificationSettings.reminders': reminders === 'on',
      'notificationSettings.digest': digest || 'weekly'
    });

    console.log('✅ Notification settings updated for user:', req.user.email);
    res.json({ success: true, message: '✅ Notification settings updated!' });
  } catch (err) {
    console.error('❌ Error updating notifications:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 3. PRIVACY SETTINGS
exports.getPrivacyPage = async (req, res) => {
  try {
    console.log('🔐 Loading privacy settings page...');
    const user = await User.findById(req.user._id).lean();
    
    res.render('account/privacy', { 
      user,
      title: 'Privacy Settings'
    });
  } catch (err) {
    console.error('❌ Error loading privacy page:', err);
    res.status(500).send('Server error');
  }
};

exports.updatePrivacy = async (req, res) => {
  try {
    const {
      profileVisibility,
      showProgress,
      allowMessages,
      dataSharing
    } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      'privacySettings.profileVisibility': profileVisibility || 'private',
      'privacySettings.showProgress': showProgress === 'on',
      'privacySettings.allowMessages': allowMessages === 'on',
      'privacySettings.dataSharing': dataSharing === 'on'
    });

    console.log('✅ Privacy settings updated for user:', req.user.email);
    res.json({ success: true, message: '✅ Privacy settings updated!' });
  } catch (err) {
    console.error('❌ Error updating privacy:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.requestAccountDeletion = async (req, res) => {
  try {
    // In a real app, you'd queue this for review rather than immediate deletion
    await User.findByIdAndUpdate(req.user._id, {
      'accountStatus.deletionRequested': true,
      'accountStatus.deletionRequestDate': new Date()
    });

    console.log('🗑️ Account deletion requested for user:', req.user.email);
    res.json({ 
      success: true, 
      message: '✅ Account deletion request submitted. You will receive an email with next steps.' 
    });
  } catch (err) {
    console.error('❌ Error requesting account deletion:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 4. BILLING SETTINGS
// Replace getBillingPage method:
exports.getBillingPage = async (req, res) => {
  try {
    console.log('💳 Loading billing settings page...');
    const user = await User.findById(req.user._id).lean();
    
    // Get payment transactions
    const transactions = user.paymentTransactions || [];
    
    // Sort by date, newest first
    const sortedTransactions = transactions.sort((a, b) => 
      new Date(b.transactionDate) - new Date(a.transactionDate)
    );
    
    // Calculate totals
    const totalSpent = transactions
      .filter(t => t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.finalAmount, 0);
    
    const totalCourses = transactions
      .filter(t => t.paymentStatus === 'completed')
      .reduce((sum, t) => sum + t.coursesRegistered.length, 0);
    
    res.render('account/billing', { 
      user,
      transactions: sortedTransactions,
      totalSpent,
      totalCourses,
      title: 'Billing & Receipts'
    });
  } catch (err) {
    console.error('❌ Error loading billing page:', err);
    res.status(500).send('Server error');
  }
};

// Add method to get transaction details:
exports.getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const user = await User.findById(req.user._id).lean();
    
    const transaction = user.paymentTransactions.find(
      t => t.transactionId === transactionId
    );
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction not found' 
      });
    }
    
    res.json({ success: true, transaction });
  } catch (err) {
    console.error('❌ Error fetching transaction:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Add method to download receipt:
exports.downloadReceipt = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const user = await User.findById(req.user._id).lean();
    
    const transaction = user.paymentTransactions.find(
      t => t.transactionId === transactionId
    );
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Receipt not found' 
      });
    }
    
    // Generate receipt HTML
    const receiptHtml = generateReceiptHTML(user, transaction);
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 
      `attachment; filename="IAAI-Receipt-${transaction.receiptNumber}.html"`
    );
    res.send(receiptHtml);
    
  } catch (err) {
    console.error('❌ Error downloading receipt:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Helper function to generate receipt HTML
function generateReceiptHTML(user, transaction) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px; 
          color: #333;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px;
          border-bottom: 2px solid #007bff;
          padding-bottom: 20px;
        }
        .logo { 
          font-size: 24px; 
          font-weight: bold; 
          color: #007bff;
        }
        .receipt-title { 
          font-size: 20px; 
          margin-top: 10px;
        }
        .receipt-info { 
          background: #f8f9fa; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 20px; 
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 10px;
        }
        .courses-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
        }
        .courses-table th, .courses-table td { 
          padding: 12px; 
          text-align: left; 
          border-bottom: 1px solid #ddd; 
        }
        .courses-table th { 
          background: #f8f9fa; 
          font-weight: 600;
        }
        .totals { 
          margin-top: 20px; 
          text-align: right;
        }
        .total-row { 
          display: flex; 
          justify-content: flex-end; 
          margin-bottom: 10px;
        }
        .total-label { 
          margin-right: 20px; 
          font-weight: 600;
        }
        .final-total { 
          font-size: 1.2em; 
          color: #28a745; 
          border-top: 2px solid #ddd; 
          padding-top: 10px;
        }
        .footer { 
          text-align: center; 
          margin-top: 40px; 
          color: #666; 
          font-size: 14px;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">IAAI Training Institute</div>
        <div class="receipt-title">Payment Receipt</div>
      </div>
      
      <div class="receipt-info">
        <div class="info-row">
          <span><strong>Receipt Number:</strong></span>
          <span>${transaction.receiptNumber}</span>
        </div>
        <div class="info-row">
          <span><strong>Transaction ID:</strong></span>
          <span>${transaction.transactionId}</span>
        </div>
        <div class="info-row">
          <span><strong>Date:</strong></span>
          <span>${new Date(transaction.transactionDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        <div class="info-row">
          <span><strong>Student Name:</strong></span>
          <span>${user.firstName} ${user.lastName}</span>
        </div>
        <div class="info-row">
          <span><strong>Email:</strong></span>
          <span>${user.email}</span>
        </div>
        <div class="info-row">
          <span><strong>Payment Method:</strong></span>
          <span>${transaction.paymentMethod}</span>
        </div>
        ${transaction.promoCode?.code ? `
        <div class="info-row">
          <span><strong>Promo Code:</strong></span>
          <span>${transaction.promoCode.code} (${transaction.promoCode.discountPercentage}% off)</span>
        </div>
        ` : ''}
      </div>
      
      <h3>Course Details:</h3>
      <table class="courses-table">
        <thead>
          <tr>
            <th>Course Code</th>
            <th>Course Title</th>
            <th>Type</th>
            <th>Original Price</th>
            <th>Paid Price</th>
          </tr>
        </thead>
        <tbody>
          ${transaction.coursesRegistered.map(course => `
            <tr>
              <td>${course.courseCode}</td>
              <td>${course.courseTitle}</td>
              <td>${course.courseType}</td>
              <td>$${course.originalPrice.toFixed(2)}</td>
              <td>$${course.paidPrice.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="total-row">
          <span class="total-label">Subtotal:</span>
          <span>$${transaction.subtotal.toFixed(2)}</span>
        </div>
        ${transaction.discountAmount > 0 ? `
        <div class="total-row">
          <span class="total-label">Discount:</span>
          <span>-$${transaction.discountAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row final-total">
          <span class="total-label">Total Paid:</span>
          <span>$${transaction.finalAmount.toFixed(2)} ${transaction.currency}</span>
        </div>
      </div>
      
      <div class="footer">
        <p>Thank you for choosing IAAI Training Institute!</p>
        <p>This is a computer-generated receipt and does not require a signature.</p>
        <p>For questions about this transaction, please contact support@iaai-training.com</p>
      </div>
    </body>
    </html>
  `;
}

exports.addPaymentMethod = async (req, res) => {
  try {
    // Placeholder - integrate with Stripe/PayPal
    res.json({ success: true, message: '✅ Payment method added successfully!' });
  } catch (err) {
    console.error('❌ Error adding payment method:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removePaymentMethod = async (req, res) => {
  try {
    // Placeholder - integrate with payment processor
    res.json({ success: true, message: '✅ Payment method removed successfully!' });
  } catch (err) {
    console.error('❌ Error removing payment method:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getBillingHistory = async (req, res) => {
  try {
    // Placeholder - fetch from payment processor
    const history = [];
    res.json({ success: true, history });
  } catch (err) {
    console.error('❌ Error fetching billing history:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 5. LEARNING PREFERENCES
exports.getPreferencesPage = async (req, res) => {
  try {
    console.log('🎓 Loading learning preferences page...');
    const user = await User.findById(req.user._id).lean();
    
    res.render('account/preferences', { 
      user,
      title: 'Learning Preferences'
    });
  } catch (err) {
    console.error('❌ Error loading preferences page:', err);
    res.status(500).send('Server error');
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const {
      learningPace,
      videoQuality,
      subtitles,
      autoPlay,
      studyReminders,
      preferredLanguage
    } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      'learningPreferences.pace': learningPace || 'normal',
      'learningPreferences.videoQuality': videoQuality || 'auto',
      'learningPreferences.subtitles': subtitles === 'on',
      'learningPreferences.autoPlay': autoPlay === 'on',
      'learningPreferences.studyReminders': studyReminders === 'on',
      'learningPreferences.language': preferredLanguage || 'en'
    });

    console.log('✅ Learning preferences updated for user:', req.user.email);
    res.json({ success: true, message: '✅ Learning preferences updated!' });
  } catch (err) {
    console.error('❌ Error updating preferences:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 6. PROFESSIONAL PROFILE
exports.getProfessionalPage = async (req, res) => {
  try {
    console.log('👔 Loading professional profile page...');
    const user = await User.findById(req.user._id).lean();
    
    res.render('account/professional', { 
      user,
      title: 'Professional Profile'
    });
  } catch (err) {
    console.error('❌ Error loading professional page:', err);
    res.status(500).send('Server error');
  }
};

exports.updateProfessional = async (req, res) => {
  try {
    const {
      clinicName,
      licenseNumber,
      specializations,
      yearsExperience,
      bio,
      website,
      linkedIn
    } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      'professionalProfile.clinicName': clinicName,
      'professionalProfile.licenseNumber': licenseNumber,
      'professionalProfile.specializations': specializations ? specializations.split(',').map(s => s.trim()) : [],
      'professionalProfile.yearsExperience': parseInt(yearsExperience) || 0,
      'professionalProfile.bio': bio,
      'professionalProfile.website': website,
      'professionalProfile.linkedIn': linkedIn
    });

    console.log('✅ Professional profile updated for user:', req.user.email);
    res.json({ success: true, message: '✅ Professional profile updated!' });
  } catch (err) {
    console.error('❌ Error updating professional profile:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Add these methods to your existing accountSettingsController.js

// ✅ Additional Billing Methods
exports.updateBillingAddress = async (req, res) => {
    try {
      const { street, city, state, zipCode, country } = req.body;
  
      await User.findByIdAndUpdate(req.user._id, {
        'billingInfo.billingAddress.street': street,
        'billingInfo.billingAddress.city': city,
        'billingInfo.billingAddress.state': state,
        'billingInfo.billingAddress.zipCode': zipCode,
        'billingInfo.billingAddress.country': country
      });
  
      console.log('✅ Billing address updated for user:', req.user.email);
      res.json({ success: true, message: '✅ Billing address updated successfully!' });
    } catch (err) {
      console.error('❌ Error updating billing address:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  exports.getPaymentMethods = async (req, res) => {
    try {
      const user = await User.findById(req.user._id).lean();
      const paymentMethods = user.billingInfo?.paymentMethods || [];
  
      res.json({ success: true, paymentMethods });
    } catch (err) {
      console.error('❌ Error fetching payment methods:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  // ✅ Additional Learning Preferences Methods
  exports.updateLearningPreferences = async (req, res) => {
    try {
      const {
        learningPace,
        videoQuality,
        subtitles,
        autoPlay,
        studyReminders,
        preferredLanguage,
        reminderFrequency,
        textSize,
        highContrast,
        reduceMotion,
        categories
      } = req.body;
  
      await User.findByIdAndUpdate(req.user._id, {
        'learningPreferences.pace': learningPace || 'normal',
        'learningPreferences.videoQuality': videoQuality || 'auto',
        'learningPreferences.subtitles': subtitles === 'on',
        'learningPreferences.autoPlay': autoPlay === 'on',
        'learningPreferences.studyReminders': studyReminders === 'on',
        'learningPreferences.language': preferredLanguage || 'en',
        'learningPreferences.reminderFrequency': reminderFrequency || 'every2days',
        'learningPreferences.textSize': parseInt(textSize) || 16,
        'learningPreferences.highContrast': highContrast === 'on',
        'learningPreferences.reduceMotion': reduceMotion === 'on',
        'learningPreferences.categories': categories || []
      });
  
      console.log('✅ Learning preferences updated for user:', req.user.email);
      res.json({ success: true, message: '✅ Learning preferences updated!' });
    } catch (err) {
      console.error('❌ Error updating learning preferences:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  // ✅ Professional Profile Methods
  exports.updateProfessionalProfile = async (req, res) => {
    try {
      const {
        clinicName,
        licenseNumber,
        yearsExperience,
        primaryRole,
        bio,
        specializations,
        website,
        linkedIn,
        instagram,
        otherSocial,
        practiceType,
        staffCount,
        services,
        education,
        certifications,
        careerGoals,
        interests,
        profileVisibility,
        allowNetworking,
        showInDirectory
      } = req.body;
  
      const updateData = {
        'professionalProfile.clinicName': clinicName,
        'professionalProfile.licenseNumber': licenseNumber,
        'professionalProfile.yearsExperience': parseInt(yearsExperience) || 0,
        'professionalProfile.primaryRole': primaryRole,
        'professionalProfile.bio': bio,
        'professionalProfile.specializations': specializations || [],
        'professionalProfile.website': website,
        'professionalProfile.linkedIn': linkedIn,
        'professionalProfile.instagram': instagram,
        'professionalProfile.otherSocial': otherSocial,
        'professionalProfile.practiceType': practiceType,
        'professionalProfile.staffCount': staffCount,
        'professionalProfile.services': services || [],
        'professionalProfile.education': education,
        'professionalProfile.certifications': certifications,
        'professionalProfile.careerGoals': careerGoals,
        'professionalProfile.interests': interests || [],
        'professionalProfile.profileVisibility': profileVisibility || 'iaai_community',
        'professionalProfile.allowNetworking': allowNetworking === 'on',
        'professionalProfile.showInDirectory': showInDirectory === 'on'
      };
  
      await User.findByIdAndUpdate(req.user._id, updateData);
  
      console.log('✅ Professional profile updated for user:', req.user.email);
      res.json({ success: true, message: '✅ Professional profile updated successfully!' });
    } catch (err) {
      console.error('❌ Error updating professional profile:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  exports.requestProfessionalVerification = async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.user._id, {
        'professionalProfile.verificationStatus': 'pending',
        'professionalProfile.verificationRequestDate': new Date()
      });
  
      // Here you would typically send an email to admins or create a verification task
  
      console.log('✅ Professional verification requested by user:', req.user.email);
      res.json({ 
        success: true, 
        message: '✅ Verification request submitted! We will review your credentials within 2-3 business days.' 
      });
    } catch (err) {
      console.error('❌ Error requesting verification:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  // ✅ Privacy Data Download
  exports.downloadUserData = async (req, res) => {
    try {
      const user = await User.findById(req.user._id).lean();
      
      // Remove sensitive fields
      const sanitizedUser = { ...user };
      delete sanitizedUser.password;
      delete sanitizedUser.resetPasswordToken;
      delete sanitizedUser.twoFactorAuth;
  
      // Create downloadable data
      const userData = {
        exportDate: new Date().toISOString(),
        personalInfo: {
          firstName: sanitizedUser.firstName,
          lastName: sanitizedUser.lastName,
          email: sanitizedUser.email,
          phoneNumber: sanitizedUser.phoneNumber,
          profession: sanitizedUser.profession,
          country: sanitizedUser.country
        },
        accountSettings: {
          notificationSettings: sanitizedUser.notificationSettings,
          privacySettings: sanitizedUser.privacySettings,
          learningPreferences: sanitizedUser.learningPreferences
        },
        professionalProfile: sanitizedUser.professionalProfile,
        courseData: {
          inPersonCourses: sanitizedUser.myInPersonCourses,
          liveCourses: sanitizedUser.myLiveCourses,
          selfPacedCourses: sanitizedUser.mySelfPacedCourses
        },
        accountHistory: {
          createdAt: sanitizedUser.createdAt,
          lastLogin: sanitizedUser.accountStatus?.lastLoginAt
        }
      };
  
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="my-iaai-data.json"');
      res.send(JSON.stringify(userData, null, 2));
  
      console.log('✅ User data downloaded by:', req.user.email);
    } catch (err) {
      console.error('❌ Error downloading user data:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  
  // ✅ Send Test Email (for notification settings)
  exports.sendTestEmail = async (req, res) => {
    try {
      // Here you would integrate with your email service (Nodemailer, SendGrid, etc.)
      // For now, we'll just simulate sending an email
      
      console.log(`📧 Test email sent to: ${req.user.email}`);
      
      // Simulate email sending delay
      setTimeout(() => {
        res.json({ 
          success: true, 
          message: '✅ Test email sent successfully! Check your inbox.' 
        });
      }, 1000);
      
    } catch (err) {
      console.error('❌ Error sending test email:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };