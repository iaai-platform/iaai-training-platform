// controllers/userController.js
const bcrypt = require("bcryptjs");
const User = require("../models/user");
const passport = require("passport");
const nodemailer = require("nodemailer");
const axios = require("axios");

// -------------------- REGISTER/SIGNUP USER --------------------
exports.registerUser = async (req, res) => {
  console.log("📝 Signup route hit!");
  console.log("📥 Request body:", {
    ...req.body,
    password: "[HIDDEN]",
    confirmPassword: "[HIDDEN]",
  });

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

  try {
    // Validation: Ensure required fields are filled
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      console.log("❌ Validation failed: Missing required fields");
      req.flash(
        "error_message",
        "All required fields must be filled out. Please check the form and try again."
      );
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    // Validation: Check if passwords match
    if (password !== confirmPassword) {
      console.log("❌ Validation failed: Passwords do not match");
      req.flash(
        "error_message",
        "Passwords do not match. Please make sure both password fields are identical."
      );
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    // Validation: Check password length
    if (password.length < 8) {
      console.log("❌ Validation failed: Password too short");
      req.flash(
        "error_message",
        "Password must be at least 8 characters long for security."
      );
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    // Validation: Check password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    console.log("🔍 Password validation details:");
    console.log("  Password length:", password.length);
    console.log("  Has uppercase:", hasUpperCase);
    console.log("  Has lowercase:", hasLowerCase);
    console.log("  Has numbers:", hasNumbers);
    console.log("  Has special chars:", hasSpecialChars);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      console.log("❌ Validation failed: Password not strong enough");
      let missingRequirements = [];
      if (!hasUpperCase) missingRequirements.push("uppercase letter");
      if (!hasLowerCase) missingRequirements.push("lowercase letter");
      if (!hasNumbers) missingRequirements.push("number");

      req.flash(
        "error_message",
        `Password is not strong enough. It must contain at least one ${missingRequirements.join(
          ", "
        )}. Please choose a stronger password.`
      );
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    // Validation: Email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Validation failed: Invalid email format");
      req.flash("error_message", "Please enter a valid email address.");
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    console.log("🔍 Checking for existing user with email:", email);

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log("❌ User already exists");
      req.flash(
        "error_message",
        "An account with this email already exists. Please use a different email address or try logging in."
      );
      req.flash("formData", JSON.stringify(req.body));
      return res.redirect("/signup");
    }

    console.log("🔐 Hashing password...");
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12); // Increased rounds for better security

    console.log("👤 Creating user data object...");
    // Create user object with flat structure
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phoneNumber: phoneNumber ? phoneNumber.trim() : "",
      profession: profession ? profession.trim() : "",
      country: country ? country.trim() : "",
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
        experience: experience ? experience.trim() : "",
        expertise: expertise ? expertise.trim() : "",
        cv: cv ? cv.trim() : "",
        appliedForCourses: [],
        allocatedCourses: [],
      };
    }

    console.log("💾 Saving user to database...");
    const newUser = new User(userData);
    await newUser.save();

    console.log("✅ User saved successfully! ID:", newUser._id);

    // -------------------- EMAIL NOTIFICATION --------------------
    try {
      console.log("📧 Attempting to send email notification...");

      // Configure nodemailer
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER || "m.minepour@gmail.com",
          pass: process.env.EMAIL_PASS || "38313831Minemn",
        },
      });

      let mailOptions = {
        from: process.env.EMAIL_USER || "m.minepour@gmail.com",
        to: process.env.ADMIN_EMAIL || "admin-email@example.com",
        subject: "New User Registration - IAAI Training",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">New User Registration</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${firstName} ${lastName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Role:</strong> ${role}</p>
              <p><strong>Phone:</strong> ${phoneNumber || "Not provided"}</p>
              <p><strong>Profession:</strong> ${
                profession || "Not provided"
              }</p>
              <p><strong>Country:</strong> ${country || "Not provided"}</p>
              ${
                role === "instructor"
                  ? `
                <hr style="margin: 15px 0;">
                <h4>Instructor Details:</h4>
                <p><strong>Experience:</strong> ${
                  experience || "Not provided"
                }</p>
                <p><strong>Expertise:</strong> ${
                  expertise || "Not provided"
                }</p>
                <p><strong>CV:</strong> ${cv || "Not provided"}</p>
              `
                  : ""
              }
            </div>
            <p style="color: #e74c3c; font-weight: bold;">⚠️ Please review and confirm this account to allow login.</p>
            <div style="margin: 20px 0;">
              <a href="${
                process.env.SITE_URL || "http://localhost:3000"
              }/confirm-user/${email}" 
                 style="background: #27ae60; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Confirm Account
              </a>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("📧 Email notification sent successfully to admin");
    } catch (emailError) {
      console.log("📧 Error sending email notification:", emailError.message);
      // Don't fail the registration if email fails, but log it
    }

    // Flash success message and redirect
    console.log("🎉 Setting success flash message...");
    req.flash(
      "success_message",
      `Thank you ${firstName}! Your account application has been submitted successfully. Our team will review your application and send you a confirmation email once approved. This usually takes 24-48 hours.`
    );
    console.log("✅ Success message set, redirecting to /signup...");
    res.redirect("/signup");
  } catch (err) {
    console.error("💥 Error registering user:", err);

    // Check if it's a MongoDB duplicate key error
    if (err.code === 11000) {
      console.log("💥 Duplicate key error - email already exists");
      req.flash(
        "error_message",
        "An account with this email already exists. Please use a different email address."
      );
      req.flash("formData", JSON.stringify(req.body));
    } else if (err.name === "ValidationError") {
      console.log("💥 MongoDB validation error:", err.message);
      req.flash(
        "error_message",
        "There was an issue with the information provided. Please check all fields and try again."
      );
      req.flash("formData", JSON.stringify(req.body));
    } else {
      console.log("💥 Unexpected error:", err.message);
      req.flash(
        "error_message",
        "We're sorry, but something went wrong while creating your account. Please try again in a few minutes or contact support if the problem persists."
      );
      req.flash("formData", JSON.stringify(req.body));
    }

    res.redirect("/signup");
  }
};

// Alternative method name for backward compatibility
exports.signupUser = exports.registerUser;

// -------------------- CONFIRM USER ACCOUNT --------------------
exports.confirmUser = async (req, res) => {
  const { email } = req.params;

  try {
    console.log("🔍 Looking for user to confirm:", email);

    // Now using flat structure
    const user = await User.findOne({ email: email });

    if (!user) {
      console.log("❌ User not found for confirmation");
      return res.status(404).send("User not found");
    }

    if (user.isConfirmed) {
      console.log("⚠️ Account already confirmed");
      return res.send("Account already confirmed");
    }

    user.isConfirmed = true;
    await user.save();

    console.log("✅ Account confirmed successfully");

    // Optional: Send confirmation email to user
    try {
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER || "m.minepour@gmail.com",
          pass: process.env.EMAIL_PASS || "38313831Minemn",
        },
      });

      let mailOptions = {
        from: process.env.EMAIL_USER || "m.minepour@gmail.com",
        to: email,
        subject: "Account Confirmed - IAAI Training",
        html: `
          <h3>Welcome to IAAI Training!</h3>
          <p>Hi ${user.firstName},</p>
          <p>Your account has been confirmed and you can now log in to access our platform.</p>
          <p><a href="${
            process.env.SITE_URL || "http://localhost:3000"
          }/login">Login here</a></p>
          <p>Thank you for joining us!</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("📧 Confirmation email sent to user");
    } catch (emailError) {
      console.log("📧 Error sending confirmation email:", emailError);
    }

    res.send(`
      <h2>Account confirmed successfully!</h2>
      <p>The user ${email} can now log in to the platform.</p>
      <p><a href="/admin/users">Back to User Management</a></p>
    `);
  } catch (err) {
    console.error("💥 Error confirming user:", err);
    res.status(500).send("Error confirming account");
  }
};

// -------------------- LOGIN FUNCTIONALITY --------------------
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

      // Now using flat structure
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

// -------------------- GET USER PROFILE --------------------
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

// -------------------- UPDATE USER PROFILE --------------------
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

    // Update user profile (now using flat structure)
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

// Add this function
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
