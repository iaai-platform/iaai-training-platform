// routes/cartWishlistRoutes.js - UPDATED TO USE CONTROLLER

const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartWishlistController");
const isAuthenticated = require("../middlewares/isAuthenticated");

console.log("🛒 Loading cart and wishlist routes with controller...");

// ========================================
// CART ROUTES
// ========================================

// Add to Cart - All course types
router.post("/add-to-cart", isAuthenticated, cartController.addToCart);

// Remove from Cart - All course types
router.post(
  "/remove-from-cart",
  isAuthenticated,
  cartController.removeFromCart
);

// ========================================
// WISHLIST ROUTES
// ========================================

// Add to Wishlist - All course types
router.post("/add-to-wishlist", isAuthenticated, cartController.addToWishlist);

// Remove from Wishlist - All course types
router.post("/remove-from-wishlist", isAuthenticated, async (req, res) => {
  try {
    console.log("🗑️ Remove from wishlist request received");
    console.log("📝 Request body:", req.body);

    const { courseId, courseType } = req.body;
    const User = require("../models/user");

    if (!courseId || !courseType) {
      return res.status(400).json({
        success: false,
        message: "Course ID and course type are required",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Map course types to user fields
    const COURSE_MAPPINGS = {
      "In-Person": "myInPersonCourses",
      InPersonAestheticTraining: "myInPersonCourses",
      "Online Live": "myLiveCourses",
      OnlineLiveTraining: "myLiveCourses",
      "Self-Paced": "mySelfPacedCourses",
      SelfPacedOnlineTraining: "mySelfPacedCourses",
    };

    const userField = COURSE_MAPPINGS[courseType];
    if (!userField) {
      return res.status(400).json({
        success: false,
        message: "Invalid course type",
      });
    }

    // Find and remove from the appropriate array
    const courseArray = user[userField];
    if (!courseArray) {
      return res.status(404).json({
        success: false,
        message: "Course not found in wishlist",
      });
    }

    const courseIndex = courseArray.findIndex(
      (item) =>
        item.courseId.toString() === courseId &&
        item.enrollmentData.status === "wishlist"
    );

    if (courseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Course not found in wishlist",
      });
    }

    // Remove the course
    courseArray.splice(courseIndex, 1);

    // Save with validation bypass
    await user.save({ validateBeforeSave: false });

    console.log("✅ Course removed from wishlist successfully");
    res.json({
      success: true,
      message: "Course removed from wishlist",
    });
  } catch (error) {
    console.error("❌ Error removing from wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Error removing course from wishlist",
    });
  }
});

// ========================================
// CART DATA RETRIEVAL ROUTES
// ========================================

// Get Cart Items
router.get("/cart", isAuthenticated, async (req, res) => {
  try {
    console.log("🛒 Get cart request received");

    const User = require("../models/user");
    const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
    const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
    const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");

    const user = await User.findById(req.user._id)
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Collect all cart items
    let cartItems = [];

    // In-Person Courses in Cart
    if (user.myInPersonCourses) {
      const inPersonCartItems = user.myInPersonCourses
        .filter((item) => item.enrollmentData.status === "cart")
        .map((item) => ({
          _id: item._id,
          courseId: item.courseId._id,
          courseType: "InPersonAestheticTraining",
          courseTypeDisplay: "In-Person Training",
          title: item.courseId.basic?.title || "Untitled Course",
          courseCode: item.courseId.basic?.courseCode || "N/A",
          price:
            item.enrollmentData.paidAmount ||
            item.courseId.enrollment?.price ||
            0,
          currency:
            item.enrollmentData.currency ||
            item.courseId.enrollment?.currency ||
            "USD",
          startDate: item.courseId.schedule?.startDate,
          endDate: item.courseId.schedule?.endDate,
          duration: item.courseId.schedule?.duration,
          location: `${item.courseId.venue?.city || "TBD"}, ${
            item.courseId.venue?.country || "TBD"
          }`,
          instructor: item.courseId.instructorNames || "Expert Instructors",
          addedToCartAt: item.enrollmentData.registrationDate,
        }));
      cartItems = cartItems.concat(inPersonCartItems);
    }

    // Online Live Courses in Cart
    if (user.myLiveCourses) {
      const liveCartItems = user.myLiveCourses
        .filter((item) => item.enrollmentData.status === "cart")
        .map((item) => ({
          _id: item._id,
          courseId: item.courseId._id,
          courseType: "OnlineLiveTraining",
          courseTypeDisplay: "Online Live Training",
          title: item.courseId.basic?.title || "Untitled Course",
          courseCode: item.courseId.basic?.courseCode || "N/A",
          price:
            item.enrollmentData.paidAmount ||
            item.courseId.enrollment?.price ||
            0,
          currency:
            item.enrollmentData.currency ||
            item.courseId.enrollment?.currency ||
            "USD",
          startDate: item.courseId.schedule?.startDate,
          endDate: item.courseId.schedule?.endDate,
          duration: item.courseId.schedule?.duration,
          location: "Online",
          instructor: item.courseId.instructorNames || "Expert Instructors",
          addedToCartAt: item.enrollmentData.registrationDate,
        }));
      cartItems = cartItems.concat(liveCartItems);
    }

    // Self-Paced Courses in Cart
    if (user.mySelfPacedCourses) {
      const selfPacedCartItems = user.mySelfPacedCourses
        .filter((item) => item.enrollmentData.status === "cart")
        .map((item) => ({
          _id: item._id,
          courseId: item.courseId._id,
          courseType: "SelfPacedOnlineTraining",
          courseTypeDisplay: "Self-Paced Online Training",
          title: item.courseId.basic?.title || "Untitled Course",
          courseCode: item.courseId.basic?.courseCode || "N/A",
          price:
            item.enrollmentData.paidAmount || item.courseId.access?.price || 0,
          currency:
            item.enrollmentData.currency ||
            item.courseId.access?.currency ||
            "USD",
          duration: item.courseId.content?.totalDuration || "Self-paced",
          location: "Online - Self-Paced",
          instructor: item.courseId.instructorNames || "Expert Instructors",
          addedToCartAt: item.enrollmentData.registrationDate,
          accessDuration: item.courseId.access?.duration,
        }));
      cartItems = cartItems.concat(selfPacedCartItems);
    }

    // Calculate totals
    const subtotal = cartItems.reduce(
      (sum, item) => sum + (item.price || 0),
      0
    );
    const itemCount = cartItems.length;

    console.log(`✅ Retrieved ${itemCount} cart items, subtotal: $${subtotal}`);

    res.json({
      success: true,
      cartItems: cartItems,
      summary: {
        itemCount: itemCount,
        subtotal: subtotal,
        currency: cartItems.length > 0 ? cartItems[0].currency : "USD",
      },
    });
  } catch (error) {
    console.error("❌ Error retrieving cart:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving cart items",
    });
  }
});

// Get Wishlist Items
router.get("/wishlist", isAuthenticated, async (req, res) => {
  try {
    console.log("❤️ Get wishlist request received");

    const User = require("../models/user");

    const user = await User.findById(req.user._id)
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Collect all wishlist items
    let wishlistItems = [];

    // In-Person Courses in Wishlist
    if (user.myInPersonCourses) {
      const inPersonWishlistItems = user.myInPersonCourses
        .filter((item) => item.enrollmentData.status === "wishlist")
        .map((item) => ({
          _id: item._id,
          courseId: item.courseId._id,
          courseType: "InPersonAestheticTraining",
          courseTypeDisplay: "In-Person Training",
          title: item.courseId.basic?.title || "Untitled Course",
          courseCode: item.courseId.basic?.courseCode || "N/A",
          price:
            item.enrollmentData.paidAmount ||
            item.courseId.enrollment?.price ||
            0,
          currency:
            item.enrollmentData.currency ||
            item.courseId.enrollment?.currency ||
            "USD",
          startDate: item.courseId.schedule?.startDate,
          duration: item.courseId.schedule?.duration,
          location: `${item.courseId.venue?.city || "TBD"}, ${
            item.courseId.venue?.country || "TBD"
          }`,
          instructor: item.courseId.instructorNames || "Expert Instructors",
          addedToWishlistAt: item.enrollmentData.registrationDate,
        }));
      wishlistItems = wishlistItems.concat(inPersonWishlistItems);
    }

    // Online Live Courses in Wishlist
    if (user.myLiveCourses) {
      const liveWishlistItems = user.myLiveCourses
        .filter((item) => item.enrollmentData.status === "wishlist")
        .map((item) => ({
          _id: item._id,
          courseId: item.courseId._id,
          courseType: "OnlineLiveTraining",
          courseTypeDisplay: "Online Live Training",
          title: item.courseId.basic?.title || "Untitled Course",
          courseCode: item.courseId.basic?.courseCode || "N/A",
          price:
            item.enrollmentData.paidAmount ||
            item.courseId.enrollment?.price ||
            0,
          currency:
            item.enrollmentData.currency ||
            item.courseId.enrollment?.currency ||
            "USD",
          startDate: item.courseId.schedule?.startDate,
          duration: item.courseId.schedule?.duration,
          location: "Online",
          instructor: item.courseId.instructorNames || "Expert Instructors",
          addedToWishlistAt: item.enrollmentData.registrationDate,
        }));
      wishlistItems = wishlistItems.concat(liveWishlistItems);
    }

    // Self-Paced Courses in Wishlist
    if (user.mySelfPacedCourses) {
      const selfPacedWishlistItems = user.mySelfPacedCourses
        .filter((item) => item.enrollmentData.status === "wishlist")
        .map((item) => ({
          _id: item._id,
          courseId: item.courseId._id,
          courseType: "SelfPacedOnlineTraining",
          courseTypeDisplay: "Self-Paced Online Training",
          title: item.courseId.basic?.title || "Untitled Course",
          courseCode: item.courseId.basic?.courseCode || "N/A",
          price:
            item.enrollmentData.paidAmount || item.courseId.access?.price || 0,
          currency:
            item.enrollmentData.currency ||
            item.courseId.access?.currency ||
            "USD",
          duration: item.courseId.content?.totalDuration || "Self-paced",
          location: "Online - Self-Paced",
          instructor: item.courseId.instructorNames || "Expert Instructors",
          addedToWishlistAt: item.enrollmentData.registrationDate,
        }));
      wishlistItems = wishlistItems.concat(selfPacedWishlistItems);
    }

    console.log(`✅ Retrieved ${wishlistItems.length} wishlist items`);

    res.json({
      success: true,
      wishlistItems: wishlistItems,
      itemCount: wishlistItems.length,
    });
  } catch (error) {
    console.error("❌ Error retrieving wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving wishlist items",
    });
  }
});

// ========================================
// DEBUG ROUTES (for testing)
// ========================================

// Debug: Check user status
router.get("/debug/user-status", isAuthenticated, async (req, res) => {
  try {
    const User = require("../models/user");
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        hasInPersonCourses: !!(
          user.myInPersonCourses && user.myInPersonCourses.length > 0
        ),
        hasLiveCourses: !!(user.myLiveCourses && user.myLiveCourses.length > 0),
        hasSelfPacedCourses: !!(
          user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0
        ),
        inPersonCoursesCount: user.myInPersonCourses
          ? user.myInPersonCourses.length
          : 0,
        liveCoursesCount: user.myLiveCourses ? user.myLiveCourses.length : 0,
        selfPacedCoursesCount: user.mySelfPacedCourses
          ? user.mySelfPacedCourses.length
          : 0,
      },
    });
  } catch (error) {
    console.error("❌ Debug error:", error);
    res.status(500).json({
      success: false,
      message: "Debug error",
    });
  }
});

console.log("✅ Cart and wishlist routes loaded successfully");

module.exports = router;
