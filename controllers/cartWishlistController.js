// controllers/cartWishlistController.js - FULLY ALIGNED WITH LINKED COURSES
const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");

// Add this helper function at the top of the file
function determineEnrollmentType(
  courseType,
  originalPrice,
  isLinkedCourse,
  certificateRequested,
  earlyBirdApplied = false
) {
  if (isLinkedCourse) {
    return "linked_free";
  }

  if (courseType === "OnlineLiveTraining" && originalPrice === 0) {
    return certificateRequested
      ? "free_with_certificate"
      : "free_no_certificate";
  }

  if (originalPrice > 0) {
    return earlyBirdApplied ? "paid_early_bird" : "paid_regular";
  }

  return "free_no_certificate";
}

// ✅ ENHANCED: Helper function to create enrollment object with linked course support
// ✅ FIXED: Keep this function but make it work properly
// ✅ ENHANCED: Helper function to create enrollment object with certificate support
function createEnrollmentObject(
  courseType,
  course,
  status = "cart",
  isLinkedCourse = false,
  wantsCertificate = false
) {
  console.log("🏗️ Creating enrollment object:", {
    courseType,
    status,
    courseId: course._id,
    isLinkedCourse: isLinkedCourse,
    wantsCertificate: wantsCertificate,
  });

  // Initialize pricing variables
  let originalPrice = 0;
  let finalPrice = 0;
  let certificateRequested = false;
  let certificateFee = 0;

  // Set initial pricing based on course type
  if (courseType === "SelfPacedOnlineTraining") {
    originalPrice = course.access?.price || 0;
    finalPrice = originalPrice;
  } else {
    originalPrice = course.enrollment?.price || 0;
    finalPrice = originalPrice;
  }

  // Handle certificate for free online live courses
  if (
    courseType === "OnlineLiveTraining" &&
    originalPrice === 0 &&
    wantsCertificate === true &&
    !isLinkedCourse
  ) {
    finalPrice = 10;
    certificateRequested = true;
    certificateFee = 10;
    console.log("💰 Certificate fee added: €10");
  }

  const baseEnrollment = {
    courseId: course._id,
    enrollmentData: {
      status: status,
      registrationDate: new Date(),
      paidAmount: isLinkedCourse ? 0 : finalPrice,
      paymentTransactionId: null,
      promoCodeUsed: null,
      courseName: course.basic?.title || course.title || "Untitled Course",
      courseCode: course.basic?.courseCode || "N/A",
      courseType: courseType,
      isLinkedCourse: isLinkedCourse,
      isLinkedCourseFree: isLinkedCourse,
      originalPrice: originalPrice,
      currency:
        courseType === "SelfPacedOnlineTraining"
          ? course.access?.currency || "EUR"
          : course.enrollment?.currency || "EUR",

      // Certificate fields
      certificateRequested: isLinkedCourse ? false : certificateRequested,
      certificateFee: isLinkedCourse ? 0 : certificateFee,
      enrollmentType: determineEnrollmentType(
        courseType,
        originalPrice,
        isLinkedCourse,
        certificateRequested
      ),

      // ⭐ ADD: Pricing breakdown
      pricingBreakdown: {
        baseCoursePrice: originalPrice,
        certificatePrice: isLinkedCourse ? 0 : certificateFee,
        earlyBirdDiscount: 0,
        finalPrice: isLinkedCourse ? 0 : finalPrice,
        isFreeBase: originalPrice === 0,
        certificateIncluded: originalPrice > 0,
        payingForCertificateOnly: originalPrice === 0 && certificateFee > 0,
      },
      earlyBirdApplied: false,
      earlyBirdSavings: 0,
    },
  };

  console.log("✅ Created enrollment object:", {
    courseId: baseEnrollment.courseId,
    status: baseEnrollment.enrollmentData.status,
    price: baseEnrollment.enrollmentData.paidAmount,
    originalPrice: baseEnrollment.enrollmentData.originalPrice,
    certificateRequested: baseEnrollment.enrollmentData.certificateRequested,
    certificateFee: baseEnrollment.enrollmentData.certificateFee,
    isLinkedCourseFree: baseEnrollment.enrollmentData.isLinkedCourseFree,
  });

  return baseEnrollment;
}

// ✅ ENHANCED: Add to Cart with full linked course support
// ✅ COMPLETE FIX: Replace the entire addToCart method in cartWishlistController.js
// ✅ COMPLETE FIX: Replace the entire addToCart method in cartWishlistController.js
exports.addToCart = async (req, res) => {
  try {
    console.log("🛒 Add to cart request received");
    console.log("📝 Request body:", req.body);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please log in to add courses to cart",
      });
    }

    const { courseId, courseType, wantsCertificate } = req.body;

    if (!courseId || !courseType) {
      console.log("❌ Missing required fields:", { courseId, courseType });
      return res.status(400).json({
        success: false,
        message: "Course ID and course type are required",
      });
    }

    const COURSE_MAPPINGS = {
      InPersonAestheticTraining: {
        userField: "myInPersonCourses",
        model: InPersonAestheticTraining,
      },
      OnlineLiveTraining: {
        userField: "myLiveCourses",
        model: OnlineLiveTraining,
      },
      SelfPacedOnlineTraining: {
        userField: "mySelfPacedCourses",
        model: SelfPacedOnlineTraining,
      },
    };

    const courseMapping = COURSE_MAPPINGS[courseType];
    if (!courseMapping) {
      console.log("❌ Invalid course type:", courseType);
      return res.status(400).json({
        success: false,
        message: "Invalid course type",
      });
    }

    // ⭐ ENHANCED: Fetch course with linked course population
    let course;
    if (courseType === "InPersonAestheticTraining") {
      course = await courseMapping.model
        .findById(courseId)
        .populate("linkedCourse.onlineCourseId");
    } else {
      course = await courseMapping.model.findById(courseId);
    }

    if (!course) {
      console.log("❌ Course not found:", courseId);
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    console.log("📚 Found course:", {
      id: course._id,
      title: course.basic?.title || course.title,
      price:
        courseType === "SelfPacedOnlineTraining"
          ? course.access?.price
          : course.enrollment?.price,
      hasLinkedCourse: !!course.linkedCourse?.onlineCourseId,
      wantsCertificate: wantsCertificate,
    });

    // Validate course availability (keep existing validation)
    if (courseType === "InPersonAestheticTraining") {
      if (course.basic?.status !== "open") {
        return res.status(400).json({
          success: false,
          message: "This course is not open for registration",
        });
      }
      if (course.enrollment?.seatsAvailable <= 0) {
        return res.status(400).json({
          success: false,
          message: "This course is full",
        });
      }
    } else if (courseType === "OnlineLiveTraining") {
      if (course.basic?.status === "cancelled") {
        return res.status(400).json({
          success: false,
          message: "This course has been cancelled",
        });
      }
      if (
        course.schedule?.startDate &&
        new Date(course.schedule.startDate) <= new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "This course has already started",
        });
      }
    } else if (courseType === "SelfPacedOnlineTraining") {
      if (course.basic?.status !== "published") {
        return res.status(400).json({
          success: false,
          message: "This course is not available for enrollment",
        });
      }
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ⭐ ENHANCED: Handle linked course logic
    const coursesToAdd = [];
    const addedCourses = [];

    // 1. Add the main course
    const userCourseArray = user[courseMapping.userField];
    if (!userCourseArray) {
      user[courseMapping.userField] = [];
    }

    const existingIndex = user[courseMapping.userField].findIndex(
      (item) => item && item.courseId && item.courseId.toString() === courseId
    );

    if (existingIndex !== -1) {
      const existing = user[courseMapping.userField][existingIndex];

      if (
        ["paid", "registered", "completed"].includes(
          existing.enrollmentData.status
        )
      ) {
        console.log("⚠️ User already enrolled in:", course.basic?.title);
        return res.status(400).json({
          success: false,
          message: "Course(s) already in cart or enrolled",
        });
      }

      if (existing.enrollmentData.status === "cart") {
        console.log("⚠️ Course already in cart:", course.basic?.title);
        return res.status(400).json({
          success: false,
          message: "Course(s) already in cart or enrolled",
        });
      }

      // Update from wishlist to cart
      user[courseMapping.userField][existingIndex].enrollmentData.status =
        "cart";
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.registrationDate = new Date();

      // ⭐ CRITICAL: Handle certificate pricing for existing enrollment
      let finalPrice = 0;
      let originalPrice = 0;

      if (courseType === "SelfPacedOnlineTraining") {
        originalPrice = course.access?.price || 0;
        finalPrice = originalPrice;
      } else {
        originalPrice = course.enrollment?.price || 0;
        finalPrice = originalPrice;
      }

      // ⭐ NEW: Certificate handling for free courses
      if (
        courseType === "OnlineLiveTraining" &&
        originalPrice === 0 &&
        wantsCertificate === true
      ) {
        finalPrice = 10;
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateRequested = true;
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateFee = 10;
        console.log("💰 Certificate fee added for free course: €10");
      } else {
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateRequested = false;
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateFee = 0;
      }

      user[courseMapping.userField][existingIndex].enrollmentData.paidAmount =
        finalPrice;
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.originalPrice = originalPrice;

      // ⭐ ADD THIS NEW SECTION RIGHT HERE:
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.pricingBreakdown = {
        baseCoursePrice: originalPrice,
        certificatePrice:
          user[courseMapping.userField][existingIndex].enrollmentData
            .certificateFee,
        earlyBirdDiscount: 0,
        finalPrice: finalPrice,
        isFreeBase: originalPrice === 0,
        certificateIncluded: originalPrice > 0,
        payingForCertificateOnly:
          originalPrice === 0 &&
          user[courseMapping.userField][existingIndex].enrollmentData
            .certificateFee > 0,
      };
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.earlyBirdApplied = false;
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.earlyBirdSavings = 0;

      addedCourses.push(course.basic?.title || course.title);
    } else {
      // ⭐ CRITICAL FIX: Create new enrollment MANUALLY with all required fields
      let finalPrice = 0;
      let originalPrice = 0;

      if (courseType === "SelfPacedOnlineTraining") {
        originalPrice = course.access?.price || 0;
        finalPrice = originalPrice;
      } else {
        originalPrice = course.enrollment?.price || 0;
        finalPrice = originalPrice;
      }

      // ⭐ NEW: Certificate handling for free courses
      let certificateRequested = false;
      let certificateFee = 0;

      if (
        courseType === "OnlineLiveTraining" &&
        originalPrice === 0 &&
        wantsCertificate === true
      ) {
        finalPrice = 10;
        certificateRequested = true;
        certificateFee = 10;
        console.log("💰 Certificate fee added for free course: €10");
      }

      const newEnrollment = {
        courseId: course._id,
        enrollmentData: {
          status: "cart",
          registrationDate: new Date(),
          paidAmount: finalPrice,
          paymentTransactionId: null,
          promoCodeUsed: null,
          courseName: course.basic?.title || course.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          courseType: courseType,
          isLinkedCourse: false, // ⭐ MAIN COURSE IS NOT LINKED
          isLinkedCourseFree: false, // ⭐ MAIN COURSE IS NOT FREE
          originalPrice: originalPrice,
          currency:
            courseType === "SelfPacedOnlineTraining"
              ? course.access?.currency || "EUR"
              : course.enrollment?.currency || "EUR",

          // ⭐ NEW: Certificate fields
          certificateRequested: certificateRequested,
          certificateFee: certificateFee,
          enrollmentType: determineEnrollmentType(
            courseType,
            originalPrice,
            false,
            certificateRequested
          ),

          // ⭐ FIX: Add correct pricingBreakdown
          pricingBreakdown: {
            baseCoursePrice: originalPrice,
            certificatePrice: certificateFee,
            earlyBirdDiscount: 0,
            finalPrice: finalPrice,
            isFreeBase: originalPrice === 0,
            certificateIncluded: originalPrice > 0, // true for paid courses
            payingForCertificateOnly: originalPrice === 0 && certificateFee > 0,
          },
          earlyBirdApplied: false,
          earlyBirdSavings: 0,
        },
      };

      user[courseMapping.userField].push(newEnrollment);
      addedCourses.push(course.basic?.title || course.title);

      console.log("➕ Created main course enrollment:", {
        courseId: newEnrollment.courseId,
        status: newEnrollment.enrollmentData.status,
        price: newEnrollment.enrollmentData.paidAmount,
        originalPrice: newEnrollment.enrollmentData.originalPrice,
        certificateRequested: newEnrollment.enrollmentData.certificateRequested,
        certificateFee: newEnrollment.enrollmentData.certificateFee,
        isLinkedCourseFree: newEnrollment.enrollmentData.isLinkedCourseFree,
      });
    }

    // 2. ⭐ ENHANCED: Add linked course if required
    if (
      courseType === "InPersonAestheticTraining" &&
      course.linkedCourse?.onlineCourseId &&
      course.linkedCourse?.isRequired
    ) {
      const linkedCourse = course.linkedCourse.onlineCourseId;
      console.log(
        "🔗 Found required linked online course:",
        linkedCourse.basic?.title
      );

      // Check if user already has the linked course
      const hasLinkedCourse = user.myLiveCourses?.some(
        (enrollment) =>
          enrollment.courseId.toString() === linkedCourse._id.toString() &&
          ["paid", "registered", "completed", "cart"].includes(
            enrollment.enrollmentData.status
          )
      );

      if (!hasLinkedCourse) {
        // ⭐ CRITICAL FIX: Create linked course enrollment MANUALLY
        const linkedEnrollment = {
          courseId: linkedCourse._id,
          enrollmentData: {
            status: "cart",
            registrationDate: new Date(),
            paidAmount: 0, // ⭐ FREE FOR LINKED COURSES
            paymentTransactionId: null,
            promoCodeUsed: null,
            courseName: linkedCourse.basic?.title || "Untitled Course",
            courseCode: linkedCourse.basic?.courseCode || "N/A",
            courseType: "OnlineLiveTraining",
            isLinkedCourse: true, // ⭐ CRITICAL: THIS IS A LINKED COURSE
            isLinkedCourseFree: true, // ⭐ CRITICAL: THIS COURSE IS FREE
            originalPrice: linkedCourse.enrollment?.price || 0,
            currency: linkedCourse.enrollment?.currency || "EUR",

            // ⭐ NEW: Certificate fields for linked courses (always false)
            certificateRequested: false,
            certificateFee: 0,
            enrollmentType: "linked_free",
          },
        };

        if (!user.myLiveCourses) {
          user.myLiveCourses = [];
        }

        user.myLiveCourses.push(linkedEnrollment);
        addedCourses.push(linkedCourse.basic?.title);

        console.log("➕ Created linked course enrollment:", {
          courseId: linkedEnrollment.courseId,
          status: linkedEnrollment.enrollmentData.status,
          price: linkedEnrollment.enrollmentData.paidAmount,
          isLinkedCourseFree:
            linkedEnrollment.enrollmentData.isLinkedCourseFree,
          isLinkedCourse: linkedEnrollment.enrollmentData.isLinkedCourse,
        });
      }
    }

    if (addedCourses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Course(s) already in cart or enrolled",
      });
    }

    // ⭐ CRITICAL: Save with explicit field specification
    await user.save({ validateBeforeSave: false });

    console.log(
      "💾 User data saved successfully with",
      addedCourses.length,
      "courses"
    );

    let message = "Course added to cart successfully!";
    if (addedCourses.length > 1) {
      message = `${
        addedCourses.length
      } courses added to cart: ${addedCourses.join(" and ")}`;
    }

    // ⭐ FIX: Define the missing responseEnrollmentType variable
    const responseEnrollmentType = determineEnrollmentType(
      courseType,
      course.enrollment?.price || course.access?.price || 0,
      false, // main course is not linked
      wantsCertificate === true
    );
    // ⭐ NEW: Add certificate info to response
    const certificateAdded =
      wantsCertificate === true &&
      courseType === "OnlineLiveTraining" &&
      (course.enrollment?.price || 0) === 0;

    res.json({
      success: true,
      message: message,
      courseTitle: course.basic?.title || course.title || "Course",
      linkedCourseAdded: addedCourses.length > 1,
      coursesAdded: addedCourses,
      certificateAdded: certificateAdded,
      certificateFee: certificateAdded ? 10 : 0,
      enrollmentType: responseEnrollmentType,
    });
  } catch (error) {
    console.error("❌ Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Error adding course to cart",
    });
  }
};

// ✅ ENHANCED: Remove from Cart with linked course handling
exports.removeFromCart = async (req, res) => {
  try {
    const { courseIds } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let removedCount = 0;
    const courseIdsArray = Array.isArray(courseIds) ? courseIds : [courseIds];

    for (const courseId of courseIdsArray) {
      // ⭐ ENHANCED: Check in-person courses (with linked course removal)
      const inPersonIndex = user.myInPersonCourses?.findIndex(
        (item) =>
          item.courseId.toString() === courseId &&
          item.enrollmentData.status === "cart"
      );

      if (inPersonIndex !== -1) {
        // ⭐ ENHANCED: If removing an in-person course, also remove its linked online course
        const linkedCourseIndex = user.myLiveCourses?.findIndex(
          (item) =>
            item.enrollmentData.isLinkedCourseFree === true &&
            item.enrollmentData.status === "cart"
        );

        if (linkedCourseIndex !== -1) {
          user.myLiveCourses.splice(linkedCourseIndex, 1);
          removedCount++;
          console.log(
            `🔗 Also removed linked online course at index ${linkedCourseIndex}`
          );
        }

        user.myInPersonCourses.splice(inPersonIndex, 1);
        removedCount++;
        console.log(
          `✅ Removed in-person course ${courseId} and its linked course`
        );
        continue;
      }

      // ⭐ ENHANCED: Check online live courses (with linked course protection)
      const liveIndex = user.myLiveCourses?.findIndex(
        (item) =>
          item.courseId.toString() === courseId &&
          item.enrollmentData.status === "cart"
      );

      if (liveIndex !== -1) {
        const course = user.myLiveCourses[liveIndex];

        // ⭐ ENHANCED: Prevent removal of linked courses independently
        if (course.enrollmentData.isLinkedCourseFree) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot remove linked course independently. Remove the main in-person course instead.",
          });
        }

        user.myLiveCourses.splice(liveIndex, 1);
        removedCount++;
        console.log(`✅ Removed online course ${courseId}`);
        continue;
      }

      // Check self-paced courses
      const selfPacedIndex = user.mySelfPacedCourses?.findIndex(
        (item) =>
          item.courseId.toString() === courseId &&
          item.enrollmentData.status === "cart"
      );

      if (selfPacedIndex !== -1) {
        user.mySelfPacedCourses.splice(selfPacedIndex, 1);
        removedCount++;
        console.log(`✅ Removed self-paced course ${courseId}`);
      }
    }

    if (removedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No courses found in cart to remove",
      });
    }

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `${removedCount} course(s) removed from cart`,
      removedCount: removedCount,
    });
  } catch (error) {
    console.error("❌ Error removing from cart:", error);
    res.status(500).json({
      success: false,
      message: "Error removing courses from cart",
    });
  }
};

// ✅ Add to Wishlist (unchanged)
// ✅ Add to Wishlist (updated with certificate support)
exports.addToWishlist = async (req, res) => {
  try {
    console.log("❤️ Add to wishlist request received");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Please log in to add courses to wishlist",
      });
    }

    const { courseId, courseType, wantsCertificate } = req.body;

    if (!courseId || !courseType) {
      return res.status(400).json({
        success: false,
        message: "Course ID and course type are required",
      });
    }

    const COURSE_MAPPINGS = {
      InPersonAestheticTraining: {
        userField: "myInPersonCourses",
        model: InPersonAestheticTraining,
      },
      OnlineLiveTraining: {
        userField: "myLiveCourses",
        model: OnlineLiveTraining,
      },
      SelfPacedOnlineTraining: {
        userField: "mySelfPacedCourses",
        model: SelfPacedOnlineTraining,
      },
    };

    const courseMapping = COURSE_MAPPINGS[courseType];
    if (!courseMapping) {
      return res.status(400).json({
        success: false,
        message: "Invalid course type",
      });
    }

    const course = await courseMapping.model.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userCourseArray = user[courseMapping.userField];

    if (!userCourseArray) {
      user[courseMapping.userField] = [];
    }

    const existingIndex = user[courseMapping.userField].findIndex(
      (item) => item && item.courseId && item.courseId.toString() === courseId
    );

    if (existingIndex !== -1) {
      const existing = user[courseMapping.userField][existingIndex];

      if (
        ["paid", "registered", "completed"].includes(
          existing.enrollmentData.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "You have already enrolled in this course",
        });
      }

      if (existing.enrollmentData.status === "wishlist") {
        return res.status(400).json({
          success: false,
          message: "This course is already in your wishlist",
        });
      }

      // Update to wishlist
      user[courseMapping.userField][existingIndex].enrollmentData.status =
        "wishlist";
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.registrationDate = new Date();

      // ⭐ NEW: Handle certificate pricing for wishlist
      let finalPrice = 0;
      let originalPrice = 0;

      if (courseType === "SelfPacedOnlineTraining") {
        originalPrice = course.access?.price || 0;
        finalPrice = originalPrice;
      } else {
        originalPrice = course.enrollment?.price || 0;
        finalPrice = originalPrice;
      }

      // Certificate handling for free online live courses
      if (
        courseType === "OnlineLiveTraining" &&
        originalPrice === 0 &&
        wantsCertificate === true
      ) {
        finalPrice = 10;
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateRequested = true;
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateFee = 10;
      } else {
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateRequested = false;
        user[courseMapping.userField][
          existingIndex
        ].enrollmentData.certificateFee = 0;
      }

      user[courseMapping.userField][existingIndex].enrollmentData.paidAmount =
        finalPrice;
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.originalPrice = originalPrice;
      // ⭐ ADD THIS LINE:
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.enrollmentType = determineEnrollmentType(
        courseType,
        originalPrice,
        false,
        wantsCertificate === true
      );

      // ⭐ ADD THIS NEW SECTION RIGHT HERE:
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.pricingBreakdown = {
        baseCoursePrice: originalPrice,
        certificatePrice:
          user[courseMapping.userField][existingIndex].enrollmentData
            .certificateFee,
        earlyBirdDiscount: 0,
        finalPrice: finalPrice,
        isFreeBase: originalPrice === 0,
        certificateIncluded: originalPrice > 0,
        payingForCertificateOnly:
          originalPrice === 0 &&
          user[courseMapping.userField][existingIndex].enrollmentData
            .certificateFee > 0,
      };
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.earlyBirdApplied = false;
      user[courseMapping.userField][
        existingIndex
      ].enrollmentData.earlyBirdSavings = 0;
    } else {
      // ⭐ UPDATED: Use enhanced createEnrollmentObject with certificate support
      const newEnrollment = createEnrollmentObject(
        courseType,
        course,
        "wishlist",
        false, // not linked course
        wantsCertificate === true // certificate preference
      );
      user[courseMapping.userField].push(newEnrollment);
    }

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: "Course added to wishlist successfully!",
      courseTitle: course.basic?.title || course.title || "Course",
    });
  } catch (error) {
    console.error("❌ Error adding to wishlist:", error);
    res.status(500).json({
      success: false,
      message: "Error adding course to wishlist",
    });
  }
};

// ✅ Remove from Wishlist (unchanged)
exports.removeFromWishlist = async (req, res) => {
  try {
    const { courseId, courseType, wantsCertificate } = req.body;
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

    courseArray.splice(courseIndex, 1);
    await user.save({ validateBeforeSave: false });

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
};

// ✅ Get Wishlist Items (JSON API)
exports.getWishlistItems = async (req, res) => {
  try {
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

    let wishlistItems = [];

    // Process wishlist items (similar to existing logic)
    // ... existing wishlist processing code ...

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
};
