// routes/cartWishlistRoutes.js - UPDATED FOR LINKED COURSES
const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartWishlistController");
const isAuthenticated = require("../middlewares/isAuthenticated");

console.log(
  "🛒 Loading cart and wishlist routes with linked course support..."
);

// ========================================
// CART ROUTES
// ========================================

// Add to Cart - All course types (handles linked courses automatically)
router.post("/add-to-cart", isAuthenticated, cartController.addToCart);

// Remove from Cart - Single course (handles linked courses automatically)
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

// Get Cart Items (UPDATED for linked courses)
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

    // ✅ UPDATED: In-Person Courses in Cart with Linked Course Data
    const inPersonCartItems =
      user.myInPersonCourses
        ?.filter((item) => item.enrollmentData.status === "cart")
        .map((item) => {
          const course = item.courseId;
          const registrationDate =
            item.enrollmentData.registrationDate || new Date();

          let originalPrice = course.enrollment?.price || 0;
          let currentPrice = originalPrice;
          let isEarlyBird = false;
          let earlyBirdSavings = 0;

          // Check for early bird pricing
          if (
            course.enrollment?.earlyBirdPrice &&
            course.enrollment?.earlyBirdDays &&
            course.schedule?.startDate
          ) {
            const earlyBirdDeadline = new Date(course.schedule.startDate);
            earlyBirdDeadline.setDate(
              earlyBirdDeadline.getDate() - course.enrollment.earlyBirdDays
            );

            if (new Date(registrationDate) <= earlyBirdDeadline) {
              isEarlyBird = true;
              currentPrice = course.enrollment.earlyBirdPrice;
              earlyBirdSavings = originalPrice - currentPrice;
            }
          }

          return {
            _id: item._id,
            courseId: item.courseId._id,
            courseType: "InPersonAestheticTraining",
            courseTypeDisplay: "In-Person Training",
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",

            // ⭐ ENHANCED: Pricing with early bird and linked course handling
            price: item.enrollmentData.paidAmount || currentPrice,
            originalPrice: item.enrollmentData.originalPrice || originalPrice,
            isEarlyBird: isEarlyBird,
            earlyBirdSavings: earlyBirdSavings,
            isLinkedCourseFree: item.enrollmentData.isLinkedCourseFree || false,

            currency:
              item.enrollmentData.currency ||
              course.enrollment?.currency ||
              "USD",
            startDate: course.schedule?.startDate,
            endDate: course.schedule?.endDate,
            duration: course.schedule?.duration,
            location: `${course.venue?.city || "TBD"}, ${
              course.venue?.country || "TBD"
            }`,
            instructor: course.instructorNames || "Expert Instructors",
            addedToCartAt: item.enrollmentData.registrationDate,

            // ⭐ NEW: Linked course information
            hasLinkedCourse: !!course.linkedCourse?.onlineCourseId,
            linkedCourseId: course.linkedCourse?.onlineCourseId || null,
            linkedCourseRequired: course.linkedCourse?.isRequired || false,
          };
        }) || [];

    // ✅ UPDATED: Online Live Courses in Cart with Linked Course Data
    const liveCartItems =
      user.myLiveCourses
        ?.filter((item) => item.enrollmentData.status === "cart")
        .map((item) => {
          const course = item.courseId;
          const registrationDate =
            item.enrollmentData.registrationDate || new Date();
          const isLinkedCourse =
            item.enrollmentData.isLinkedCourseFree || false;

          let originalPrice = course.enrollment?.price || 0;
          let currentPrice = originalPrice;
          let isEarlyBird = false;
          let earlyBirdSavings = 0;

          // ⭐ ENHANCED: Handle linked course pricing (free) and early bird pricing
          if (isLinkedCourse) {
            currentPrice = 0;
          } else {
            // Check for early bird pricing for non-linked courses
            if (
              course.enrollment?.earlyBirdPrice &&
              course.enrollment?.earlyBirdDays &&
              course.schedule?.startDate
            ) {
              const earlyBirdDeadline = new Date(course.schedule.startDate);
              earlyBirdDeadline.setDate(
                earlyBirdDeadline.getDate() - course.enrollment.earlyBirdDays
              );

              if (new Date(registrationDate) <= earlyBirdDeadline) {
                isEarlyBird = true;
                currentPrice = course.enrollment.earlyBirdPrice;
                earlyBirdSavings = originalPrice - currentPrice;
              }
            }
          }

          return {
            _id: item._id,
            courseId: item.courseId._id,
            courseType: "OnlineLiveTraining",
            courseTypeDisplay: isLinkedCourse
              ? "Online Live (Included)"
              : "Online Live Training",
            displayType: isLinkedCourse
              ? "Online Live (Included)"
              : "Online Live",
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",

            // ⭐ ENHANCED: Pricing with linked course, early bird, and original price tracking
            price: item.enrollmentData.paidAmount || currentPrice,
            originalPrice: item.enrollmentData.originalPrice || originalPrice,
            isEarlyBird: isEarlyBird && !isLinkedCourse,
            earlyBirdSavings: isLinkedCourse ? 0 : earlyBirdSavings,
            isLinkedCourseFree: isLinkedCourse,

            currency:
              item.enrollmentData.currency ||
              course.enrollment?.currency ||
              "USD",
            startDate: course.schedule?.startDate,
            endDate: course.schedule?.endDate,
            duration: course.schedule?.duration,
            location: "Online",
            instructor: course.instructorNames || "Expert Instructors",
            addedToCartAt: item.enrollmentData.registrationDate,

            // ⭐ NEW: Linked course relationship information
            isLinkedToInPerson: isLinkedCourse,
            linkedCourseRelationship: isLinkedCourse ? "prerequisite" : null,
          };
        }) || [];

    // ✅ UPDATED: Self-Paced Courses in Cart
    const selfPacedCartItems =
      user.mySelfPacedCourses
        ?.filter((item) => item.enrollmentData.status === "cart")
        .map((item) => {
          const course = item.courseId;

          return {
            _id: item._id,
            courseId: item.courseId._id,
            courseType: "SelfPacedOnlineTraining",
            courseTypeDisplay: "Self-Paced Online Training",
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",

            // ⭐ ENHANCED: Pricing (self-paced courses don't have early bird or linked pricing)
            price: item.enrollmentData.paidAmount || course.access?.price || 0,
            originalPrice:
              item.enrollmentData.originalPrice || course.access?.price || 0,
            isEarlyBird: false,
            earlyBirdSavings: 0,
            isLinkedCourseFree: false,

            currency:
              item.enrollmentData.currency || course.access?.currency || "USD",
            duration: course.content?.totalDuration || "Self-paced",
            location: "Online - Self-Paced",
            instructor: course.instructorNames || "Expert Instructors",
            addedToCartAt: item.enrollmentData.registrationDate,
            accessDuration: course.access?.duration,
          };
        }) || [];

    // ✅ UPDATED: Combine and send enhanced cart data
    const allCartItems = [
      ...inPersonCartItems,
      ...liveCartItems,
      ...selfPacedCartItems,
    ];

    // Calculate enhanced totals
    const totals = allCartItems.reduce(
      (acc, item) => {
        acc.subtotal += item.originalPrice || 0;
        acc.currentTotal += item.price || 0;
        acc.earlyBirdSavings += item.earlyBirdSavings || 0;
        acc.linkedCourseSavings += item.isLinkedCourseFree
          ? item.originalPrice || 0
          : 0;
        acc.totalSavings += (item.originalPrice || 0) - (item.price || 0);
        return acc;
      },
      {
        subtotal: 0,
        currentTotal: 0,
        earlyBirdSavings: 0,
        linkedCourseSavings: 0,
        totalSavings: 0,
      }
    );

    console.log(`✅ Retrieved ${allCartItems.length} cart items:`, {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length,
      subtotal: totals.subtotal,
      currentTotal: totals.currentTotal,
      earlyBirdSavings: totals.earlyBirdSavings,
      linkedCourseSavings: totals.linkedCourseSavings,
      totalSavings: totals.totalSavings,
    });

    res.json({
      success: true,
      cartItems: allCartItems,
      summary: {
        itemCount: allCartItems.length,
        subtotal: totals.subtotal,
        currentTotal: totals.currentTotal,
        earlyBirdSavings: totals.earlyBirdSavings,
        linkedCourseSavings: totals.linkedCourseSavings,
        totalSavings: totals.totalSavings,
        currency: allCartItems.length > 0 ? allCartItems[0].currency : "USD",
        hasDiscounts: totals.totalSavings > 0,
        hasLinkedCourses: allCartItems.some((item) => item.isLinkedCourseFree),
        hasEarlyBirdDiscounts: totals.earlyBirdSavings > 0,
      },
      breakdown: {
        inPersonCourses: {
          count: inPersonCartItems.length,
          total: inPersonCartItems.reduce(
            (sum, item) => sum + (item.price || 0),
            0
          ),
          hasLinkedCourses: inPersonCartItems.some(
            (item) => item.hasLinkedCourse
          ),
        },
        onlineLiveCourses: {
          count: liveCartItems.length,
          total: liveCartItems.reduce(
            (sum, item) => sum + (item.price || 0),
            0
          ),
          linkedCoursesCount: liveCartItems.filter(
            (item) => item.isLinkedCourseFree
          ).length,
          paidCoursesCount: liveCartItems.filter(
            (item) => !item.isLinkedCourseFree
          ).length,
        },
        selfPacedCourses: {
          count: selfPacedCartItems.length,
          total: selfPacedCartItems.reduce(
            (sum, item) => sum + (item.price || 0),
            0
          ),
        },
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

// Get Wishlist Items (unchanged, but included for completeness)
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

    // Collect all wishlist items (similar structure as before)
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
