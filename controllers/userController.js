// controllers/userController.js - Optimized Version with Background Email Processing
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const passport = require("passport");

// ============================================
// EMAIL CONFIGURATION HELPER
// ============================================
function createEmailTransporter() {
  return {
    verify: async () => {
      console.log(
        "✅ Using Gmail SMTP - verification handled by sendEmail utility"
      );
      return true;
    },
    sendMail: async (options) => {
      const sendEmail = require("../utils/sendEmail");
      return await sendEmail(options);
    },
  };
}

// ============================================
// BACKGROUND EMAIL QUEUE HELPER
// ============================================
function sendEmailInBackground(emailOptions, emailType = "notification") {
  // Use setImmediate to defer email sending to next tick
  setImmediate(async () => {
    try {
      console.log(`📧 Sending ${emailType} email in background...`);
      const transporter = createEmailTransporter();
      await transporter.sendMail(emailOptions);
      console.log(`📧 ${emailType} email sent successfully in background`);
    } catch (emailError) {
      console.error(`📧 Background ${emailType} email failed:`, emailError);
      // Log error but don't throw - email failure shouldn't affect user experience

      // Optional: You could log this to a database or external service for monitoring
      // await logEmailFailure(emailType, emailOptions.to, emailError);
    }
  });
}

// Alternative using setTimeout for even more deferred execution
function sendEmailWithDelay(
  emailOptions,
  emailType = "notification",
  delay = 100
) {
  setTimeout(async () => {
    try {
      console.log(`📧 Sending ${emailType} email after ${delay}ms delay...`);
      const transporter = createEmailTransporter();
      await transporter.sendMail(emailOptions);
      console.log(`📧 ${emailType} email sent successfully after delay`);
    } catch (emailError) {
      console.error(`📧 Delayed ${emailType} email failed:`, emailError);
    }
  }, delay);
}

// ============================================
// REGISTER/SIGNUP USER - OPTIMIZED VERSION
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
    // IMMEDIATE SUCCESS RESPONSE TO USER
    // ============================================
    console.log("🎉 Setting success flash message (before email)...");
    req.flash(
      "success_message",
      "Your request for creating an account has been received. We will review and get back to you within 24 hours. Please check your spam/junk folder for our emails."
    );

    // Prepare email options for background sending
    const adminEmailOptions = {
      from: {
        name: "IAAI Training Institute",
        address:
          process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "info@iaa-i.com",
      },
      to: process.env.CONFIRM_EMAIL || "info@iaa-i.com",
      subject: `New User Registration - ${
        role === "instructor" ? "Instructor" : "Student"
      } Application`,
      headers: {
        "X-Entity-ID": "IAAI-Training-Institute",
        "X-Mailer": "IAAI Training Platform",
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background-color: #667eea; color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 25px; }
            .user-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .role-badge { 
              display: inline-block; 
              padding: 6px 16px; 
              border-radius: 20px; 
              font-size: 12px; 
              font-weight: bold;
              margin-top: 10px;
              ${
                role === "instructor"
                  ? "background-color: #e3f2fd; color: #1976d2;"
                  : "background-color: #f3e5f5; color: #7b1fa2;"
              }
            }
            .action-button {
              display: inline-block;
              padding: 15px 25px;
              background-color: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 10px 5px;
            }
            .footer { background: #f8f9fa; color: #666; font-size: 14px; text-align: center; padding: 20px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="margin: 0;">New User Registration</h2>
              <span class="role-badge">${
                role === "instructor" ? "👨‍🏫 INSTRUCTOR" : "🎓 STUDENT"
              }</span>
            </div>
            
            <div class="content">
              <p>A new user has registered on the IAAI Training Platform and requires your approval.</p>
              
              <div class="user-info">
                <h3 style="margin-top: 0;">User Information:</h3>
                <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phoneNumber || "Not provided"}</p>
                <p><strong>Profession:</strong> ${
                  profession || "Not provided"
                }</p>
                <p><strong>Country:</strong> ${country || "Not provided"}</p>
                <p><strong>Role:</strong> ${role}</p>
                
                ${
                  role === "instructor"
                    ? `
                  <hr style="margin: 15px 0; border: none; border-top: 1px solid #ddd;">
                  <h4>Instructor Details:</h4>
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
                  process.env.BASE_URL || "https://www.iaa-i.com"
                }/confirm-user/${encodeURIComponent(
        email
      )}" class="action-button">
                  ✅ Approve Account
                </a>
                <a href="${
                  process.env.BASE_URL || "https://www.iaa-i.com"
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
            
            <div class="footer">
              <p><strong>IAAI Training Institute</strong><br>
              Professional Aesthetic Training<br>
              ${process.env.BASE_URL || "https://www.iaa-i.com"}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        New User Registration - ${
          role === "instructor" ? "Instructor" : "Student"
        } Application
        
        A new user has registered and requires approval:
        
        Name: ${firstName} ${lastName}
        Email: ${email}
        Phone: ${phoneNumber || "Not provided"}
        Profession: ${profession || "Not provided"}
        Country: ${country || "Not provided"}
        Role: ${role}
        
        ${
          role === "instructor"
            ? `
        Instructor Details:
        Experience: ${experience || "Not provided"}
        Expertise: ${expertise || "Not provided"}  
        CV: ${cv || "Not provided"}
        `
            : ""
        }
        
        Approve at: ${
          process.env.BASE_URL || "https://www.iaa-i.com"
        }/confirm-user/${encodeURIComponent(email)}
      `,
    };

    // ============================================
    // SEND EMAIL IN BACKGROUND (NON-BLOCKING)
    // ============================================
    console.log(
      "📧 Queuing admin notification email for background processing..."
    );

    // Option 1: Use setImmediate (executes after current event loop)
    sendEmailInBackground(adminEmailOptions, "admin-notification");

    // Option 2: Use setTimeout with small delay (alternative approach)
    // sendEmailWithDelay(adminEmailOptions, "admin-notification", 100);

    // Respond immediately to user (email is now processing in background)
    console.log(
      "✅ Responding to user immediately while email processes in background"
    );
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
// CONFIRM USER ACCOUNT - OPTIMIZED VERSION
// ============================================
exports.confirmUser = async (req, res) => {
  const { email } = req.params;

  try {
    console.log("🔍 Looking for user to confirm:", email);

    const user = await User.findOne({ email: email });

    if (!user) {
      console.log("❌ User not found for confirmation");
      return res.status(404).send(`
        <html>
          <head>
            <title>User Not Found</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f4; }
              .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .error { color: #dc3545; }
              .btn { display: inline-block; padding: 12px 24px; background-color: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="error">❌ User Not Found</h2>
              <p>The user with email <strong>${email}</strong> was not found in our system.</p>
              <a href="${
                process.env.BASE_URL || "https://www.iaa-i.com"
              }/admin/users" class="btn">👥 Back to User Management</a>
            </div>
          </body>
        </html>
      `);
    }

    if (user.isConfirmed) {
      console.log("⚠️ Account already confirmed");
      return res.send(`
        <html>
          <head>
            <title>Already Confirmed</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f4; }
              .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .warning { color: #ffc107; }
              .btn { display: inline-block; padding: 12px 24px; background-color: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: 600; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="warning">⚠️ Account Already Confirmed</h2>
              <p>The account for <strong>${email}</strong> has already been confirmed and is active.</p>
              <a href="${
                process.env.BASE_URL || "https://www.iaa-i.com"
              }/admin/users" class="btn">👥 Back to User Management</a>
            </div>
          </body>
        </html>
      `);
    }

    // Confirm the user account
    user.isConfirmed = true;
    await user.save();

    console.log("✅ Account confirmed successfully");

    // Prepare welcome email for background sending
    const welcomeEmailOptions = {
      from: {
        name: "IAAI Training Institute",
        address:
          process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || "info@iaa-i.com",
      },
      to: email,
      subject: "Welcome to IAAI Training - Account Approved",
      headers: {
        "List-Unsubscribe": `<${process.env.BASE_URL}/unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "X-Entity-ID": "IAAI-Training-Institute",
        "X-Mailer": "IAAI Training Platform",
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to IAAI Training</title>
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0;
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 30px 20px; 
              text-align: center; 
            }
            .content { padding: 30px 25px; }
            .welcome-box { 
              background-color: #f8f9fa; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
              border-left: 4px solid #667eea;
            }
            .login-button {
              display: inline-block;
              padding: 15px 30px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .footer { 
              background: #f8f9fa;
              color: #666; 
              font-size: 14px; 
              text-align: center; 
              padding: 20px;
              border-top: 1px solid #eee;
            }
            ul { margin: 15px 0; padding-left: 20px; }
            li { margin: 8px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Welcome to IAAI Training!</h1>
              <p style="margin: 10px 0 0 0;">Your account has been approved</p>
            </div>
            
            <div class="content">
              <p>Dear ${user.firstName},</p>
              
              <div class="welcome-box">
                <h3 style="margin-top: 0;">Account Successfully Approved</h3>
                <p>Congratulations! Your account has been reviewed and approved by our team. You now have full access to the IAAI Training Platform.</p>
              </div>
              
              <h3>What's Next?</h3>
              <ul>
                <li>Log in to your account using your email and password</li>
                <li>Browse our comprehensive training programs</li>
                <li>Enroll in courses that match your interests</li>
                <li>Track your learning progress</li>
                ${
                  user.role === "instructor"
                    ? "<li>Access instructor tools and resources</li>"
                    : ""
                }
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${
                  process.env.BASE_URL || "https://www.iaa-i.com"
                }/login" class="login-button">
                  Login to Your Account
                </a>
              </div>
              
              <p>If you have any questions or need assistance, please contact our support team.</p>
              
              <p>Best regards,<br>
              <strong>IAAI Training Institute</strong></p>
            </div>
            
            <div class="footer">
              <p>This email was sent to ${email} because you created an account with IAAI Training Institute.</p>
              <p>If you did not create this account, please ignore this email.</p>
              <p><a href="${
                process.env.BASE_URL || "https://www.iaa-i.com"
              }/unsubscribe" style="color: #667eea;">Unsubscribe</a> | 
                 <a href="${
                   process.env.BASE_URL || "https://www.iaa-i.com"
                 }/contact" style="color: #667eea;">Contact Us</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to IAAI Training Institute!
        
        Dear ${user.firstName},
        
        Your account has been approved and is now active.
        
        You can now log in at: ${
          process.env.BASE_URL || "https://www.iaa-i.com"
        }/login
        
        What's next:
        - Log in using your email and password
        - Browse our training programs
        - Enroll in courses
        - Track your progress
        ${
          user.role === "instructor"
            ? "- Access instructor tools and resources"
            : ""
        }
        
        If you have questions, contact our support team.
        
        Best regards,
        IAAI Training Institute
        
        Email: ${process.env.ADMIN_EMAIL || "info@iaa-i.com"}
        Website: ${process.env.BASE_URL || "https://www.iaa-i.com"}
      `,
    };

    // Send welcome email in background
    console.log("📧 Queuing welcome email for background processing...");
    sendEmailInBackground(welcomeEmailOptions, "welcome");

    // Send immediate response to admin
    res.send(`
      <html>
        <head>
          <title>Account Confirmed</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f4; }
            .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: #28a745; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="success">✅ Account Confirmed Successfully!</h2>
            <p>The user <strong>${email}</strong> has been approved and can now access the platform.</p>
            <p>A welcome email is being sent to the user in the background.</p>
            <a href="${
              process.env.BASE_URL || "https://www.iaa-i.com"
            }/admin/users" class="btn">👥 Back to User Management</a>
            <a href="${
              process.env.BASE_URL || "https://www.iaa-i.com"
            }/dashboard" class="btn">📊 Go to Dashboard</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("💥 Error confirming user:", err);
    res.status(500).send(`
      <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f4; }
            .container { background: white; max-width: 500px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #dc3545; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="error">❌ Error Confirming Account</h2>
            <p>There was an error confirming the account. Please try again or contact support.</p>
            <a href="${
              process.env.BASE_URL || "https://www.iaa-i.com"
            }/admin/users" class="btn">👥 Back to User Management</a>
          </div>
        </body>
      </html>
    `);
  }
};

// Rest of your existing methods remain the same...
exports.signupUser = exports.registerUser;
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
// PASSWORD RESET REQUEST
// ============================================
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      req.flash("error_message", "No account found with that email address.");
      return res.redirect("/forgot-password");
    }

    // Generate reset token
    const resetToken = require("crypto").randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send password reset email
    try {
      console.log("📧 Sending password reset email...");

      const transporter = createEmailTransporter();

      const mailOptions = {
        from: {
          name: "IAAI Training Institute",
          address:
            process.env.ADMIN_EMAIL ||
            process.env.EMAIL_FROM ||
            "info@iaa-i.com",
        },
        to: email,
        subject: "Password Reset Request - IAAI Training",
        headers: {
          "X-Entity-ID": "IAAI-Training-Institute",
          "X-Mailer": "IAAI Training Platform",
        },
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { background: #dc3545; color: white; padding: 30px 20px; text-align: center; }
              .content { padding: 30px 25px; }
              .reset-button {
                display: inline-block;
                padding: 15px 30px;
                background: #dc3545;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
              }
              .footer { background: #f8f9fa; color: #666; font-size: 14px; text-align: center; padding: 20px; border-top: 1px solid #eee; }
              .warning { background: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Password Reset Request</h1>
              </div>
              
              <div class="content">
                <p>Hi <strong>${user.firstName}</strong>,</p>
                
                <p>We received a request to reset your password for your IAAI Training account.</p>
                
                <div class="warning">
                  <p><strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.</p>
                </div>
                
                <div style="text-align: center;">
                  <a href="${
                    process.env.BASE_URL || "https://www.iaa-i.com"
                  }/reset-password/${resetToken}" class="reset-button">
                    Reset My Password
                  </a>
                </div>
                
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 5px;">
                  ${
                    process.env.BASE_URL || "https://www.iaa-i.com"
                  }/reset-password/${resetToken}
                </p>
                
                <p><strong>If you didn't request this password reset:</strong></p>
                <ul>
                  <li>Please ignore this email</li>
                  <li>Your password will remain unchanged</li>
                  <li>Consider changing your password if you suspect unauthorized access</li>
                </ul>
                
                <p>Best regards,<br>
                <strong>IAAI Training Institute</strong></p>
              </div>
              
              <div class="footer">
                <p>This email was sent to ${email}. If you did not request a password reset, please ignore this email.</p>
                <p><strong>IAAI Training Institute</strong> | ${
                  process.env.BASE_URL || "https://www.iaa-i.com"
                }</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Password Reset Request - IAAI Training
          
          Hi ${user.firstName},
          
          We received a request to reset your password for your IAAI Training account.
          
          Reset your password at: ${
            process.env.BASE_URL || "https://www.iaa-i.com"
          }/reset-password/${resetToken}
          
          This link will expire in 1 hour for security reasons.
          
          If you didn't request this password reset, please ignore this email.
          
          Best regards,
          IAAI Training Institute
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("📧 Password reset email sent successfully to:", email);

      req.flash(
        "success_message",
        "Password reset instructions have been sent to your email address. Please check your spam/junk folder if you don't see it in your inbox."
      );
      res.redirect("/forgot-password");
    } catch (emailError) {
      console.error("📧 Error sending password reset email:", emailError);
      req.flash(
        "error_message",
        "Error sending password reset email. Please try again."
      );
      res.redirect("/forgot-password");
    }
  } catch (err) {
    console.error("💥 Error in password reset request:", err);
    req.flash("error_message", "Something went wrong. Please try again.");
    res.redirect("/forgot-password");
  }
};

// ============================================
// PASSWORD RESET COMPLETION
// ============================================
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  try {
    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash(
        "error_message",
        "Password reset token is invalid or has expired."
      );
      return res.redirect("/forgot-password");
    }

    // Validate passwords
    if (password !== confirmPassword) {
      req.flash("error_message", "Passwords do not match.");
      return res.redirect(`/reset-password/${token}`);
    }

    // Update password
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    try {
      console.log("📧 Sending password change confirmation email...");

      const transporter = createEmailTransporter();

      const mailOptions = {
        from: {
          name: "IAAI Training Institute",
          address:
            process.env.ADMIN_EMAIL ||
            process.env.EMAIL_FROM ||
            "info@iaa-i.com",
        },
        to: user.email,
        subject: "Password Successfully Changed - IAAI Training",
        headers: {
          "X-Entity-ID": "IAAI-Training-Institute",
          "X-Mailer": "IAAI Training Platform",
        },
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
              .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .header { background: #28a745; color: white; padding: 30px 20px; text-align: center; }
              .content { padding: 30px 25px; }
              .login-button {
                display: inline-block;
                padding: 15px 30px;
                background: #28a745;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
              }
              .footer { background: #f8f9fa; color: #666; font-size: 14px; text-align: center; padding: 20px; border-top: 1px solid #eee; }
              .security-info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Password Successfully Changed</h1>
              </div>
              
              <div class="content">
                <p>Hi <strong>${user.firstName}</strong>,</p>
                
                <p>Your password has been successfully changed for your IAAI Training account.</p>
                
                <div class="security-info">
                  <p><strong>🔒 Security Information:</strong></p>
                  <ul>
                    <li>Change completed on: ${new Date().toLocaleString()}</li>
                    <li>Your account is now secure with your new password</li>
                    <li>You can now log in using your new password</li>
                  </ul>
                </div>
                
                <div style="text-align: center;">
                  <a href="${
                    process.env.BASE_URL || "https://www.iaa-i.com"
                  }/login" class="login-button">
                    Login to Your Account
                  </a>
                </div>
                
                <p><strong>If you didn't make this change:</strong></p>
                <ul>
                  <li>Contact our support team immediately</li>
                  <li>Your account security may be compromised</li>
                  <li>We recommend reviewing your account activity</li>
                </ul>
                
                <p>Best regards,<br>
                <strong>IAAI Training Institute</strong></p>
              </div>
              
              <div class="footer">
                <p>This email was sent to ${
                  user.email
                } to confirm your password change.</p>
                <p><strong>IAAI Training Institute</strong> | ${
                  process.env.BASE_URL || "https://www.iaa-i.com"
                }</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
          Password Successfully Changed - IAAI Training
          
          Hi ${user.firstName},
          
          Your password has been successfully changed for your IAAI Training account.
          
          Security Information:
          - Change completed on: ${new Date().toLocaleString()}
          - Your account is now secure with your new password
          - You can now log in using your new password
          
          Login at: ${process.env.BASE_URL || "https://www.iaa-i.com"}/login
          
          If you didn't make this change, contact our support team immediately.
          
          Best regards,
          IAAI Training Institute
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(
        "📧 Password change confirmation email sent successfully to:",
        user.email
      );
    } catch (emailError) {
      console.error(
        "📧 Error sending password change confirmation email:",
        emailError
      );
      // Continue even if email fails
    }

    req.flash(
      "success_message",
      "Your password has been successfully reset. You can now log in."
    );
    res.redirect("/login");
  } catch (err) {
    console.error("💥 Error resetting password:", err);
    req.flash("error_message", "Something went wrong. Please try again.");
    res.redirect("/forgot-password");
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
