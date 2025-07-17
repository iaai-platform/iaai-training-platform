// server.js - IAAI Training Platform Server
// ============================================
// HIGH-LEVEL OVERVIEW:
// This is the main server file for the IAAI Training Platform
// It handles:
// 1. Core server setup and middleware configuration
// 2. Database connection (MongoDB)
// 3. Authentication (Passport.js)
// 4. Session management
// 5. Route registration for all modules
// 6. Static file serving
// ============================================

// ============================================
// 1. IMPORTS AND DEPENDENCIES
// ============================================
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const flash = require("connect-flash");
const nodemailer = require("nodemailer");
const methodOverride = require("method-override");
const passport = require("passport");
const passportConfig = require("./config/passportConfig");

// Models
const User = require("./models/user");

require("dotenv").config();
// ============================================
// 2. EXPRESS APP INITIALIZATION
// ============================================
const app = express();

// ============================================
// 3. VIEW ENGINE SETUP
// ============================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ============================================
// 4. DATABASE CONNECTION
// ============================================
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/iaai-training",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB Atlas successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

// ============================================
// 5. MIDDLEWARE CONFIGURATION
// ============================================

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.json());

// Cookie parser
app.use(cookieParser());

// Method override for PUT/DELETE in forms
app.use(methodOverride("_method"));

// Session configuration - MUST be before Passport

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "iaai-training-platform-secret-2025-fallback",
    resave: false,
    saveUninitialized: false, // Change to false for production
    cookie: {
      secure: false, // Keep false since you're using HTTP redirect
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax", // Add this for better compatibility
    },
    name: "sessionId", // Add custom session name
  })
);

// Passport authentication setup
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables for views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_message = req.flash("success_message");
  res.locals.error_message = req.flash("error_message");
  next();
});

// ============================================
// 6. STATIC FILE SERVING
// ============================================
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/uploads/videos",
  express.static(path.join(__dirname, "uploads/videos"))
);
app.use(
  "/uploads/instructors",
  express.static(path.join(__dirname, "uploads/instructors"))
);

console.log("📁 Serving static files from:", path.join(__dirname, "public"));
console.log("🎥 Serving videos from:", path.join(__dirname, "uploads/videos"));
console.log(
  "👤 Serving instructor photos from:",
  path.join(__dirname, "uploads/instructors")
);

// ============================================
// 7. AUTHENTICATION ROUTES
// ============================================
const loginRoutes = require("./routes/loginRoutes");
const signupRoutes = require("./routes/signupRoutes");
const authRoutes = require("./routes/authRoutes");

app.use("/", loginRoutes);
app.use("/", signupRoutes);
app.use("/", authRoutes);

// Logout route
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

// ============================================
// 8. CORE APPLICATION ROUTES
// ============================================

// Dashboard - Protected route
app.get("/dashboard", (req, res) => {
  console.log("📊 Dashboard route accessed");

  if (req.isAuthenticated()) {
    console.log(
      "✅ User authenticated:",
      req.user.email,
      "- Role:",
      req.user.role
    );
    res.render("dashboard", {
      user: req.user,
      title: "Dashboard",
    });
  } else {
    console.log("❌ User not authenticated, redirecting to login");
    req.flash("error_message", "Please log in to access the dashboard.");
    res.redirect("/login");
  }
});

// Homepage management
const homepageUpdateRoutes = require("./routes/homepageUpdateRoutes");
app.use("/", homepageUpdateRoutes);

// ============================================
// 9. COURSE User ROUTES
// ============================================

// Training Programs Overview
app.get("/training-programs", (req, res) => {
  const user = req.user || null;
  const trainingProgramsContent = {
    backgroundImage: "/path/to/your/image.jpg",
    welcomeText:
      "Explore our wide range of training programs to enhance your aesthetic skills.",
    description:
      "We offer various training programs including injectables, skincare, and facial contouring techniques.",
  };

  res.render("training-programs", {
    user: user,
    trainingProgramsContent: trainingProgramsContent,
  });
});

// ============================================
// ADD THESE ROUTES TO YOUR SERVER.JS FILE
// Insert after line 94 (after training-programs route)
// ============================================

// ============================================
// 9.5 ALL COURSES ROUTES (NEW)
// ============================================

// Main All Courses page
app.get("/all-courses", (req, res) => {
  const user = req.user || null;
  res.render("all-courses", {
    user: user,
    title: "All Courses - IAAI",
  });
});

// Hands-On Surgical & Non-Surgical Courses
app.get("/hands-on-surgical-courses", (req, res) => {
  const user = req.user || null;
  res.render("hands-on-surgical-courses", {
    user: user,
    title: "Hands-On Surgical & Non-Surgical Courses - IAAI",
  });
});

// Comprehensive & Progressive Training Programs
app.get("/comprehensive-training-programs", (req, res) => {
  const user = req.user || null;
  res.render("comprehensive-training-programs", {
    user: user,
    title: "Comprehensive & Progressive Training Programs - IAAI",
  });
});

// Specialized Training Programs
app.get("/specialized-training-programs", (req, res) => {
  const user = req.user || null;
  res.render("specialized-training-programs", {
    user: user,
    title: "Specialized Training Programs - IAAI",
  });
});

// Interactive Webinar Programs
app.get("/interactive-webinar-programs", (req, res) => {
  const user = req.user || null;
  res.render("interactive-webinar-programs", {
    user: user,
    title: "Interactive Webinar Programs - IAAI",
  });
});

console.log("📚 All Courses routes loaded");

// ============================================
// 9.1 IN-PERSON TRAINING USER ROUTES (NEW)
// ============================================
// IMPORTANT: User routes for in-person training MUST come before admin routes
const inPersonCourseUserRoutes = require("./routes/inPersonCourseUserRoutes");
app.use("/", inPersonCourseUserRoutes);
console.log("📚 In-person training user routes loaded");

// ============================================
// 9.2 ONLINE LIVE TRAINING USER ROUTES (NEW)
// ============================================
const onlineLiveCourseUserRoutes = require("./routes/onlineLiveCourseUserRoutes");
app.use("/", onlineLiveCourseUserRoutes);

console.log("📚 Online live training routes loaded");

// ============================================
// 9.3 SHARED CART AND WISHLIST ROUTES (ADD THIS!)
// ============================================
const cartWishlistRoutes = require("./routes/cartWishlistRoutes");
app.use("/", cartWishlistRoutes);

console.log("🛒 Shared cart and wishlist routes loaded");

// ============================================
// 9.4 Self Paced USER ROUTES (NEW)
// ============================================
const selfPacedCourseUserRoutes = require("./routes/selfPacedCourseUserRoutes");
app.use("/", selfPacedCourseUserRoutes);

//Others
// Course Types
const onDemandCoursesRoutes = require("./routes/onDemandCoursesRoutes");
const inCompanyCoursesRoutes = require("./routes/inCompanyCoursesRoutes");

app.use("/", onDemandCoursesRoutes);
app.use("/", inCompanyCoursesRoutes);

// ============================================
// 10. ADMIN ROUTES
// ============================================

// IMPORTANT: Instructor routes MUST come before admin courses routes
const instructorManageRoutes = require("./routes/instructorManageRoutes");
app.use("/instructors", instructorManageRoutes);

//new
// Instructors routes - ADD THIS LINE
const instructorsRoutes = require("./routes/instructorsRoutes");
app.use("/", instructorsRoutes);
console.log("👥 Instructors routes loaded");

// Admin In-Person Courses Routes
const inPersonCoursesRoutes = require("./routes/admin/inPersonCoursesRoutes");
app.use("/admin-courses/inperson", inPersonCoursesRoutes);

// Admin online live Courses Routes
const onlineLiveCoursesRoutes = require("./routes/admin/onlineLiveCoursesRoutes");
app.use("/admin-courses/onlinelive", onlineLiveCoursesRoutes);

// Admin routes
//const adminLiveOnlineCoursesRoutes = require('./routes/admin/liveOnlineCourses');
//app.use('/admin-courses/onlinelive', adminLiveOnlineCoursesRoutes);

// Admin routes
const adminSelfPacedCoursesRoutes = require("./routes/admin/selfPacedCoursesRoutes");
app.use("/admin-courses/selfpaced", adminSelfPacedCoursesRoutes);

// Admin user management
const adminUserRoutes = require("./routes/adminUserRoutes");
app.use("/", adminUserRoutes);

// Admin forms
const adminFormsRoutes = require("./routes/adminFormsRoutes");
app.use("/", adminFormsRoutes);

// Video exam administration
const adminVideoExamRoutes = require("./routes/adminVideoExamRoutes");
app.use("/", adminVideoExamRoutes);

// Promo code administration
const promoCodeAdminRoutes = require("./routes/promoCodeAdminRoutes");
app.use("/", promoCodeAdminRoutes);

// Certification Bodies Management Routes - ADD HERE
const certificationBodyRoutes = require("./routes/certificationBodyRoutes");
app.use("/", certificationBodyRoutes); // Mount at root so /admin-certification-bodies works

// Self-paced course videos
app.use(
  "/uploads/selfpaced/videos",
  express.static(path.join(__dirname, "uploads/selfpaced/videos"))
);
console.log(
  "📹 Serving self-paced videos from:",
  path.join(__dirname, "uploads/selfpaced/videos")
);

// ADD this to your server.js file for serving thumbnails:

// Serve self-paced course thumbnails
app.use(
  "/uploads/selfpaced/thumbnails",
  express.static(path.join(__dirname, "uploads/selfpaced/thumbnails"))
);

// Create thumbnails directory on startup
const thumbnailsDir = path.join(__dirname, "uploads/selfpaced/thumbnails");
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
  console.log("📸 Created thumbnails directory:", thumbnailsDir);
}

console.log("📸 Serving self-paced course thumbnails from:", thumbnailsDir);

// ============================================
// 11. USER FEATURES ROUTES
// ============================================

// User courses and learning
const myCoursesRoutes = require("./routes/myCoursesRoutes");
const watchExamRoutes = require("./routes/watchExamRoutes");
const libraryRoutes = require("./routes/libraryRoutes"); // ADD THIS LINE

app.use("/", myCoursesRoutes);
app.use("/", watchExamRoutes);
app.use("/", libraryRoutes); // ADD THIS LINE

// User profile and settings
const profileRoutes = require("./routes/profileRoutes");
const accountSettingsRoutes = require("./routes/accountSettingsRoutes");

app.use("/", profileRoutes);
app.use("/", accountSettingsRoutes);

// E-commerce features
const ordersRoutes = require("./routes/ordersRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");

app.use("/", ordersRoutes);
app.use("/", checkoutRoutes);
app.use("/", wishlistRoutes);

// ============================================
// 12. CERTIFICATION ROUTES
// ============================================
const certificateRoutes = require("./routes/certificates");
const certificateDebugRoutes = require("./routes/certificateDebugRoutes");

app.use("/certificates", certificateRoutes);
app.use("/api", certificateDebugRoutes);

// ============================================
// 13. COMMUNICATION ROUTES
// ============================================

// Contact and support
const contactUsRoutes = require("./routes/contactUsRoutes");
const customerSupportRoutes = require("./routes/customerSupportRoute");

app.use("/", contactUsRoutes);
app.use("/", customerSupportRoutes);

// News and updates
const latestNewsRoutes = require("./routes/latestNewsRoutes");
app.use("/", latestNewsRoutes);

// ============================================
// 14. MISCELLANEOUS ROUTES
// ============================================

// About page
app.get("/about", (req, res) => {
  res.render("about", { title: "About Us" });
});

// Trainer applications
const trainerApplicationRoutes = require("./routes/trainerApplicationRoutes");
app.use("/", trainerApplicationRoutes);

// ============================================
// 15. ERROR HANDLING
// ============================================

// 404 handler - for routes that don't exist
app.use((req, res, next) => {
  console.log(`❌ 404 - Page not found: ${req.url}`);
  res.status(404).send(`
    <html>
      <head>
        <title>404 - Page Not Found</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
          a { color: #3498db; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <p><a href="/">Go to Homepage</a> | <a href="/dashboard">Go to Dashboard</a></p>
      </body>
    </html>
  `);
});

// General error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(err.status || 500).send(`
    <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #e74c3c; }
          a { color: #3498db; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>Something went wrong!</h1>
        <p>${err.message || "An unexpected error occurred."}</p>
        <p><a href="/">Go to Homepage</a> | <a href="/dashboard">Go to Dashboard</a></p>
      </body>
    </html>
  `);
});

// ============================================
// 16. SERVER STARTUP
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server is running on port ${PORT}
  📱 Access the application at: http://localhost:${PORT}
  🛠️  Environment: ${app.get("env")}
  
  📚 In-Person Training Routes:
     - View all courses: http://localhost:${PORT}/in-person-aesthetic-training
     - View course details: http://localhost:${PORT}/in-person/courses/:courseId
     - Add to cart: POST /add-to-cart (authenticated)
     - Add to wishlist: POST /add-to-wishlist (authenticated)
     
  📹 Admin Self-Paced Courses:
     - Manage courses: http://localhost:${PORT}/admin/selfpaced/manage
  `);
});
