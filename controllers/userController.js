// controllers/userController.js
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const passport = require('passport');
const nodemailer = require('nodemailer');
const axios = require('axios');

// -------------------- REGISTER/SIGNUP USER --------------------
exports.registerUser = async (req, res) => {
  console.log('📝 Signup route hit!');
  console.log('📥 Request body:', req.body);

  // Verify reCAPTCHA first
  const recaptchaResponse = req.body['g-recaptcha-response'];
  
  if (!recaptchaResponse) {
    console.log('❌ No reCAPTCHA response provided');
    req.flash('error_message', 'Please complete the reCAPTCHA verification');
    req.flash('formData', JSON.stringify(req.body));
    return res.redirect('/signup');
  }

  const isHuman = await verifyRecaptcha(recaptchaResponse);
  
  if (!isHuman) {
    console.log('❌ reCAPTCHA verification failed');
    req.flash('error_message', 'reCAPTCHA verification failed. Please try again.');
    req.flash('formData', JSON.stringify(req.body));
    return res.redirect('/signup');
  }

  console.log('✅ reCAPTCHA verified successfully');

  const { firstName, lastName, email, password, phoneNumber, profession, country, role, experience, expertise, cv } = req.body;

  // Validation: Ensure required fields are filled
  if (!firstName || !lastName || !email || !password) {
    console.log('❌ Validation failed: Missing required fields');
    req.flash('error_message', 'First name, last name, email, and password are required.');
    req.flash('formData', JSON.stringify(req.body)); // Preserve form data
    return res.redirect('/signup');
  }

  try {
    console.log('🔍 Checking for existing user with email:', email);
    
    // Check if user already exists (now using flat structure)
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      console.log('❌ User already exists');
      console.log('🔄 Setting flash message and redirecting...');
      req.flash('error_message', 'Email already registered. Please use a different email or login if you already have an account.');
      req.flash('formData', JSON.stringify(req.body)); // Preserve form data
      console.log('💾 Flash message set (not consuming it for debug)');
      return res.redirect('/signup');
    }

    console.log('🔐 Hashing password...');
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('👤 Creating user data object...');
    // Create user object with flat structure
    const userData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNumber: phoneNumber || '',
      profession: profession || '',
      country: country || '',
      isConfirmed: false,
      role: role || 'user',
      myInPersonCourses: [],
      myLiveCourses: [],
      mySelfPacedCourses: []
    };

    // If user is registering as instructor, add instructor-specific fields
    if (role === 'instructor') {
      console.log('👨‍🏫 Adding instructor fields...');
      userData.myTrainingInstruction = {
        experience: experience || '',
        expertise: expertise || '',
        cv: cv || '', // Handle file upload separately if needed
        appliedForCourses: [],
        allocatedCourses: []
      };
    }

    console.log('💾 Saving user to database...');
    const newUser = new User(userData);
    await newUser.save();

    console.log('✅ User saved successfully! ID:', newUser._id);

    // -------------------- EMAIL NOTIFICATION --------------------
    try {
      // Configure nodemailer (FIXED: use createTransport, not createTransporter)
      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'm.minepour@gmail.com',
          pass: process.env.EMAIL_PASS || '38313831Minemn'
        }
      });

      let mailOptions = {
        from: process.env.EMAIL_USER || 'm.minepour@gmail.com',
        to: process.env.ADMIN_EMAIL || 'admin-email@example.com',
        subject: 'New User Signup',
        html: `
          <h3>New User Registration</h3>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Role:</strong> ${role}</p>
          <p><strong>Profession:</strong> ${profession}</p>
          <p><strong>Country:</strong> ${country}</p>
          ${role === 'instructor' ? `
            <p><strong>Experience:</strong> ${experience}</p>
            <p><strong>Expertise:</strong> ${expertise}</p>
          ` : ''}
          <p>Please review and confirm this account.</p>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('📧 Email notification sent successfully');
    } catch (emailError) {
      console.log('📧 Error sending email:', emailError);
      // Don't fail the registration if email fails
    }

    // Flash success message and redirect
    console.log('🎉 Setting success flash message...');
    req.flash('success_message', 'Your request for creating an account has been received. We will review and get back to you.');
    console.log('✅ Success message set, redirecting to /signup...');
    res.redirect('/signup');

  } catch (err) {
    console.error('💥 Error registering user:', err);
    
    // Check if it's a MongoDB duplicate key error
    if (err.code === 11000) {
      req.flash('error_message', 'Email already registered. Please use a different email.');
      req.flash('formData', JSON.stringify(req.body)); // Preserve form data
    } else {
      req.flash('error_message', 'Something went wrong while creating your account. Please try again.');
      req.flash('formData', JSON.stringify(req.body)); // Preserve form data
    }
    
    res.redirect('/signup');
  }
};

// Alternative method name for backward compatibility
exports.signupUser = exports.registerUser;

// -------------------- CONFIRM USER ACCOUNT --------------------
exports.confirmUser = async (req, res) => {
  const { email } = req.params;

  try {
    console.log('🔍 Looking for user to confirm:', email);
    
    // Now using flat structure
    const user = await User.findOne({ email: email });

    if (!user) {
      console.log('❌ User not found for confirmation');
      return res.status(404).send('User not found');
    }

    if (user.isConfirmed) {
      console.log('⚠️ Account already confirmed');
      return res.send('Account already confirmed');
    }

    user.isConfirmed = true;
    await user.save();

    console.log('✅ Account confirmed successfully');

    // Optional: Send confirmation email to user
    try {
      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER || 'm.minepour@gmail.com',
          pass: process.env.EMAIL_PASS || '38313831Minemn'
        }
      });

      let mailOptions = {
        from: process.env.EMAIL_USER || 'm.minepour@gmail.com',
        to: email,
        subject: 'Account Confirmed - IAAI Training',
        html: `
          <h3>Welcome to IAAI Training!</h3>
          <p>Hi ${user.firstName},</p>
          <p>Your account has been confirmed and you can now log in to access our platform.</p>
          <p><a href="${process.env.SITE_URL || 'http://localhost:3000'}/login">Login here</a></p>
          <p>Thank you for joining us!</p>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('📧 Confirmation email sent to user');
    } catch (emailError) {
      console.log('📧 Error sending confirmation email:', emailError);
    }

    res.send(`
      <h2>Account confirmed successfully!</h2>
      <p>The user ${email} can now log in to the platform.</p>
      <p><a href="/admin/users">Back to User Management</a></p>
    `);
  } catch (err) {
    console.error('💥 Error confirming user:', err);
    res.status(500).send('Error confirming account');
  }
};

// -------------------- LOGIN FUNCTIONALITY --------------------
exports.loginUser = (req, res, next) => {
  console.log('🔐 Login attempt for:', req.body.email);
  
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.log('💥 Login error:', err);
      return next(err);
    }
    
    if (!user) {
      console.log('❌ Login failed: Invalid credentials');
      req.flash('error_message', 'Invalid email or password.');
      return res.redirect('/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        console.log('💥 Session error:', err);
        return next(err);
      }
      
      // Now using flat structure
      if (!user.isConfirmed) {
        console.log('⚠️ Login blocked: Account not confirmed');
        req.flash('error_message', 'Account not confirmed yet. Please contact support.');
        return res.redirect('/login');
      }
      
      console.log('✅ Login successful for:', user.email);
      res.redirect('/dashboard');
    });
  })(req, res, next);
};

// -------------------- GET USER PROFILE --------------------
exports.getUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/login');
    }
    
    res.render('profile', { user: user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    req.flash('error_message', 'Error loading profile.');
    res.redirect('/dashboard');
  }
};

// -------------------- UPDATE USER PROFILE --------------------
exports.updateUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login');
    }

    const { firstName, lastName, phoneNumber, profession, country } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/login');
    }

    // Update user profile (now using flat structure)
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.profession = profession || user.profession;
    user.country = country || user.country;

    await user.save();

    req.flash('success_message', 'Profile updated successfully.');
    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating user profile:', err);
    req.flash('error_message', 'Error updating profile.');
    res.redirect('/profile');
  }
};

// Add this function
async function verifyRecaptcha(recaptchaResponse) {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;
    
    const response = await axios.post(verifyUrl);
    return response.data.success;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}