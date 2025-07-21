// controllers/ordersController.js -
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

/**
 * Helper function to calculate early bird pricing for a course
 * IMPORTANT: Early bird pricing ONLY applies to InPerson and OnlineLive courses
 * Self-paced courses do NOT have early bird pricing
 *
 * @param {Object} course - The course object (InPerson, OnlineLive, or SelfPaced)
 * @param {Date} registrationDate - When the user registered/added to cart
 * @returns {Object} Pricing information with early bird details
 */
function calculateCoursePricing(course, registrationDate = new Date()) {
  const pricing = {
    regularPrice: 0,
    earlyBirdPrice: null,
    currentPrice: 0,
    isEarlyBird: false,
    earlyBirdSavings: 0,
    currency: "USD",
  };

  // ✅ FOR IN-PERSON & ONLINE LIVE COURSES (have early bird pricing)
  if (course.enrollment) {
    // Main price from InPersonAestheticTraining.enrollment.price or OnlineLiveTraining.enrollment.price
    pricing.regularPrice = course.enrollment.price || 0;

    // Early bird price (may be null if not set)
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
      // No early bird pricing available or conditions not met
      pricing.currentPrice = pricing.regularPrice;
    }
  }
  // ✅ FOR SELF-PACED COURSES (NO early bird pricing)
  else if (course.access) {
    // Main price from SelfPacedOnlineTraining.access.price
    pricing.regularPrice = course.access.price || 0;
    pricing.currentPrice = pricing.regularPrice;
    pricing.currency = course.access.currency || "USD";

    // Self-paced courses NEVER have early bird pricing
    pricing.earlyBirdPrice = null;
    pricing.isEarlyBird = false;
    pricing.earlyBirdSavings = 0;
  }

  return pricing;
}

/**
 * Display cart page with early bird pricing support
 */
exports.getCartPage = async (req, res) => {
  try {
    console.log("🔍 Fetching user cart data with early bird pricing...");

    // Populate course details for cart items
    const user = await User.findById(req.user._id)
      .populate({
        path: "myInPersonCourses.courseId",
        select: "basic enrollment schedule venue",
      })
      .populate({
        path: "myLiveCourses.courseId",
        select: "basic enrollment schedule platform",
      })
      .populate({
        path: "mySelfPacedCourses.courseId",
        select: "basic access content",
      })
      .lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    // Initialize cart items array
    const cartItems = [];

    // ✅ Process In-Person Courses with status = 'cart' (CAN have early bird)
    if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
      user.myInPersonCourses.forEach((enrollment) => {
        if (
          enrollment.enrollmentData?.status === "cart" &&
          enrollment.courseId
        ) {
          const course = enrollment.courseId;
          const registrationDate = enrollment.enrollmentData.registrationDate;

          // Calculate pricing with early bird logic
          const pricing = calculateCoursePricing(course, registrationDate);

          // ✅ FIX: Use calculated current price, not stored paidAmount
          const finalPrice = pricing.currentPrice;

          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            price: finalPrice,
            originalPrice: pricing.regularPrice,
            isEarlyBird: pricing.isEarlyBird,
            earlyBirdSavings: pricing.earlyBirdSavings,
            currency: pricing.currency,
            courseType: "InPersonAestheticTraining",
            displayType: "In-Person",
            status: "In Cart",
            addedDate: registrationDate,
            // Additional course info for display
            startDate: course.schedule?.startDate,
            location: course.venue?.name || course.venue?.city,
            // Early bird info for display
            earlyBirdDeadline:
              course.enrollment?.earlyBirdDays && course.schedule?.startDate
                ? (() => {
                    const deadline = new Date(course.schedule.startDate);
                    deadline.setDate(
                      deadline.getDate() - course.enrollment.earlyBirdDays
                    );
                    return deadline;
                  })()
                : null,
          });
        }
      });
    }

    // ✅ Process Online Live Courses with status = 'cart' (CAN have early bird)
    if (user.myLiveCourses && user.myLiveCourses.length > 0) {
      user.myLiveCourses.forEach((enrollment) => {
        if (
          enrollment.enrollmentData?.status === "cart" &&
          enrollment.courseId
        ) {
          const course = enrollment.courseId;
          const registrationDate = enrollment.enrollmentData.registrationDate;

          // Calculate pricing with early bird logic
          const pricing = calculateCoursePricing(course, registrationDate);

          // ✅ FIX: Use calculated current price, not stored paidAmount
          const finalPrice = pricing.currentPrice;

          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            price: finalPrice,
            originalPrice: pricing.regularPrice,
            isEarlyBird: pricing.isEarlyBird,
            earlyBirdSavings: pricing.earlyBirdSavings,
            currency: pricing.currency,
            courseType: "OnlineLiveTraining",
            displayType: "Online Live",
            status: "In Cart",
            addedDate: registrationDate,
            // Additional course info
            startDate: course.schedule?.startDate,
            platform: course.platform?.name,
            // Early bird info for display
            earlyBirdDeadline:
              course.enrollment?.earlyBirdDays && course.schedule?.startDate
                ? (() => {
                    const deadline = new Date(course.schedule.startDate);
                    deadline.setDate(
                      deadline.getDate() - course.enrollment.earlyBirdDays
                    );
                    return deadline;
                  })()
                : null,
          });
        }
      });
    }

    // ✅ Process Self-Paced Courses with status = 'cart' (NO early bird pricing)
    if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
      user.mySelfPacedCourses.forEach((enrollment) => {
        if (
          enrollment.enrollmentData?.status === "cart" &&
          enrollment.courseId
        ) {
          const course = enrollment.courseId;
          const registrationDate = enrollment.enrollmentData.registrationDate;

          // Calculate pricing (no early bird for self-paced)
          const pricing = calculateCoursePricing(course, registrationDate);

          // ✅ FIX: Use calculated current price, not stored paidAmount
          const finalPrice = pricing.currentPrice;

          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            price: finalPrice,
            originalPrice: pricing.regularPrice,
            isEarlyBird: false, // Always false for self-paced
            earlyBirdSavings: 0, // Always 0 for self-paced
            currency: pricing.currency,
            courseType: "SelfPacedOnlineTraining",
            displayType: "Self-Paced",
            status: "In Cart",
            addedDate: registrationDate,
            // Additional course info
            accessDays: course.access?.accessDays,
            totalVideos: course.videos?.length || 0,
            earlyBirdDeadline: null, // No early bird for self-paced
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

    console.log(`\n📍 Cart Summary: ${cartItems.length} items`);
    cartItems.forEach((item, index) => {
      const earlyBirdInfo = item.isEarlyBird
        ? ` (Early Bird: $${item.earlyBirdSavings} savings)`
        : "";
      console.log(
        `Item ${index + 1}: ${item.title} - $${item.price}${earlyBirdInfo}`
      );
    });

    // ✅ Calculate total price and total savings
    const totalAmount = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.price) || 0);
    }, 0);

    const totalSavings = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.earlyBirdSavings) || 0);
    }, 0);

    const totalOriginalPrice = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.originalPrice) || 0);
    }, 0);

    console.log(`\n💰 Pricing Summary:`);
    console.log(`   Original Total: $${totalOriginalPrice.toFixed(2)}`);
    console.log(`   Early Bird Savings: $${totalSavings.toFixed(2)}`);
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

/**
 * Display checkout page with early bird pricing
 */
exports.checkout = async (req, res) => {
  try {
    console.log("🔍 Loading checkout page with early bird pricing...");
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    const coursesInCart = [];
    let totalPrice = 0;
    let totalSavings = 0;
    let totalOriginalPrice = 0;

    // Process In-Person Courses (CAN have early bird)
    const inPersonCartItems =
      user.myInPersonCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(
        item.courseId
      ).lean();
      if (course) {
        const registrationDate = item.enrollmentData.registrationDate;
        const pricing = calculateCoursePricing(course, registrationDate);

        // ✅ FIX: Use calculated current price, not stored paidAmount
        const finalPrice = pricing.currentPrice;

        coursesInCart.push({
          courseId: item.courseId,
          enrollmentId: item._id,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: finalPrice,
          originalPrice: pricing.regularPrice,
          isEarlyBird: pricing.isEarlyBird,
          earlyBirdSavings: pricing.earlyBirdSavings,
          currency: pricing.currency,
          courseType: "In-Person",
          status: item.enrollmentData.status,
          startDate: course.schedule?.startDate || null,
          registrationDate: registrationDate,
        });

        totalPrice += finalPrice;
        totalSavings += pricing.earlyBirdSavings;
        totalOriginalPrice += pricing.regularPrice;
      }
    }

    // Process Online Live Courses (CAN have early bird)
    const liveCartItems =
      user.myLiveCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId).lean();
      if (course) {
        const registrationDate = item.enrollmentData.registrationDate;
        const pricing = calculateCoursePricing(course, registrationDate);

        // ✅ FIX: Use calculated current price, not stored paidAmount
        const finalPrice = pricing.currentPrice;

        coursesInCart.push({
          courseId: item.courseId,
          enrollmentId: item._id,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: finalPrice,
          originalPrice: pricing.regularPrice,
          isEarlyBird: pricing.isEarlyBird,
          earlyBirdSavings: pricing.earlyBirdSavings,
          currency: pricing.currency,
          courseType: "Online Live",
          status: item.enrollmentData.status,
          startDate: course.schedule?.startDate || null,
          registrationDate: registrationDate,
        });

        totalPrice += finalPrice;
        totalSavings += pricing.earlyBirdSavings;
        totalOriginalPrice += pricing.regularPrice;
      }
    }

    // Process Self-Paced Courses (NO early bird pricing)
    const selfPacedCartItems =
      user.mySelfPacedCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(
        item.courseId
      ).lean();
      if (course) {
        const registrationDate = item.enrollmentData.registrationDate;
        const pricing = calculateCoursePricing(course, registrationDate);

        // ✅ FIX: Use calculated current price, not stored paidAmount
        const finalPrice = pricing.currentPrice;

        coursesInCart.push({
          courseId: item.courseId,
          enrollmentId: item._id,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: finalPrice,
          originalPrice: pricing.regularPrice,
          isEarlyBird: false, // Always false for self-paced
          earlyBirdSavings: 0, // Always 0 for self-paced
          currency: pricing.currency,
          courseType: "Self-Paced",
          status: item.enrollmentData.status,
          startDate: null,
          registrationDate: registrationDate,
        });

        totalPrice += finalPrice;
        totalOriginalPrice += pricing.regularPrice;
        // No savings added for self-paced courses
      }
    }

    console.log(`📋 Checkout Summary: ${coursesInCart.length} items`);
    console.log(`💰 Original Total: $${totalOriginalPrice.toFixed(2)}`);
    console.log(`🎯 Early Bird Savings: $${totalSavings.toFixed(2)}`);
    console.log(`💳 Final Total: $${totalPrice.toFixed(2)}`);

    res.render("checkout", {
      coursesInCart: coursesInCart,
      totalPrice: totalPrice,
      totalSavings: totalSavings.toFixed(2),
      totalOriginalPrice: totalOriginalPrice.toFixed(2),
      hasEarlyBirdDiscounts: totalSavings > 0,
      user: user,
      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page: " + err.message);
  }
};

/**
 * ✅ IMPROVED: Remove courses using search approach - no course type needed
 * Searches through all three course folders to find and remove courses
 */
exports.removeFromCart = async (req, res) => {
  const { courseIds } = req.body;
  const userId = req.user._id;

  try {
    console.log("🗑️ Course IDs to remove:", courseIds);

    if (!courseIds || courseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No courses selected to remove.",
      });
    }

    // Ensure courseIds is an array
    const courseIdArray = Array.isArray(courseIds) ? courseIds : [courseIds];

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let removedCount = 0;
    const removalResults = [];

    // ✅ SEARCH AND REMOVE APPROACH
    courseIdArray.forEach((courseIdToRemove) => {
      let found = false;
      let location = "";

      // 1. Search in myInPersonCourses
      if (!found) {
        const index = user.myInPersonCourses.findIndex(
          (enrollment) =>
            enrollment.courseId.toString() === courseIdToRemove &&
            enrollment.enrollmentData.status === "cart"
        );

        if (index !== -1) {
          user.myInPersonCourses.splice(index, 1);
          found = true;
          location = "myInPersonCourses";
          removedCount++;
          console.log(
            `✅ Found and removed course ${courseIdToRemove} from ${location} at index ${index}`
          );
        }
      }

      // 2. Search in myLiveCourses
      if (!found) {
        const index = user.myLiveCourses.findIndex(
          (enrollment) =>
            enrollment.courseId.toString() === courseIdToRemove &&
            enrollment.enrollmentData.status === "cart"
        );

        if (index !== -1) {
          user.myLiveCourses.splice(index, 1);
          found = true;
          location = "myLiveCourses";
          removedCount++;
          console.log(
            `✅ Found and removed course ${courseIdToRemove} from ${location} at index ${index}`
          );
        }
      }

      // 3. Search in mySelfPacedCourses
      if (!found) {
        const index = user.mySelfPacedCourses.findIndex(
          (enrollment) =>
            enrollment.courseId.toString() === courseIdToRemove &&
            enrollment.enrollmentData.status === "cart"
        );

        if (index !== -1) {
          user.mySelfPacedCourses.splice(index, 1);
          found = true;
          location = "mySelfPacedCourses";
          removedCount++;
          console.log(
            `✅ Found and removed course ${courseIdToRemove} from ${location} at index ${index}`
          );
        }
      }

      // Track results
      removalResults.push({
        courseId: courseIdToRemove,
        found: found,
        location: location || "not found",
      });

      if (!found) {
        console.log(
          `⚠️ Course ${courseIdToRemove} not found in any cart folder or not in cart status`
        );
      }
    });

    // Save the updated user
    await user.save();

    // Log detailed results
    console.log(`✅ Removal Summary:`);
    console.log(`   Total courses processed: ${courseIdArray.length}`);
    console.log(`   Total courses removed: ${removedCount}`);
    console.log(`   Detailed results:`, removalResults);

    if (removedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "No matching courses found in cart to remove",
        details: removalResults,
      });
    }

    res.json({
      success: true,
      message: `${removedCount} course${
        removedCount !== 1 ? "s" : ""
      } removed from cart`,
      removedCount: removedCount,
      details: removalResults,
    });
  } catch (err) {
    console.error("❌ Error removing courses from cart:", err);
    res.status(500).json({
      success: false,
      message: "Error removing courses from cart",
      error: err.message,
    });
  }
};
//......
async function updateCartPricing(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    let hasUpdates = false;

    // Update In-Person course pricing (CAN have early bird)
    for (let enrollment of user.myInPersonCourses) {
      if (enrollment.enrollmentData.status === "cart") {
        const course = await InPersonAestheticTraining.findById(
          enrollment.courseId
        );
        if (course) {
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate
          );
          if (enrollment.enrollmentData.paidAmount !== pricing.currentPrice) {
            enrollment.enrollmentData.paidAmount = pricing.currentPrice;
            hasUpdates = true;
          }
        }
      }
    }

    // Update Online Live course pricing (CAN have early bird)
    for (let enrollment of user.myLiveCourses) {
      if (enrollment.enrollmentData.status === "cart") {
        const course = await OnlineLiveTraining.findById(enrollment.courseId);
        if (course) {
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate
          );
          if (enrollment.enrollmentData.paidAmount !== pricing.currentPrice) {
            enrollment.enrollmentData.paidAmount = pricing.currentPrice;
            hasUpdates = true;
          }
        }
      }
    }

    // Self-paced courses don't need price updates (no early bird pricing)

    if (hasUpdates) {
      await user.save();
      console.log(`✅ Updated cart pricing for user ${userId}`);
    }
  } catch (error) {
    console.error("❌ Error updating cart pricing:", error);
  }
}

// Export the helper functions for use in other parts of the application
exports.updateCartPricing = updateCartPricing;
exports.calculateCoursePricing = calculateCoursePricing;
