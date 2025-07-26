// controllers/userController.js
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const passport = require("passport");
const nodemailer = require("nodemailer");
const axios = require("axios");

// ============================================
// EMAIL CONFIGURATION HELPER
// ============================================
function createEmailTransporter() {
  return nodemailer.createTransport({
    host: "mail.iaa-i.com",
    port: 587,
    secure: false, // false for port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  });
}

// ============================================
// REGISTER/SIGNUP USER
// ============================================
exports.registerUser = async (req, res) => {
  console.log("📝 Signup route hit!");
  console.log("📥 Request body:", req.body);

  const {
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    phoneNumber,
    profession,
    country,
    role,
    experience,
    expertise,
    cv,
  } = req.body;

  // Validation: Ensure required fields are filled
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    console.log("❌ Validation failed: Missing required fields");
    req.flash(
      "error_message",
      "First name, last name, email, password, and password confirmation are required."
    );
    req.flash("formData", JSON.stringify(req.body));
    return res.redirect("/signup");
  }

  // Validation: Check if passwords match
  if (password !== confirmPassword) {
    console.log("❌ Validation failed: Passwords do not match");
    req.flash(
      "error_message",
      "Passwords do not match. Please check your password confirmation."
    );
    req.flash("formData", JSON.stringify(req.body));
    return res.redirect("/signup");
  }

  try {
    console.log("🔍 Checking for existing user with email:", email);

    // Check if user already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      console.log("❌ User already exists");
      req.flash(
        "error_message",
        "Email already registered. Please use a different email or login if you already have an account."
      );
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    console.log("🔐 Hashing password...");
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("👤 Creating user data object...");
    // Create user object with flat structure
    const userData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNumber: phoneNumber || "",
      profession: profession || "",
      country: country || "",
      isConfirmed: false,
      role: role || "user",
      myInPersonCourses: [],
      myLiveCourses: [],
      mySelfPacedCourses: [],
    };

    // If user is registering as instructor, add instructor-specific fields
    if (role === "instructor") {
      console.log("👨‍🏫 Adding instructor fields...");
      userData.myTrainingInstruction = {
        experience: experience || "",
        expertise: expertise || "",
        cv: cv || "",
        appliedForCourses: [],
        allocatedCourses: [],
      };
    }

    console.log("💾 Saving user to database...");
    const newUser = new User(userData);
    await newUser.save();

    console.log("✅ User saved successfully! ID:", newUser._id);

    // ============================================
    // ADMIN EMAIL NOTIFICATION
    // ============================================
    try {
      console.log("📧 Sending admin notification email...");

      // Create email transporter with company email settings
      const transporter = createEmailTransporter();

      // Email content for admin notification
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || "IAAI Training Platform",
          address: process.env.EMAIL_USER,
        },
        to: process.env.CONFIRM_EMAIL,
        subject: `New User Registration - ${
          role === "instructor" ? "Instructor" : "Student"
        } Application`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; }
              .content { padding: 20px 0; }
              .user-info { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .role-badge { 
                display: inline-block; 
                padding: 4px 12px; 
                border-radius: 12px; 
                font-size: 12px; 
                font-weight: bold;
                ${
                  role === "instructor"
                    ? "background-color: #e3f2fd; color: #1976d2;"
                    : "background-color: #f3e5f5; color: #7b1fa2;"
                }
              }
              .action-button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 10px 5px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>🆕 New User Registration</h2>
                <span class="role-badge">${
                  role === "instructor" ? "👨‍🏫 INSTRUCTOR" : "🎓 STUDENT"
                }</span>
              </div>
              
              <div class="content">
                <p>A new user has registered on the IAAI Training Platform and requires your approval.</p>
                
                <div class="user-info">
                  <h3>👤 User Information:</h3>
                  <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Phone:</strong> ${
                    phoneNumber || "Not provided"
                  }</p>
                  <p><strong>Profession:</strong> ${
                    profession || "Not provided"
                  }</p>
                  <p><strong>Country:</strong> ${country || "Not provided"}</p>
                  <p><strong>Role:</strong> ${role}</p>
                  
                  ${
                    role === "instructor"
                      ? `
                    <hr style="margin: 15px 0;">
                    <h4>👨‍🏫 Instructor Details:</h4>
                    <p><strong>Experience:</strong> ${
                      experience || "Not provided"
                    }</p>
                    <p><strong>Expertise:</strong> ${
                      expertise || "Not provided"
                    }</p>
                    <p><strong>CV/Resume:</strong> ${cv || "Not provided"}</p>
                  `
                      : ""
                  }
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${
                    process.env.SITE_URL || "http://localhost:3000"
                  }/confirm-user/${email}" class="action-button">
                    ✅ Approve Account
                  </a>
                  <a href="${
                    process.env.SITE_URL || "http://localhost:3000"
                  }/admin/users" class="action-button" style="background-color: #6c757d;">
                    👥 Manage Users
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                  <strong>Next Steps:</strong><br>
                  1. Review the user information above<br>
                  2. Click "Approve Account" to confirm the registration<br>
                  3. The user will receive a confirmation email automatically
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      // Send email
      await transporter.sendMail(mailOptions);
      console.log(
        "📧 Admin notification email sent successfully to:",
        process.env.CONFIRM_EMAIL
      );
    } catch (emailError) {
      console.error("📧 Error sending admin notification email:", emailError);
      // Log specific error details for debugging
      if (emailError.code) {
        console.error("📧 Email error code:", emailError.code);
      }
      if (emailError.response) {
        console.error("📧 Email server response:", emailError.response);
      }
      // Continue with registration even if email fails (don't block user registration)
    }

    // Flash success message and redirect
    console.log("🎉 Setting success flash message...");
    req.flash(
      "success_message",
      "Your request for creating an account has been received. We will review and get back to you within 24 hours."
    );
    console.log("✅ Success message set, redirecting to /signup...");
    res.redirect("/signup");
  } catch (err) {
    console.error("💥 Error registering user:", err);

    // Check if it's a MongoDB duplicate key error
    if (err.code === 11000) {
      req.flash(
        "error_message",
        "Email already registered. Please use a different email."
      );
      req.flash("formData", JSON.stringify(req.body));
    } else {
      req.flash(
        "error_message",
        "Something went wrong while creating your account. Please try again."
      );
      req.flash("formData", JSON.stringify(req.body));
    }

    res.redirect("/signup");
  }
};

// ============================================
// CONFIRM USER ACCOUNT
// ============================================
exports.confirmUser = async (req, res) => {
  const { email } = req.params;

  try {
    console.log("🔍 Looking for user to confirm:", email);

    const user = await User.findOne({ email: email });

    if (!user) {
      console.log("❌ User not found for confirmation");
      return res.status(404).send("User not found");
    }

    if (user.isConfirmed) {
      console.log("⚠️ Account already confirmed");
      return res.send("Account already confirmed");
    }

    // Confirm the user account
    user.isConfirmed = true;
    await user.save();

    console.log("✅ Account confirmed successfully");

    // ============================================
    // USER CONFIRMATION EMAIL
    // ============================================
    try {
      console.log("📧 Sending user confirmation email...");

      // Create email transporter
      const transporter = createEmailTransporter();

      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || "IAAI Training Platform",
          address: process.env.EMAIL_USER,
        },
        to: email,
        subject: "🎉 Welcome to IAAI Training - Account Confirmed!",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; }
              .content { padding: 30px 20px; }
              .welcome-box { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .login-button {
                display: inline-block;
                padding: 15px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border-radius: 25px;
                font-weight: bold;
                margin: 20px 0;
              }
              .footer { color: #666; font-size: 14px; text-align: center; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to IAAI Training!</h1>
                <p>Your account has been approved and activated</p>
              </div>
              
              <div class="content">
                <p>Hi <strong>${user.firstName}</strong>,</p>
                
                <div class="welcome-box">
                  <h3>✅ Account Successfully Confirmed</h3>
                  <p>Congratulations! Your account has been reviewed and approved by our team. You now have full access to the IAAI Training Platform.</p>
                </div>
                
                <h3>🚀 What's Next?</h3>
                <ul>
                  <li>🔐 Log in to your account using your email and password</li>
                  <li>📚 Browse our comprehensive training programs</li>
                  <li>🎓 Enroll in courses that match your interests</li>
                  <li>📈 Track your learning progress</li>
                  ${
                    user.role === "instructor"
                      ? "<li>👨‍🏫 Access instructor tools and resources</li>"
                      : ""
                  }
                </ul>
                
                <div style="text-align: center;">
                  <a href="${
                    process.env.SITE_URL || "http://localhost:3000"
                  }/login" class="login-button">
                    🔐 Login to Your Account
                  </a>
                </div>
                
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                
                <p>Welcome aboard!<br>
                <strong>The IAAI Training Team</strong></p>
              </div>
              
              <div class="footer">
                <p>This email was sent to ${email}. If you did not create an account, please ignore this email.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("📧 User confirmation email sent successfully to:", email);
    } catch (emailError) {
      console.error("📧 Error sending user confirmation email:", emailError);
    }

    // Send response to admin
    res.send(`
      <html>
        <head>
          <title>Account Confirmed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f8f9fa; }
            .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: #28a745; }
            .btn { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="success">✅ Account Confirmed Successfully!</h2>
            <p>The user <strong>${email}</strong> has been approved and can now access the platform.</p>
            <p>A welcome email has been sent to the user automatically.</p>
            <a href="/admin/users" class="btn">👥 Back to User Management</a>
            <a href="/dashboard" class="btn">📊 Go to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("💥 Error confirming user:", err);
    res.status(500).send("Error confirming account");
  }
};

// Alternative method name for backward compatibility
exports.signupUser = exports.registerUser;

// ============================================
// LOGIN FUNCTIONALITY
// ============================================
exports.loginUser = (req, res, next) => {
  console.log("🔐 Login attempt for:", req.body.email);

  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.log("💥 Login error:", err);
      return next(err);
    }

    if (!user) {
      console.log("❌ Login failed: Invalid credentials");
      req.flash("error_message", "Invalid email or password.");
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) {
        console.log("💥 Session error:", err);
        return next(err);
      }

      if (!user.isConfirmed) {
        console.log("⚠️ Login blocked: Account not confirmed");
        req.flash(
          "error_message",
          "Account not confirmed yet. Please contact support."
        );
        return res.redirect("/login");
      }

      console.log("✅ Login successful for:", user.email);
      res.redirect("/dashboard");
    });
  })(req, res, next);
};

// ============================================
// GET USER PROFILE
// ============================================
exports.getUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/login");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect("/login");
    }

    res.render("profile", { user: user });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    req.flash("error_message", "Error loading profile.");
    res.redirect("/dashboard");
  }
};

// ============================================
// UPDATE USER PROFILE
// ============================================
exports.updateUserProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/login");
    }

    const { firstName, lastName, phoneNumber, profession, country } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect("/login");
    }

    // Update user profile
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phoneNumber = phoneNumber || user.phoneNumber;
    user.profession = profession || user.profession;
    user.country = country || user.country;

    await user.save();

    req.flash("success_message", "Profile updated successfully.");
    res.redirect("/profile");
  } catch (err) {
    console.error("Error updating user profile:", err);
    req.flash("error_message", "Error updating profile.");
    res.redirect("/profile");
  }
};

// ============================================
// RECAPTCHA VERIFICATION
// ============================================
async function verifyRecaptcha(recaptchaResponse) {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaResponse}`;

    const response = await axios.post(verifyUrl);
    return response.data.success;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}
