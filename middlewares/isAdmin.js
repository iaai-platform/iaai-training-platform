//middlewares/isAdmin.js
module.exports = function (req, res, next) {
  console.log("🔒 Checking admin access...");
  console.log("🔍 req.user exists:", !!req.user);

  if (req.user) {
    console.log("👤 User email:", req.user.email);
    console.log("🎭 User role:", req.user.role);
    console.log("📋 User object keys:", Object.keys(req.user));
  }

  // Check if user is authenticated
  if (!req.user) {
    console.log("❌ No user found");

    // Check if this is an API request
    if (
      req.xhr ||
      req.headers.accept.indexOf("json") > -1 ||
      req.originalUrl.startsWith("/api/")
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied - Not authenticated" });
    } else {
      // For HTML routes, redirect to login
      req.flash("error_message", "Please log in to access this page");
      return res.redirect("/login");
    }
  }

  // Check if user has admin role (based on your logs, role is directly on user object)
  if (req.user.role === "admin") {
    console.log(`✅ Admin access granted for ${req.user.email}`);
    return next(); // Allow access to the next middleware/route
  }

  console.log(`❌ User role: ${req.user.role} - not admin`);

  // Check if this is an API request
  if (
    req.xhr ||
    req.headers.accept.indexOf("json") > -1 ||
    req.originalUrl.startsWith("/api/")
  ) {
    // If user is not an admin, send an Access Denied JSON response
    return res
      .status(403)
      .json({ success: false, message: "Access denied - Not admin" });
  } else {
    // For HTML routes, show flash message and redirect
    req.flash("error_message", "Access denied. Admin privileges required.");
    return res.redirect("/dashboard");
  }
};
