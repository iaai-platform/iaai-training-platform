// controllers/ordersController.js - DISPLAY ORDERS PAGE ONLY (Enhanced for linked courses)
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

/**
 * ⭐ ENHANCED: Helper function to calculate pricing with linked course support
 */
function calculateCoursePricing(
  course,
  registrationDate = new Date(),
  isLinkedCourse = false
) {
  const pricing = {
    regularPrice: 0,
    earlyBirdPrice: null,
    currentPrice: 0,
    isEarlyBird: false,
    earlyBirdSavings: 0,
    currency: "USD",
    isLinkedCourseFree: isLinkedCourse,
  };

  // ⭐ NEW: If this is a linked course, set price to 0
  if (isLinkedCourse) {
    if (course.enrollment) {
      pricing.regularPrice = course.enrollment.price || 0;
      pricing.currency = course.enrollment.currency || "USD";
    } else if (course.access) {
      pricing.regularPrice = course.access.price || 0;
      pricing.currency = course.access.currency || "USD";
    }
    pricing.currentPrice = 0; // Free for linked courses
    return pricing;
  }

  // ✅ FOR IN-PERSON & ONLINE LIVE COURSES (have early bird pricing)
  if (course.enrollment) {
    pricing.regularPrice = course.enrollment.price || 0;
    pricing.earlyBirdPrice = course.enrollment.earlyBirdPrice || null;
    pricing.currency = course.enrollment.currency || "USD";

    // Calculate early bird deadline and check eligibility
    if (
      pricing.earlyBirdPrice &&
      pricing.earlyBirdPrice > 0 &&
      course.enrollment.earlyBirdDays &&
      course.schedule?.startDate
    ) {
      const earlyBirdDeadline = new Date(course.schedule.startDate);
      earlyBirdDeadline.setDate(
        earlyBirdDeadline.getDate() - course.enrollment.earlyBirdDays
      );

      // Check if registration date qualifies for early bird pricing
      if (new Date(registrationDate) <= earlyBirdDeadline) {
        pricing.isEarlyBird = true;
        pricing.currentPrice = pricing.earlyBirdPrice;
        pricing.earlyBirdSavings =
          pricing.regularPrice - pricing.earlyBirdPrice;
      } else {
        pricing.currentPrice = pricing.regularPrice;
      }
    } else {
      pricing.currentPrice = pricing.regularPrice;
    }
  }
  // ✅ FOR SELF-PACED COURSES (NO early bird pricing)
  else if (course.access) {
    pricing.regularPrice = course.access.price || 0;
    pricing.currentPrice = pricing.regularPrice;
    pricing.currency = course.access.currency || "USD";
  }

  return pricing;
}

/**
 * ⭐ ENHANCED: Display orders page with linked course support
 * THIS IS THE ONLY FUNCTION IN THIS CONTROLLER
 */
// controllers/ordersController.js - FIXED getCartPage method
exports.getCartPage = async (req, res) => {
  try {
    console.log("🔍 Fetching user cart data with linked course support...");

    // ⭐ CRITICAL FIX: Use .exec() and proper field selection to ensure we get ALL enrollment data
    // ✅ FIXED: This ensures we get ALL user data including enrollmentData
    const user = await User.findById(req.user._id)
      .populate({
        path: "myInPersonCourses.courseId",
        select: "basic enrollment schedule venue linkedCourse",
        populate: {
          path: "linkedCourse.onlineCourseId",
          select: "basic enrollment schedule",
        },
      })
      .populate({
        path: "myLiveCourses.courseId",
        select: "basic enrollment schedule platform",
      })
      .populate({
        path: "mySelfPacedCourses.courseId",
        select: "basic access content",
      })
      .lean(); // ⭐ CHANGE: Use .lean() instead of .exec() to get raw data

    // ⭐ CRITICAL: Add debug logging to see what we actually get
    console.log("🔍 Raw user data for debugging:");
    if (user.myLiveCourses) {
      user.myLiveCourses.forEach((enrollment, index) => {
        if (enrollment.enrollmentData?.status === "cart") {
          console.log(`📦 Live Course ${index}:`);
          console.log(`   - Course ID: ${enrollment.courseId}`);
          console.log(`   - Status: ${enrollment.enrollmentData.status}`);
          console.log(
            `   - PaidAmount: ${enrollment.enrollmentData.paidAmount}`
          );
          console.log(
            `   - isLinkedCourseFree: ${enrollment.enrollmentData.isLinkedCourseFree}`
          );
          console.log(`   - Full enrollmentData:`, enrollment.enrollmentData);
        }
      });
    }

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    const cartItems = [];

    // ✅ Process In-Person Courses
    if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
      user.myInPersonCourses.forEach((enrollment) => {
        if (
          enrollment.enrollmentData?.status === "cart" &&
          enrollment.courseId
        ) {
          const course = enrollment.courseId;
          const registrationDate = enrollment.enrollmentData.registrationDate;

          // ⭐ CRITICAL: Read the flag from the stored enrollment data
          const isLinkedCourse =
            enrollment.enrollmentData.isLinkedCourseFree === true;

          console.log(`🔍 Processing in-person course: ${course.basic?.title}`);
          console.log(`🔗 isLinkedCourseFree flag: ${isLinkedCourse}`);

          const pricing = calculateCoursePricing(
            course,
            registrationDate,
            isLinkedCourse
          );

          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            price: pricing.currentPrice,
            originalPrice: pricing.regularPrice,
            isEarlyBird: pricing.isEarlyBird,
            earlyBirdSavings: pricing.earlyBirdSavings,
            isLinkedCourseFree: pricing.isLinkedCourseFree,
            currency: pricing.currency,
            courseType: "InPersonAestheticTraining",
            displayType: "In-Person",
            status: "cart",
            addedDate: registrationDate,
            startDate: course.schedule?.startDate,
            location: `${course.venue?.city || "TBD"}, ${
              course.venue?.country || "TBD"
            }`,
            hasLinkedCourse: !!course.linkedCourse?.onlineCourseId,
            linkedCourseTitle:
              course.linkedCourse?.onlineCourseId?.basic?.title,
            linkedCourseRequired: course.linkedCourse?.isRequired || false,
          });
        }
      });
    }

    // ✅ FIXED: Process Online Live Courses with proper flag detection
    if (user.myLiveCourses && user.myLiveCourses.length > 0) {
      user.myLiveCourses.forEach((enrollment) => {
        if (
          enrollment.enrollmentData?.status === "cart" &&
          enrollment.courseId
        ) {
          const course = enrollment.courseId;
          const registrationDate = enrollment.enrollmentData.registrationDate;

          // ⭐ CRITICAL FIX: Properly read the flag from enrollment data
          const isLinkedCourse =
            enrollment.enrollmentData.isLinkedCourseFree === true;

          console.log(`🔍 Processing online course: ${course.basic?.title}`);
          console.log(
            `🔗 isLinkedCourseFree flag from DB: ${enrollment.enrollmentData.isLinkedCourseFree}`
          );
          console.log(`🔗 isLinkedCourseFree processed: ${isLinkedCourse}`);
          console.log(
            `💰 Stored paidAmount: ${enrollment.enrollmentData.paidAmount}`
          );

          const pricing = calculateCoursePricing(
            course,
            registrationDate,
            isLinkedCourse
          );

          console.log(`💰 Calculated pricing:`, {
            originalPrice: pricing.regularPrice,
            currentPrice: pricing.currentPrice,
            isLinkedCourseFree: pricing.isLinkedCourseFree,
          });

          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            price: pricing.currentPrice, // ⭐ Should be 0 for linked courses
            originalPrice: pricing.regularPrice,
            isEarlyBird: pricing.isEarlyBird && !isLinkedCourse,
            earlyBirdSavings: isLinkedCourse ? 0 : pricing.earlyBirdSavings,
            isLinkedCourseFree: pricing.isLinkedCourseFree, // ⭐ CRITICAL
            currency: pricing.currency,
            courseType: "OnlineLiveTraining",
            displayType: isLinkedCourse
              ? "Online Live (Included)"
              : "Online Live",
            status: "cart",
            addedDate: registrationDate,
            startDate: course.schedule?.startDate,
            location: "Online",
            isLinkedToInPerson: isLinkedCourse,
            linkedCourseRelationship: isLinkedCourse ? "prerequisite" : null,
          });
        }
      });
    }

    // ✅ Process Self-Paced Courses (unchanged)
    if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
      user.mySelfPacedCourses.forEach((enrollment) => {
        if (
          enrollment.enrollmentData?.status === "cart" &&
          enrollment.courseId
        ) {
          const course = enrollment.courseId;
          const registrationDate = enrollment.enrollmentData.registrationDate;
          const pricing = calculateCoursePricing(course, registrationDate);

          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            price: pricing.currentPrice,
            originalPrice: pricing.regularPrice,
            isEarlyBird: false,
            earlyBirdSavings: 0,
            isLinkedCourseFree: false,
            currency: pricing.currency,
            courseType: "SelfPacedOnlineTraining",
            displayType: "Self-Paced",
            status: "cart",
            addedDate: registrationDate,
            startDate: null,
            location: "Online - Self-Paced",
            accessDays: course.access?.accessDays,
            totalVideos: course.videos?.length || 0,
          });
        }
      });
    }

    // Sort cart items by date added (most recent first)
    cartItems.sort((a, b) => {
      const dateA = new Date(a.addedDate || 0);
      const dateB = new Date(b.addedDate || 0);
      return dateB - dateA;
    });

    // Calculate totals
    const totalAmount = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.price) || 0);
    }, 0);

    const totalSavings = cartItems.reduce((total, item) => {
      if (item.isLinkedCourseFree) {
        return total + (parseFloat(item.originalPrice) || 0);
      } else {
        return total + (parseFloat(item.earlyBirdSavings) || 0);
      }
    }, 0);

    const totalOriginalPrice = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.originalPrice) || 0);
    }, 0);

    console.log(`\n📍 Enhanced Cart Summary: ${cartItems.length} items`);
    cartItems.forEach((item, index) => {
      const savingsInfo = item.isLinkedCourseFree
        ? ` (Linked Course - FREE)`
        : item.isEarlyBird
        ? ` (Early Bird: $${item.earlyBirdSavings} savings)`
        : "";
      console.log(
        `Item ${index + 1}: ${item.title} - $${item.price}${savingsInfo}`
      );
    });

    console.log(`\n💰 Enhanced Pricing Summary:`);
    console.log(`   Original Total: $${totalOriginalPrice.toFixed(2)}`);
    console.log(`   Total Savings: $${totalSavings.toFixed(2)}`);
    console.log(`   Final Total: $${totalAmount.toFixed(2)}`);

    res.render("orders", {
      orders: cartItems,
      totalAmount: totalAmount.toFixed(2),
      totalSavings: totalSavings.toFixed(2),
      totalOriginalPrice: totalOriginalPrice.toFixed(2),
      hasEarlyBirdDiscounts: totalSavings > 0,
      user,
    });
  } catch (err) {
    console.error("❌ Error fetching cart:", err);
    res.status(500).send("Error fetching cart");
  }
};

// ✅ Export only the helper function (for potential use by other controllers)
exports.calculateCoursePricing = calculateCoursePricing;
