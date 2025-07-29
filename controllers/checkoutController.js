// controllers/checkoutController.js - FULLY ALIGNED WITH LINKED COURSES
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const PromoCode = require("../models/promoCode");
const sendEmail = require("../utils/sendEmail");
const { v4: uuidv4 } = require("uuid");

// ✅ CCAvenue utility import
const CCavenueUtils = require("../utils/ccavenueUtils");
const ccavUtil = new CCavenueUtils(process.env.CCAVENUE_WORKING_KEY);

// ✅ ENHANCED: Helper function to calculate pricing with linked course support
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
    isLinkedCourseFree: isLinkedCourse, // ⭐ CRITICAL: Track if this is a free linked course
  };

  // ⭐ ENHANCED: If this is a linked course, set price to 0
  if (isLinkedCourse) {
    if (course.enrollment) {
      pricing.regularPrice = course.enrollment.price || 0;
      pricing.currency = course.enrollment.currency || "USD";
    } else if (course.access) {
      pricing.regularPrice = course.access.price || 0;
      pricing.currency = course.access.currency || "USD";
    }
    pricing.currentPrice = 0; // Free for linked courses
    console.log(
      "🔗 Linked course pricing set to FREE, original:",
      pricing.regularPrice
    );
    return pricing;
  }

  // Rest of the existing pricing logic for non-linked courses
  if (course.enrollment) {
    // For InPerson and OnlineLive courses
    pricing.regularPrice = course.enrollment.price || 0;
    pricing.earlyBirdPrice = course.enrollment.earlyBirdPrice || null;
    pricing.currency = course.enrollment.currency || "USD";

    if (
      pricing.earlyBirdPrice &&
      course.enrollment.earlyBirdDays &&
      course.schedule?.startDate
    ) {
      const earlyBirdDeadline = new Date(course.schedule.startDate);
      earlyBirdDeadline.setDate(
        earlyBirdDeadline.getDate() - course.enrollment.earlyBirdDays
      );

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
  } else if (course.access) {
    // For SelfPaced courses
    pricing.regularPrice = course.access.price || 0;
    pricing.currentPrice = pricing.regularPrice;
    pricing.currency = course.access.currency || "USD";
  }

  return pricing;
}

// ✅ ENHANCED: Display Checkout Page with linked course support
exports.getCheckoutPage = async (req, res) => {
  try {
    console.log("🔍 Loading checkout page with linked course support...");
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    const coursesInCart = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;
    let totalLinkedCourseSavings = 0;

    // ✅ ENHANCED: Process In-Person Courses with linked course detection
    const inPersonCartItems =
      user.myInPersonCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(
        item.courseId
      ).lean();
      if (course) {
        const isLinkedCourse = item.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate,
          isLinkedCourse
        );

        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: pricing.currentPrice,
          originalPrice: pricing.regularPrice,
          isEarlyBird: pricing.isEarlyBird,
          earlyBirdSavings: pricing.earlyBirdSavings,
          isLinkedCourseFree: pricing.isLinkedCourseFree, // ⭐ NEW
          courseType: "InPersonAestheticTraining",
          displayType: "In-Person",
          startDate: course.schedule?.startDate || null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
        totalEarlyBirdSavings += pricing.earlyBirdSavings;
        if (pricing.isLinkedCourseFree) {
          totalLinkedCourseSavings += pricing.regularPrice;
        }
      }
    }

    // ✅ ENHANCED: Process Online Live Courses with linked course detection
    const liveCartItems =
      user.myLiveCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId).lean();
      if (course) {
        const isLinkedCourse = item.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate,
          isLinkedCourse
        );

        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: pricing.currentPrice,
          originalPrice: pricing.regularPrice,
          isEarlyBird: pricing.isEarlyBird && !isLinkedCourse, // ⭐ ENHANCED: Don't show early bird for linked
          earlyBirdSavings: isLinkedCourse ? 0 : pricing.earlyBirdSavings, // ⭐ ENHANCED
          isLinkedCourseFree: pricing.isLinkedCourseFree, // ⭐ NEW
          courseType: "OnlineLiveTraining",
          displayType: isLinkedCourse
            ? "Online Live (Included)"
            : "Online Live", // ⭐ ENHANCED
          startDate: course.schedule?.startDate || null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
        if (!isLinkedCourse) {
          totalEarlyBirdSavings += pricing.earlyBirdSavings;
        }
        if (pricing.isLinkedCourseFree) {
          totalLinkedCourseSavings += pricing.regularPrice;
        }
      }
    }

    // ✅ Process Self-Paced Courses (no linked course logic needed)
    const selfPacedCartItems =
      user.mySelfPacedCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(
        item.courseId
      ).lean();
      if (course) {
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate
        );

        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: pricing.currentPrice,
          originalPrice: pricing.regularPrice,
          isEarlyBird: false, // Self-paced courses don't have early bird
          earlyBirdSavings: 0,
          isLinkedCourseFree: false, // ⭐ NEW
          courseType: "SelfPacedOnlineTraining",
          displayType: "Self-Paced",
          startDate: null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
      }
    }

    // ✅ ENHANCED: Calculate total savings (early bird + linked courses)
    const totalSavings = totalEarlyBirdSavings + totalLinkedCourseSavings;

    console.log("📌 Enhanced Cart Summary:", {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length,
      totalOriginal: totalOriginalPrice,
      totalCurrent: totalCurrentPrice,
      earlyBirdSavings: totalEarlyBirdSavings,
      linkedCourseSavings: totalLinkedCourseSavings,
      totalSavings: totalSavings,
    });

    res.render("checkout", {
      coursesInCart,
      totalPrice: totalCurrentPrice,
      totalOriginalPrice: totalOriginalPrice,
      totalSavings: totalSavings.toFixed(2),
      hasEarlyBirdDiscounts: totalSavings > 0, // ⭐ ENHANCED: Include linked course savings
      user,
      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page");
  }
};

// ✅ ENHANCED: Apply Promo Code with linked course support
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ ENHANCED: Calculate total price using enhanced pricing with linked course support
    let totalPrice = 0;

    // Get in-person cart courses
    const inPersonCartItems =
      user.myInPersonCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId);
      if (course) {
        const isLinkedCourse = item.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate,
          isLinkedCourse
        );
        totalPrice += pricing.currentPrice;
      }
    }

    // Get online live cart courses
    const liveCartItems =
      user.myLiveCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId);
      if (course) {
        const isLinkedCourse = item.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate,
          isLinkedCourse
        );
        totalPrice += pricing.currentPrice;
      }
    }

    // Get self-paced cart courses
    const selfPacedCartItems =
      user.mySelfPacedCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(item.courseId);
      if (course) {
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate
        );
        totalPrice += pricing.currentPrice;
      }
    }

    if (totalPrice === 0) {
      return res.json({ success: false, message: "No courses in cart." });
    }

    // Fetch promo code from database
    const promo = await PromoCode.findOne({
      code: promoCode.toUpperCase(),
      isActive: true,
    });

    if (!promo) {
      return res.json({
        success: false,
        message: "Invalid or expired promo code.",
      });
    }

    // Check if promo code has expired
    if (promo.expiryDate && new Date() > promo.expiryDate) {
      return res.json({
        success: false,
        message: "This promo code has expired.",
      });
    }

    console.log(
      `✅ Applying Promo Code: ${promo.code} - Discount: ${promo.discountPercentage}%`
    );
    const discountAmount = totalPrice * (promo.discountPercentage / 100);
    const discountedPrice = totalPrice - discountAmount;

    // Store promo code in session for later use
    req.session.appliedPromoCode = promo.code;

    const completeRegistration = discountedPrice <= 0;

    res.json({
      success: true,
      newTotalPrice: discountedPrice.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      discountPercentage: promo.discountPercentage,
      completeRegistration,
    });
  } catch (err) {
    console.error("❌ Error applying promo code:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ ENHANCED: Process Checkout with linked course support
// ✅ ENHANCED: Process Checkout with improved $0 price handling
exports.processCheckout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Check if user has any courses in cart
    const hasCartItems =
      user.myInPersonCourses?.some((e) => e.enrollmentData.status === "cart") ||
      user.myLiveCourses?.some((e) => e.enrollmentData.status === "cart") ||
      user.mySelfPacedCourses?.some((e) => e.enrollmentData.status === "cart");

    if (!hasCartItems) {
      return res
        .status(400)
        .json({ success: false, message: "No courses in cart." });
    }

    // ✅ ENHANCED: Calculate total price with linked course support
    let totalPrice = 0;

    // Process all course types with enhanced pricing
    for (const enrollment of user.myInPersonCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await InPersonAestheticTraining.findById(
        enrollment.courseId
      );
      if (course) {
        const isLinkedCourse =
          enrollment.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          enrollment.enrollmentData.registrationDate,
          isLinkedCourse
        );
        totalPrice += pricing.currentPrice;
      }
    }

    for (const enrollment of user.myLiveCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await OnlineLiveTraining.findById(enrollment.courseId);
      if (course) {
        const isLinkedCourse =
          enrollment.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          enrollment.enrollmentData.registrationDate,
          isLinkedCourse
        );
        totalPrice += pricing.currentPrice;
      }
    }

    for (const enrollment of user.mySelfPacedCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await SelfPacedOnlineTraining.findById(
        enrollment.courseId
      );
      if (course) {
        const pricing = calculateCoursePricing(
          course,
          enrollment.enrollmentData.registrationDate
        );
        totalPrice += pricing.currentPrice;
      }
    }

    console.log(`💰 Calculated total price: $${totalPrice}`);

    // ✅ NEW: Enhanced logic for $0 total (including promo codes)
    const appliedPromo = req.session.appliedPromoCode;
    let finalPrice = totalPrice;

    // Apply promo code discount if exists
    if (appliedPromo) {
      const promo = await PromoCode.findOne({
        code: appliedPromo,
        isActive: true,
      });

      if (promo && (!promo.expiryDate || new Date() <= promo.expiryDate)) {
        const discountAmount = totalPrice * (promo.discountPercentage / 100);
        finalPrice = totalPrice - discountAmount;
        console.log(
          `🏷️ Promo applied: ${appliedPromo}, Final price: $${finalPrice}`
        );
      }
    }

    // ✅ ENHANCED: More explicit $0 handling
    if (finalPrice <= 0) {
      console.log("🎯 Total is $0 - redirecting to complete registration");
      return res.redirect("/complete-registration");
    } else {
      console.log("💳 Payment required - redirecting to payment");
      return res.redirect("/payment");
    }
  } catch (err) {
    console.error("❌ Error processing checkout:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ✅ ENHANCED: Process Payment with linked course support
exports.processPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let totalPrice = 0;
    const cartCourses = [];

    // ✅ ENHANCED: Calculate totals using enhanced pricing with linked course support
    // Process in-person courses
    for (const enrollment of user.myInPersonCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await InPersonAestheticTraining.findById(
        enrollment.courseId
      );
      if (course) {
        const isLinkedCourse =
          enrollment.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          enrollment.enrollmentData.registrationDate,
          isLinkedCourse
        );
        totalPrice += pricing.currentPrice;
        cartCourses.push({
          title: course.basic?.title,
          price: pricing.currentPrice,
          isLinkedCourseFree: pricing.isLinkedCourseFree,
        });
      }
    }

    // Process online live courses
    for (const enrollment of user.myLiveCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await OnlineLiveTraining.findById(enrollment.courseId);
      if (course) {
        const isLinkedCourse =
          enrollment.enrollmentData.isLinkedCourseFree || false;
        const pricing = calculateCoursePricing(
          course,
          enrollment.enrollmentData.registrationDate,
          isLinkedCourse
        );
        totalPrice += pricing.currentPrice;
        cartCourses.push({
          title: course.basic?.title,
          price: pricing.currentPrice,
          isLinkedCourseFree: pricing.isLinkedCourseFree,
        });
      }
    }

    // Process self-paced courses
    for (const enrollment of user.mySelfPacedCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await SelfPacedOnlineTraining.findById(
        enrollment.courseId
      );
      if (course) {
        const pricing = calculateCoursePricing(
          course,
          enrollment.enrollmentData.registrationDate
        );
        totalPrice += pricing.currentPrice;
        cartCourses.push({
          title: course.basic?.title,
          price: pricing.currentPrice,
          isLinkedCourseFree: false,
        });
      }
    }

    if (totalPrice === 0) {
      return res.redirect("/complete-registration");
    }

    return res.render("payment", { totalPrice, user, cartCourses });
  } catch (err) {
    console.error("❌ Error processing payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ ENHANCED: Complete Registration with linked course support
// ✅ ENHANCED: Complete Registration with better success handling
// checkoutController.js - Complete Registration Function
exports.completeRegistration = async (req, res) => {
  try {
    console.log(
      "🎯 Starting FREE registration process (bypassing CCAvenue)..."
    );
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const registeredCourses = [];
    let coursesUpdated = 0;
    const referenceNumber = uuidv4();
    const transactionId = uuidv4();

    // ✅ PROCESS IN-PERSON COURSES
    for (let i = 0; i < user.myInPersonCourses.length; i++) {
      const enrollment = user.myInPersonCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await InPersonAestheticTraining.findById(
          enrollment.courseId
        );
        if (course) {
          // Update enrollment status
          user.myInPersonCourses[i].enrollmentData.status = "registered";
          user.myInPersonCourses[i].enrollmentData.paidAmount = 0;
          user.myInPersonCourses[i].enrollmentData.promoCodeUsed =
            req.session.appliedPromoCode || "FREE";

          coursesUpdated++;
          const isLinkedCourse =
            enrollment.enrollmentData.isLinkedCourseFree || false;
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate,
            isLinkedCourse
          );

          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            courseType: "InPersonAestheticTraining",
            displayType: "In-Person",
            price: pricing.regularPrice,
            finalPrice: pricing.currentPrice,
            isLinkedCourseFree: pricing.isLinkedCourseFree,
            startDate: course.schedule?.startDate,
          });
        }
      }
    }

    // ✅ PROCESS ONLINE LIVE COURSES
    for (let i = 0; i < user.myLiveCourses.length; i++) {
      const enrollment = user.myLiveCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await OnlineLiveTraining.findById(enrollment.courseId);
        if (course) {
          // Update enrollment status
          user.myLiveCourses[i].enrollmentData.status = "registered";
          user.myLiveCourses[i].enrollmentData.paidAmount = 0;
          user.myLiveCourses[i].enrollmentData.promoCodeUsed =
            req.session.appliedPromoCode || "FREE";

          coursesUpdated++;
          const isLinkedCourse =
            enrollment.enrollmentData.isLinkedCourseFree || false;
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate,
            isLinkedCourse
          );

          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            courseType: "OnlineLiveTraining",
            displayType: isLinkedCourse
              ? "Online Live (Included)"
              : "Online Live",
            price: pricing.regularPrice,
            finalPrice: pricing.currentPrice,
            isLinkedCourseFree: pricing.isLinkedCourseFree,
            startDate: course.schedule?.startDate,
          });
        }
      }
    }

    // ✅ PROCESS SELF-PACED COURSES
    for (let i = 0; i < user.mySelfPacedCourses.length; i++) {
      const enrollment = user.mySelfPacedCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await SelfPacedOnlineTraining.findById(
          enrollment.courseId
        );
        if (course) {
          // Update enrollment status and set expiry date
          user.mySelfPacedCourses[i].enrollmentData.status = "registered";
          user.mySelfPacedCourses[i].enrollmentData.paidAmount = 0;
          user.mySelfPacedCourses[i].enrollmentData.promoCodeUsed =
            req.session.appliedPromoCode || "FREE";

          // Set expiry date based on course access days
          if (course.access?.accessDays) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + course.access.accessDays);
            user.mySelfPacedCourses[i].enrollmentData.expiryDate = expiryDate;
          }

          coursesUpdated++;
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate
          );

          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title || "Untitled Course",
            courseCode: course.basic?.courseCode || "N/A",
            courseType: "SelfPacedOnlineTraining",
            displayType: "Self-Paced",
            price: pricing.regularPrice,
            finalPrice: pricing.currentPrice,
            isLinkedCourseFree: false, // Self-paced courses are never linked
            startDate: null,
          });
        }
      }
    }

    // ✅ CHECK IF ANY COURSES WERE PROCESSED
    if (coursesUpdated === 0) {
      console.log("❌ No courses found in cart");

      if (req.method === "POST") {
        return res.status(400).json({
          success: false,
          message: "No courses in cart.",
        });
      } else {
        return res.status(400).send("No courses in cart.");
      }
    }

    // ✅ CREATE TRANSACTION RECORD FOR FREE REGISTRATION
    const totalAmount = registeredCourses.reduce(
      (sum, course) => sum + course.price,
      0
    );
    const finalAmount = registeredCourses.reduce(
      (sum, course) => sum + course.finalPrice,
      0
    );
    const totalSavings = totalAmount - finalAmount;

    const transaction = {
      transactionId: transactionId,
      orderNumber: `ORD-FREE-${Date.now()}-${user._id.toString().slice(-6)}`,
      receiptNumber: `REC-FREE-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`,
      transactionDate: new Date(),
      completedAt: new Date(),
      paymentMethod: req.session.appliedPromoCode
        ? "Promo Code"
        : "Free Course",
      paymentStatus: "completed",

      financial: {
        subtotal: totalAmount,
        discountAmount: totalSavings,
        earlyBirdSavings: 0, // Calculate if needed
        promoCodeDiscount: req.session.appliedPromoCode ? totalSavings : 0,
        tax: 0,
        processingFee: 0,
        finalAmount: 0, // Always $0 for free registration
        currency: "USD",
      },

      discounts: {
        promoCode: req.session.appliedPromoCode
          ? {
              code: req.session.appliedPromoCode,
              discountType: "percentage",
              discountAmount: totalSavings,
            }
          : null,
      },

      items: registeredCourses.map((course) => ({
        courseId: course.courseId,
        courseType: course.courseType,
        courseTitle: course.title,
        courseCode: course.courseCode,
        originalPrice: course.price,
        finalPrice: 0, // Free
        isLinkedCourseFree: course.isLinkedCourseFree || false,
        courseSchedule: {
          startDate: course.startDate,
        },
      })),

      customerInfo: {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phoneNumber,
        country: user.country,
      },

      metadata: {
        source: "website",
        registrationType: "free",
        promoCode: req.session.appliedPromoCode || "FREE",
      },
    };

    // ✅ SAVE TRANSACTION AND USER DATA
    user.paymentTransactions.push(transaction);
    await user.save({ validateBeforeSave: false });

    // ✅ CLEAR APPLIED PROMO CODE FROM SESSION
    delete req.session.appliedPromoCode;

    // ✅ SEND CONFIRMATION EMAIL
    try {
      await sendCourseRegistrationEmail(
        user,
        registeredCourses,
        referenceNumber,
        true
      );
      console.log("✅ Free registration email sent successfully");
    } catch (emailError) {
      console.error("❌ Error sending registration email:", emailError);
      // Don't fail the registration if email fails
    }

    console.log(`✅ FREE registration completed for ${coursesUpdated} courses`);
    console.log(`📋 Reference number: ${referenceNumber}`);

    // ✅ REDIRECT TO UNIFIED SUCCESS PAGE
    const successUrl = `/payment/success?order_id=FREE&amount=0.00&ref=${referenceNumber}`;

    if (req.method === "POST") {
      res.json({
        success: true,
        message: "Registration completed successfully!",
        referenceNumber: referenceNumber,
        coursesRegistered: coursesUpdated,
        redirect: successUrl,
      });
    } else {
      // GET request - redirect directly
      res.redirect(successUrl);
    }
  } catch (err) {
    console.error("❌ Error completing free registration:", err);

    if (req.method === "POST") {
      res.status(500).json({
        success: false,
        message: "Server error during registration. Please try again.",
      });
    } else {
      res.status(500).send("Error completing registration. Please try again.");
    }
  }
};

// ✅ ENHANCED: Initiate CCAvenue Payment with linked course support
exports.proceedToPayment = async (req, res) => {
  try {
    console.log(
      "💳 Processing payment with CCAvenue (with linked course support)..."
    );
    const userId = req.user._id;
    const user = await User.findById(userId)
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ ENHANCED: Collect cart items and calculate totals using enhanced pricing with linked course support
    const cartItems = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;
    let totalLinkedCourseSavings = 0;

    // Helper function to process cart items with linked course support
    const processCartItems = (enrollments, courseType) => {
      enrollments
        .filter((e) => e.enrollmentData.status === "cart")
        .forEach((enrollment) => {
          const course = enrollment.courseId;
          if (course) {
            const isLinkedCourse =
              enrollment.enrollmentData.isLinkedCourseFree || false;
            const pricing = calculateCoursePricing(
              course,
              enrollment.enrollmentData.registrationDate,
              isLinkedCourse
            );

            cartItems.push({
              courseId: course._id,
              courseType: courseType,
              courseTitle: course.basic?.title || "Untitled Course",
              courseCode: course.basic?.courseCode || "N/A",
              originalPrice: pricing.regularPrice,
              earlyBirdPrice: pricing.earlyBirdPrice,
              finalPrice: pricing.currentPrice,
              isEarlyBird: pricing.isEarlyBird,
              earlyBirdSavings: pricing.earlyBirdSavings,
              isLinkedCourseFree: pricing.isLinkedCourseFree, // ⭐ NEW
              courseSchedule: {
                startDate: course.schedule?.startDate,
                endDate: course.schedule?.endDate,
                duration: course.schedule?.duration,
                location: course.venue?.name || course.venue?.city,
                platform: course.platform?.name,
                accessDays: course.access?.accessDays,
              },
              instructor: {
                name:
                  course.instructors?.primary?.name || course.instructor?.name,
                id:
                  course.instructors?.primary?.instructorId ||
                  course.instructor?.instructorId,
              },
            });

            totalOriginalPrice += pricing.regularPrice;
            totalCurrentPrice += pricing.currentPrice;
            totalEarlyBirdSavings += pricing.earlyBirdSavings;
            if (pricing.isLinkedCourseFree) {
              totalLinkedCourseSavings += pricing.regularPrice;
            }
          }
        });
    };

    // Process all course types
    processCartItems(user.myInPersonCourses, "InPersonAestheticTraining");
    processCartItems(user.myLiveCourses, "OnlineLiveTraining");
    processCartItems(user.mySelfPacedCourses, "SelfPacedOnlineTraining");

    if (cartItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No items in cart" });
    }

    // Apply promo code discount if exists in session
    let promoCodeDiscount = 0;
    let promoCodeData = null;

    if (req.session.appliedPromoCode) {
      const promo = await PromoCode.findOne({
        code: req.session.appliedPromoCode,
      });
      if (promo) {
        promoCodeDiscount =
          totalCurrentPrice * (promo.discountPercentage / 100);
        promoCodeData = {
          code: promo.code,
          discountType: "percentage",
          discountValue: promo.discountPercentage,
          discountAmount: promoCodeDiscount,
        };
      }
    }

    const finalAmount = Math.max(0, totalCurrentPrice - promoCodeDiscount);

    // If final amount is 0 or very small, complete as free registration
    if (finalAmount <= 0) {
      return res.redirect("/complete-registration");
    }

    // ✅ ENHANCED: Create payment transaction record with linked course info
    const transactionId = `TXN_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const orderNumber = `ORD_${Date.now()}_${userId.toString().slice(-6)}`;

    const transactionData = {
      transactionId,
      orderNumber,
      paymentMethod: "CCAvenue",
      paymentStatus: "pending",

      financial: {
        subtotal: totalOriginalPrice,
        discountAmount:
          totalEarlyBirdSavings + totalLinkedCourseSavings + promoCodeDiscount, // ⭐ ENHANCED
        earlyBirdSavings: totalEarlyBirdSavings,
        linkedCourseSavings: totalLinkedCourseSavings, // ⭐ NEW
        promoCodeDiscount: promoCodeDiscount,
        finalAmount: finalAmount,
        currency: "USD",
      },

      discounts: {
        promoCode: promoCodeData,
        earlyBird: {
          applied: totalEarlyBirdSavings > 0,
          totalSavings: totalEarlyBirdSavings,
          coursesWithEarlyBird: cartItems
            .filter((item) => item.isEarlyBird)
            .map((item) => item.courseId.toString()),
        },
        linkedCourses: {
          // ⭐ NEW
          applied: totalLinkedCourseSavings > 0,
          totalSavings: totalLinkedCourseSavings,
          coursesIncluded: cartItems
            .filter((item) => item.isLinkedCourseFree)
            .map((item) => item.courseId.toString()),
        },
      },

      items: cartItems,

      gift: {
        isGift: req.body.isGift || false,
        recipientEmail: req.body.giftRecipientEmail,
        giftMessage: req.body.giftMessage,
        senderName: `${user.firstName} ${user.lastName}`,
      },

      metadata: {
        userAgent: req.get("User-Agent"),
        ipAddress: req.ip,
        sessionId: req.sessionID,
        orderNotes: req.body.orderNotes,
        source: "website",
      },
    };

    // Create transaction record in user
    const transaction = user.createPaymentTransaction(transactionData);
    await user.save();

    // Prepare CCAvenue payment data
    const ccavenuePaymentData = {
      merchant_id: process.env.CCAVENUE_MERCHANT_ID,
      order_id: orderNumber,
      amount: finalAmount.toFixed(2),
      currency: "USD",
      redirect_url: `${baseUrl}/payment/response`, // ✅ Updated
      cancel_url: `${baseUrl}/payment/cancel`, // ✅ Updated
      language: "EN",

      // Customer details
      billing_name: `${user.firstName} ${user.lastName}`,
      billing_email: user.email,
      billing_tel: user.phoneNumber || "",
      billing_country: user.country || "United States",

      // Store transaction ID and user ID in merchant params
      merchant_param1: transactionId,
      merchant_param2: userId.toString(),
      merchant_param3: cartItems.length.toString(),
    };

    // Convert to query string and encrypt
    const dataString = Object.keys(ccavenuePaymentData)
      .map((key) => `${key}=${encodeURIComponent(ccavenuePaymentData[key])}`)
      .join("&");

    const encRequest = ccavUtil.encrypt(dataString);

    // Determine payment URL
    const paymentUrl =
      "https://secure.ccavenue.ae/transaction/transaction.do?command=initiateTransaction";

    // ✅ ENHANCED: Create auto-submit form with linked course info
    const paymentForm = `
      <html>
        <head>
          <title>Redirecting to Payment Gateway...</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .loader { border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 20px auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; }
            .summary h4 { margin: 0 0 15px 0; color: #333; }
            .summary p { margin: 5px 0; color: #666; }
            .amount { font-size: 24px; font-weight: bold; color: #28a745; }
            .savings { color: #28a745; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h3>🔒 Secure Payment Processing</h3>
            <div class="loader"></div>
            <p>Please wait while we redirect you to our secure payment gateway...</p>
            
            <div class="summary">
              <h4>Order Summary</h4>
              <p><strong>Order #:</strong> ${orderNumber}</p>
              <p><strong>Items:</strong> ${cartItems.length} course(s)</p>
              ${
                totalEarlyBirdSavings > 0
                  ? `<p class="savings"><strong>Early Bird Savings:</strong> ${totalEarlyBirdSavings.toFixed(
                      2
                    )}</p>`
                  : ""
              }
              ${
                totalLinkedCourseSavings > 0
                  ? `<p class="savings"><strong>Included Course Savings:</strong> ${totalLinkedCourseSavings.toFixed(
                      2
                    )}</p>`
                  : ""
              }
              ${
                promoCodeDiscount > 0
                  ? `<p class="savings"><strong>Promo Discount:</strong> ${promoCodeDiscount.toFixed(
                      2
                    )}</p>`
                  : ""
              }
              <p class="amount">Total: ${finalAmount.toFixed(2)} USD</p>
            </div>
            
            <p><small>🔐 This is a secure SSL encrypted connection</small></p>
          </div>
          
          <form id="paymentForm" method="post" action="${paymentUrl}">
            <input type="hidden" name="encRequest" value="${encRequest}">
            <input type="hidden" name="access_code" value="${
              process.env.CCAVENUE_ACCESS_CODE
            }">
          </form>
          
          <script>
            // Auto-submit after 2 seconds
            setTimeout(() => {
              document.getElementById('paymentForm').submit();
            }, 2000);
          </script>
        </body>
      </html>
    `;

    console.log(
      `💳 Enhanced Payment initiated: Order ${orderNumber}, Amount ${finalAmount}, Transaction ${transactionId}`
    );
    console.log(
      `💰 Savings breakdown: Early Bird ${totalEarlyBirdSavings}, Linked Courses ${totalLinkedCourseSavings}, Promo ${promoCodeDiscount}`
    );
    res.send(paymentForm);
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    res
      .status(500)
      .json({ success: false, message: "Payment processing failed" });
  }
};

// ✅ ENHANCED: Handle CCAvenue Payment Response with linked course support
exports.handlePaymentResponse = async (req, res) => {
  try {
    console.log("📥 Received payment response from CCAvenue");
    const { encResp } = req.body;

    if (!encResp) {
      return res.status(400).send("Invalid payment response");
    }

    // Decrypt the response
    const decryptedResponse = ccavUtil.decrypt(encResp);

    // Parse response data
    const responseData = {};
    decryptedResponse.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      responseData[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    console.log("💳 Payment Response Details:", {
      order_status: responseData.order_status,
      order_id: responseData.order_id,
      tracking_id: responseData.tracking_id,
      amount: responseData.amount,
    });

    const {
      order_status,
      order_id,
      tracking_id,
      amount,
      currency,
      merchant_param1: transactionId,
      merchant_param2: userId,
      payment_mode,
      card_name,
      bank_ref_no,
      failure_message,
    } = responseData;

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect("/payment/error?message=User not found");
    }

    // Update payment transaction with CCAvenue response
    const transaction = user.updatePaymentTransaction(
      transactionId,
      responseData
    );

    if (!transaction) {
      return res.redirect("/payment/error?message=Transaction not found");
    }

    if (order_status === "Success") {
      // ✅ ENHANCED: Payment successful - update enrollment status (including linked courses)
      user.updateEnrollmentStatusAfterPayment(transactionId);

      // Add communication record
      transaction.communications.push({
        type: "email",
        template: "payment_confirmation",
        sentAt: new Date(),
        status: "pending",
        recipientEmail: user.email,
        subject: `Payment Confirmation - Order #${order_id}`,
      });

      await user.save();

      // Send confirmation email
      try {
        await sendPaymentConfirmationEmail(user, transaction);

        // Update communication status
        const lastComm =
          transaction.communications[transaction.communications.length - 1];
        lastComm.status = "sent";
        await user.save();

        console.log("✅ Payment confirmation email sent");
      } catch (emailError) {
        console.error("❌ Error sending confirmation email:", emailError);
      }

      // Clear applied promo code from session
      delete req.session.appliedPromoCode;

      res.redirect(
        `/payment/success?order_id=${order_id}&amount=${amount}&ref=${transaction.receiptNumber}`
      );
    } else {
      // Payment failed
      console.log("❌ Payment failed:", failure_message);

      // Add failed communication record
      transaction.communications.push({
        type: "email",
        template: "payment_failed",
        sentAt: new Date(),
        status: "pending",
        recipientEmail: user.email,
        subject: `Payment Failed - Order #${order_id}`,
      });

      await user.save();

      res.redirect(
        `/payment/failure?order_id=${order_id}&reason=${encodeURIComponent(
          failure_message || "Payment failed"
        )}`
      );
    }
  } catch (error) {
    console.error("❌ Payment response handling error:", error);
    res.redirect("/payment/error?message=Payment processing error");
  }
};

// ✅ Handle Payment Cancellation (unchanged)
exports.handlePaymentCancel = (req, res) => {
  console.log("❌ Payment cancelled by user");
  res.redirect("/payment/cancelled");
};

// ✅ ENHANCED: Send payment confirmation email with linked course info
async function sendPaymentConfirmationEmail(user, transaction) {
  const courseListHtml = transaction.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${item.courseTitle}</strong><br>
        <span style="color: #666; font-size: 14px;">
          Code: ${item.courseCode}
          ${
            item.courseSchedule.startDate
              ? `| Starts: ${new Date(
                  item.courseSchedule.startDate
                ).toLocaleDateString()}`
              : ""
          }
          ${
            item.isEarlyBird
              ? '| <span style="color: #28a745;">Early Bird Applied!</span>'
              : ""
          }
          ${
            item.isLinkedCourseFree
              ? '| <span style="color: #007bff;">Included Free!</span>'
              : ""
          }
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${
          item.isLinkedCourseFree
            ? `
          <span style="text-decoration: line-through; color: #999;">${item.originalPrice}</span><br>
          <strong style="color: #007bff;">FREE</strong><br>
          <small style="color: #007bff;">Included with In-Person Course</small>
        `
            : `
          ${
            item.isEarlyBird
              ? `<span style="text-decoration: line-through; color: #999;">${item.originalPrice}</span><br>`
              : ""
          }
          <strong>${item.finalPrice}</strong>
          ${
            item.isEarlyBird
              ? `<br><small style="color: #28a745;">Saved ${item.earlyBirdSavings}</small>`
              : ""
          }
        `
        }
      </td>
    </tr>
  `
    )
    .join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
        .success-badge { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
        .transaction-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .course-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .course-table th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
        .financial-summary { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Payment Confirmed!</h1>
        <p>Your course enrollment is now complete</p>
      </div>
      
      <div class="content">
        <div class="success-badge">
          <strong>✅ Payment Successfully Processed</strong><br>
          Your enrollment is confirmed and you now have full access to your courses.
        </div>
        
        <h2>Hello ${user.firstName} ${user.lastName},</h2>
        <p>Thank you for your payment! Your transaction has been successfully processed.</p>
        
        <div class="transaction-details">
          <h3>📄 Transaction Details</h3>
          <p><strong>Order Number:</strong> ${transaction.orderNumber}</p>
          <p><strong>Transaction ID:</strong> ${
            transaction.ccavenue.trackingId
          }</p>
          <p><strong>Receipt Number:</strong> ${transaction.receiptNumber}</p>
          <p><strong>Payment Date:</strong> ${new Date(
            transaction.completedAt
          ).toLocaleDateString()}</p>
          <p><strong>Payment Method:</strong> ${
            transaction.ccavenue.paymentMode
          } - ${transaction.ccavenue.cardName}</p>
        </div>
        
        <h3>📚 Enrolled Courses</h3>
        <table class="course-table">
          <thead>
            <tr>
              <th>Course Details</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${courseListHtml}
          </tbody>
        </table>
        
        <div class="financial-summary">
          <h3>💰 Payment Summary</h3>
          <p><strong>Subtotal:</strong> ${transaction.financial.subtotal.toFixed(
            2
          )}</p>
          ${
            transaction.financial.earlyBirdSavings > 0
              ? `<p><strong>Early Bird Savings:</strong> -${transaction.financial.earlyBirdSavings.toFixed(
                  2
                )}</p>`
              : ""
          }
          ${
            transaction.financial.linkedCourseSavings > 0
              ? `<p><strong>Included Course Savings:</strong> -${transaction.financial.linkedCourseSavings.toFixed(
                  2
                )}</p>`
              : ""
          }
          ${
            transaction.financial.promoCodeDiscount > 0
              ? `<p><strong>Promo Code Discount:</strong> -${transaction.financial.promoCodeDiscount.toFixed(
                  2
                )}</p>`
              : ""
          }
          <p style="font-size: 18px; color: #28a745;"><strong>Total Paid: ${transaction.financial.finalAmount.toFixed(
            2
          )} ${transaction.financial.currency}</strong></p>
        </div>
        
        <h3>🚀 What's Next?</h3>
        <ul>
          <li><strong>Access Your Courses:</strong> Login to your dashboard to start learning</li>
          <li><strong>Course Materials:</strong> All resources are now available in your account</li>
          <li><strong>Certificates:</strong> Complete courses to earn your certificates</li>
          <li><strong>Support:</strong> Contact us anytime for assistance</li>
        </ul>
        
        <center>
          <a href="${
            process.env.BASE_URL || "http://localhost:3000"
          }/dashboard" class="button">
            🎯 Access My Courses
          </a>
        </center>
        
        <p>Thank you for choosing IAAI Training Institute! We're excited to be part of your learning journey.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          For support, contact us at ${
            process.env.SUPPORT_EMAIL || "support@iaai-training.com"
          }<br>
          Transaction processed securely by CCAvenue
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `Payment Confirmation - IAAI Training (Order #${transaction.orderNumber})`,
    html: emailHtml,
  });
}

// ✅ ENHANCED: Send course registration email with linked course info
async function sendCourseRegistrationEmail(
  user,
  courses,
  referenceNumber,
  isPromoCode = false
) {
  const courseListHtml = courses
    .map(
      (course) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${course.title}</strong><br>
        <span style="color: #666; font-size: 14px;">
          Code: ${course.courseCode} | Type: ${course.courseType}
          ${
            course.startDate
              ? `| Starts: ${new Date(course.startDate).toLocaleDateString()}`
              : ""
          }
          ${
            course.isLinkedCourseFree
              ? '| <span style="color: #007bff;">Included Free</span>'
              : ""
          }
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${
          course.isLinkedCourseFree
            ? '<span style="color: #007bff;">FREE (Included)</span>'
            : isPromoCode
            ? '<span style="color: #28a745;">FREE</span>'
            : `${course.price}`
        }
      </td>
    </tr>
  `
    )
    .join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: #1a365d; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .course-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .success-box { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .info-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Course Registration Confirmed! 🎉</h1>
        </div>
        <div class="content">
          <h2>Hello ${user.firstName} ${user.lastName},</h2>
          
          <div class="success-box">
            <strong>Congratulations!</strong> You have successfully registered for the following course(s).
            ${
              isPromoCode
                ? "<br><em>These courses were registered using a promotional code.</em>"
                : ""
            }
          </div>
          
          <h3>Registration Details:</h3>
          <table class="course-table">
            ${courseListHtml}
          </table>
          
          <div class="info-box">
            <strong>Reference Number:</strong> ${referenceNumber}<br>
            <strong>Registration Date:</strong> ${new Date().toLocaleDateString()}<br>
            <strong>Total Courses:</strong> ${courses.length}
          </div>
          
          <h3>What's Next?</h3>
          <ul>
            <li>You can access your courses from your dashboard</li>
            <li>For in-person courses, you'll receive location details closer to the date</li>
            <li>For online courses, login links will be sent before the session</li>
            <li>Self-paced courses are available immediately</li>
          </ul>
          
          <center>
            <a href="${
              process.env.BASE_URL || "http://localhost:3000"
            }/my-courses" class="button">
              View My Courses
            </a>
          </center>
          
          <p>If you have any questions, please contact our support team at ${
            process.env.SUPPORT_EMAIL || "support@iaai-training.com"
          }</p>
          
          <p>Thank you for choosing IAAI Training Institute!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `Course Registration Confirmed - IAAI Training (Ref: ${referenceNumber})`,
    html: emailHtml,
  });
}
