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
    return res
      .status(403)
      .json({ success: false, message: "Access denied - Not authenticated" });
  }

  // Check if user has admin role (based on your logs, role is directly on user object)
  if (req.user.role === "admin") {
    console.log(`✅ Admin access granted for ${req.user.email}`);
    return next(); // Allow access to the next middleware/route
  }

  console.log(`❌ User role: ${req.user.role} - not admin`);
  // If user is not an admin, send an Access Denied response
  return res
    .status(403)
    .json({ success: false, message: "Access denied - Not admin" });
};
