// controllers/checkoutController.js - FINAL VERSION WITH DECIMAL PRECISION FIXES
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

// ✅ DECIMAL PRECISION HELPER FUNCTIONS
function roundToTwoDecimals(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function calculateDiscount(totalPrice, discountPercentage) {
  const discountAmount = roundToTwoDecimals(
    totalPrice * (discountPercentage / 100)
  );
  const finalPrice = roundToTwoDecimals(totalPrice - discountAmount);

  return {
    discountAmount,
    finalPrice,
    originalPrice: roundToTwoDecimals(totalPrice),
  };
}

// ✅ Helper function to calculate pricing with linked course support
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
    currency: "AED",
    isLinkedCourseFree: isLinkedCourse,
  };

  // If this is a linked course, set price to 0
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

  // Regular pricing logic for non-linked courses
  if (course.enrollment) {
    // For InPerson and OnlineLive courses
    pricing.regularPrice = roundToTwoDecimals(course.enrollment.price || 0);
    pricing.earlyBirdPrice = course.enrollment.earlyBirdPrice
      ? roundToTwoDecimals(course.enrollment.earlyBirdPrice)
      : null;
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
        pricing.earlyBirdSavings = roundToTwoDecimals(
          pricing.regularPrice - pricing.earlyBirdPrice
        );
      } else {
        pricing.currentPrice = pricing.regularPrice;
      }
    } else {
      pricing.currentPrice = pricing.regularPrice;
    }
  } else if (course.access) {
    // For SelfPaced courses
    pricing.regularPrice = roundToTwoDecimals(course.access.price || 0);
    pricing.currentPrice = pricing.regularPrice;
    pricing.currency = course.access.currency || "USD";
  }

  return pricing;
}

// ✅ Display Checkout Page with linked course support
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

    // Process In-Person Courses
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
          isLinkedCourseFree: pricing.isLinkedCourseFree,
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

    // Process Online Live Courses
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
          isEarlyBird: pricing.isEarlyBird && !isLinkedCourse,
          earlyBirdSavings: isLinkedCourse ? 0 : pricing.earlyBirdSavings,
          isLinkedCourseFree: pricing.isLinkedCourseFree,
          courseType: "OnlineLiveTraining",
          displayType: isLinkedCourse
            ? "Online Live (Included)"
            : "Online Live",
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

    // Process Self-Paced Courses
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
          isEarlyBird: false,
          earlyBirdSavings: 0,
          isLinkedCourseFree: false,
          courseType: "SelfPacedOnlineTraining",
          displayType: "Self-Paced",
          startDate: null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
      }
    }

    // ✅ Round all totals to avoid floating point issues
    totalOriginalPrice = roundToTwoDecimals(totalOriginalPrice);
    totalCurrentPrice = roundToTwoDecimals(totalCurrentPrice);
    totalEarlyBirdSavings = roundToTwoDecimals(totalEarlyBirdSavings);
    totalLinkedCourseSavings = roundToTwoDecimals(totalLinkedCourseSavings);
    const totalSavings = roundToTwoDecimals(
      totalEarlyBirdSavings + totalLinkedCourseSavings
    );

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
      hasEarlyBirdDiscounts: totalSavings > 0,
      user,
      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page");
  }
};

// ✅ FIXED: Apply Promo Code with decimal precision
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let totalPrice = 0;

    // Calculate total from all course types
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

    // ✅ Round total price to avoid floating point issues
    totalPrice = roundToTwoDecimals(totalPrice);

    if (totalPrice === 0) {
      return res.json({ success: false, message: "No courses in cart." });
    }

    // Validate promo code
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

    if (promo.expiryDate && new Date() > promo.expiryDate) {
      return res.json({
        success: false,
        message: "This promo code has expired.",
      });
    }

    console.log(
      `✅ Applying Promo Code: ${promo.code} - Discount: ${promo.discountPercentage}%`
    );

    // ✅ FIXED: Use helper function for precise calculation
    const promoResult = calculateDiscount(totalPrice, promo.discountPercentage);

    console.log(
      `💰 Promo Calculation: ${promoResult.originalPrice} - ${promoResult.discountAmount} = ${promoResult.finalPrice}`
    );

    req.session.appliedPromoCode = promo.code;
    const completeRegistration = promoResult.finalPrice <= 0;

    res.json({
      success: true,
      newTotalPrice: promoResult.finalPrice.toFixed(2),
      discountAmount: promoResult.discountAmount.toFixed(2),
      discountPercentage: promo.discountPercentage,
      completeRegistration,
    });
  } catch (err) {
    console.error("❌ Error applying promo code:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ FIXED: Process Checkout with decimal precision
exports.processCheckout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const hasCartItems =
      user.myInPersonCourses?.some((e) => e.enrollmentData.status === "cart") ||
      user.myLiveCourses?.some((e) => e.enrollmentData.status === "cart") ||
      user.mySelfPacedCourses?.some((e) => e.enrollmentData.status === "cart");

    if (!hasCartItems) {
      return res
        .status(400)
        .json({ success: false, message: "No courses in cart." });
    }

    let totalPrice = 0;

    // Calculate total price with linked course support
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

    // ✅ Round total price
    totalPrice = roundToTwoDecimals(totalPrice);
    console.log(`💰 Calculated total price: $${totalPrice}`);

    // Apply promo code discount if exists
    const appliedPromo = req.session.appliedPromoCode;
    let finalPrice = totalPrice;

    if (appliedPromo) {
      const promo = await PromoCode.findOne({
        code: appliedPromo,
        isActive: true,
      });

      if (promo && (!promo.expiryDate || new Date() <= promo.expiryDate)) {
        // ✅ FIXED: Use helper function for precise calculation
        const promoResult = calculateDiscount(
          totalPrice,
          promo.discountPercentage
        );
        finalPrice = promoResult.finalPrice;

        console.log(
          `🏷️ Promo applied: ${appliedPromo}, Final price: $${finalPrice}`
        );
      }
    }

    // Decide between free registration or payment
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

// ✅ Process Payment - show payment page
exports.processPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let totalPrice = 0;
    const cartCourses = [];

    // Process all course types
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

    // ✅ Round total price
    totalPrice = roundToTwoDecimals(totalPrice);

    if (totalPrice === 0) {
      return res.redirect("/complete-registration");
    }

    return res.render("payment", { totalPrice, user, cartCourses });
  } catch (err) {
    console.error("❌ Error processing payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Complete Registration - for FREE courses
exports.completeRegistration = async (req, res) => {
  try {
    console.log("🎯 Starting FREE registration process...");
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

    // Process In-Person Courses
    for (let i = 0; i < user.myInPersonCourses.length; i++) {
      const enrollment = user.myInPersonCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await InPersonAestheticTraining.findById(
          enrollment.courseId
        );
        if (course) {
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

    // Process Online Live Courses
    for (let i = 0; i < user.myLiveCourses.length; i++) {
      const enrollment = user.myLiveCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await OnlineLiveTraining.findById(enrollment.courseId);
        if (course) {
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

    // Process Self-Paced Courses
    for (let i = 0; i < user.mySelfPacedCourses.length; i++) {
      const enrollment = user.mySelfPacedCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await SelfPacedOnlineTraining.findById(
          enrollment.courseId
        );
        if (course) {
          user.mySelfPacedCourses[i].enrollmentData.status = "registered";
          user.mySelfPacedCourses[i].enrollmentData.paidAmount = 0;
          user.mySelfPacedCourses[i].enrollmentData.promoCodeUsed =
            req.session.appliedPromoCode || "FREE";

          // Set expiry date for self-paced courses
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
            isLinkedCourseFree: false,
            startDate: null,
          });
        }
      }
    }

    if (coursesUpdated === 0) {
      console.log("❌ No courses found in cart");
      if (req.method === "POST") {
        return res
          .status(400)
          .json({ success: false, message: "No courses in cart." });
      } else {
        return res.status(400).send("No courses in cart.");
      }
    }

    // ✅ Calculate totals with decimal precision
    const totalAmount = roundToTwoDecimals(
      registeredCourses.reduce((sum, course) => sum + course.price, 0)
    );
    const finalAmount = roundToTwoDecimals(
      registeredCourses.reduce((sum, course) => sum + course.finalPrice, 0)
    );
    const totalSavings = roundToTwoDecimals(totalAmount - finalAmount);

    // ✅ Create transaction with proper decimal handling
    const transaction = {
      transactionId: transactionId,
      orderNumber: `ORD-FREE-${Date.now()}-${user._id.toString().slice(-6)}`,
      receiptNumber: `REC-FREE-${Date.now()}-${Math.floor(
        Math.random() * 1000
      )}`,

      createdAt: new Date(),
      transactionDate: new Date(),
      completedAt: new Date(),

      paymentStatus: "completed",
      paymentMethod: req.session.appliedPromoCode
        ? "Promo Code"
        : "Free Course",

      financial: {
        subtotal: totalAmount,
        discountAmount: totalSavings,
        earlyBirdSavings: 0,
        promoCodeDiscount: req.session.appliedPromoCode ? totalSavings : 0,
        tax: 0,
        processingFee: 0,
        finalAmount: 0,
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
        earlyBird: {
          applied: false,
          totalSavings: 0,
          coursesWithEarlyBird: [],
        },
      },

      items: registeredCourses.map((course) => ({
        courseId: course.courseId,
        courseType: course.courseType,
        courseTitle: course.title,
        courseCode: course.courseCode,
        originalPrice: course.price,
        finalPrice: 0,
        isEarlyBird: false,
        earlyBirdSavings: 0,
        courseSchedule: {
          startDate: course.startDate,
          endDate: null,
          duration: null,
          location: null,
          platform: null,
          accessDays: null,
          expiryDate: null,
        },
        instructor: {
          name: null,
          id: null,
        },
      })),

      customerInfo: {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phoneNumber || "",
        country: user.country || "",
        billingAddress: {
          name: `${user.firstName} ${user.lastName}`,
          address: "",
          city: "",
          state: "",
          country: user.country || "",
          zip: "",
        },
      },

      gift: {
        isGift: false,
        recipientEmail: null,
        recipientName: null,
        giftMessage: null,
        senderName: null,
      },

      metadata: {
        userAgent: req.get("User-Agent") || "",
        ipAddress: req.ip || "",
        sessionId: req.sessionID || "",
        orderNotes: "",
        source: "website",
      },

      ccavenue: {},
      communications: [],

      refund: {
        isRefunded: false,
        refundAmount: 0,
        refundDate: null,
        refundReason: null,
        refundTransactionId: null,
        refundMethod: null,
        processedBy: null,
      },

      documentation: {
        receiptUrl: null,
        invoiceUrl: null,
        contractUrl: null,
        certificateEligible: true,
      },
    };

    // Add transaction directly to user
    user.paymentTransactions.push(transaction);
    await user.save({ validateBeforeSave: false });

    // Clear promo code from session
    delete req.session.appliedPromoCode;

    // Send confirmation email
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
    }

    console.log(`✅ FREE registration completed for ${coursesUpdated} courses`);
    console.log(`📋 Reference number: ${referenceNumber}`);

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

// ✅ FIXED: Proceed to Payment with decimal precision
// ✅ FIXED: Proceed to Payment with all required CCAvenue parameters
// ✅ UPDATED: proceedToPayment function with AED currency for testing
exports.proceedToPayment = async (req, res) => {
  try {
    console.log(
      "💳 Processing payment with CCAvenue (AED currency for testing)..."
    );

    const userId = req.user._id;
    const user = await User.findById(userId)
      .populate("myInPersonCourses.courseId")
      .populate("myLiveCourses.courseId")
      .populate("mySelfPacedCourses.courseId");

    if (!user) {
      console.error("❌ User not found");
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ✅ Collect cart items and calculate totals using enhanced pricing with linked course support
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

            // 🔄 UPDATED: Convert USD to AED (1 USD = 3.67 AED)
            const usdToAedRate = 3.67;
            const originalPriceAED = Math.round(
              pricing.regularPrice * usdToAedRate
            );
            const currentPriceAED = Math.round(
              pricing.currentPrice * usdToAedRate
            );
            const earlyBirdSavingsAED = Math.round(
              pricing.earlyBirdSavings * usdToAedRate
            );

            cartItems.push({
              courseId: course._id,
              courseType: courseType,
              courseTitle: course.basic?.title || "Untitled Course",
              courseCode: course.basic?.courseCode || "N/A",

              // 🔄 UPDATED: Use AED prices
              originalPrice: originalPriceAED,
              earlyBirdPrice: pricing.earlyBirdPrice
                ? Math.round(pricing.earlyBirdPrice * usdToAedRate)
                : null,
              finalPrice: currentPriceAED,
              isEarlyBird: pricing.isEarlyBird,
              earlyBirdSavings: earlyBirdSavingsAED,
              isLinkedCourseFree: pricing.isLinkedCourseFree,

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

            // 🔄 UPDATED: Use AED prices for totals
            totalOriginalPrice += originalPriceAED;
            totalCurrentPrice += currentPriceAED;
            totalEarlyBirdSavings += earlyBirdSavingsAED;
            if (pricing.isLinkedCourseFree) {
              totalLinkedCourseSavings += originalPriceAED;
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

    // ✅ Create payment transaction record with AED currency
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
          totalEarlyBirdSavings + totalLinkedCourseSavings + promoCodeDiscount,
        earlyBirdSavings: totalEarlyBirdSavings,
        linkedCourseSavings: totalLinkedCourseSavings,
        promoCodeDiscount: promoCodeDiscount,
        finalAmount: finalAmount,
        currency: "AED", // 🔄 UPDATED: Changed from USD to AED
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

    // 🔄 UPDATED: Prepare CCAvenue payment data with AED currency
    const ccavenuePaymentData = {
      merchant_id: process.env.CCAVENUE_MERCHANT_ID,
      order_id: orderNumber,
      amount: finalAmount.toFixed(2),
      currency: "AED", // 🔄 UPDATED: Changed from USD to AED
      redirect_url: `${req.protocol}://${req.get("host")}/payment/response`,
      cancel_url: `${req.protocol}://${req.get("host")}/payment/cancel`,
      language: "EN",

      // Customer details
      billing_name: `${user.firstName} ${user.lastName}`,
      billing_email: user.email,
      billing_tel: user.phoneNumber || "",
      billing_country: user.country || "United Arab Emirates", // 🔄 UPDATED: Changed default country

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
      process.env.NODE_ENV === "production"
        ? process.env.CCAVENUE_PROD_URL
        : process.env.CCAVENUE_TEST_URL;

    // 🔄 UPDATED: Create auto-submit form with AED currency display
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
            .currency-note { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7; }
          </style>
        </head>
        <body>
          <div class="container">
            <h3>🔒 Secure Payment Processing</h3>
            <div class="loader"></div>
            <p>Please wait while we redirect you to our secure payment gateway...</p>
            
            <div class="currency-note">
              <h4>💱 Currency Information</h4>
              <p><strong>Note:</strong> Payment will be processed in AED (UAE Dirham) for testing purposes.</p>
              <p><strong>Original Price:</strong> ${(
                totalOriginalPrice / 3.67
              ).toFixed(2)} USD ≈ ${totalOriginalPrice.toFixed(2)} AED</p>
            </div>
            
            <div class="summary">
              <h4>Order Summary</h4>
              <p><strong>Order #:</strong> ${orderNumber}</p>
              <p><strong>Items:</strong> ${cartItems.length} course(s)</p>
              ${
                totalEarlyBirdSavings > 0
                  ? `<p class="savings"><strong>Early Bird Savings:</strong> ${totalEarlyBirdSavings.toFixed(
                      2
                    )} AED</p>`
                  : ""
              }
              ${
                totalLinkedCourseSavings > 0
                  ? `<p class="savings"><strong>Included Course Savings:</strong> ${totalLinkedCourseSavings.toFixed(
                      2
                    )} AED</p>`
                  : ""
              }
              ${
                promoCodeDiscount > 0
                  ? `<p class="savings"><strong>Promo Discount:</strong> ${promoCodeDiscount.toFixed(
                      2
                    )} AED</p>`
                  : ""
              }
              <p class="amount">Total: ${finalAmount.toFixed(2)} AED</p>
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
      `💳 AED Payment initiated: Order ${orderNumber}, Amount ${finalAmount.toFixed(
        2
      )} AED (converted from ${(finalAmount / 3.67).toFixed(
        2
      )} USD), Transaction ${transactionId}`
    );
    console.log(
      `💰 Savings breakdown: Early Bird ${totalEarlyBirdSavings} AED, Linked Courses ${totalLinkedCourseSavings} AED, Promo ${promoCodeDiscount} AED`
    );
    res.send(paymentForm);
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    res
      .status(500)
      .json({ success: false, message: "Payment processing failed" });
  }
};

// ✅ Handle CCAvenue Payment Response
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
      // Payment successful - update enrollment status
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

// ✅ Handle Payment Cancellation
exports.handlePaymentCancel = (req, res) => {
  console.log("❌ Payment cancelled by user");
  res.redirect("/payment/cancelled");
};

// ✅ Send payment confirmation email
async function sendPaymentConfirmationEmail(user, transaction) {
  const courseListHtml = transaction.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${item.courseTitle}</strong><br>
        <span style="color: #666; font-size: 14px;">Code: ${item.courseCode}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        <strong>$${item.finalPrice}</strong>
      </td>
    </tr>
  `
    )
    .join("");

  const emailHtml = `
    <html>
    <body>
      <h1>🎉 Payment Confirmed!</h1>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>Thank you for your payment! Your transaction has been successfully processed.</p>
      
      <h3>📄 Transaction Details</h3>
      <p><strong>Order Number:</strong> ${transaction.orderNumber}</p>
      <p><strong>Amount Paid:</strong> $${transaction.financial.finalAmount.toFixed(
        2
      )} USD</p>
      
      <h3>📚 Enrolled Courses</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left;">Course</th>
            <th style="padding: 12px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${courseListHtml}
        </tbody>
      </table>
      
      <p>Thank you for choosing IAAI Training Institute!</p>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `Payment Confirmation - IAAI Training (Order #${transaction.orderNumber})`,
    html: emailHtml,
  });
}

// ✅ Send course registration email
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
        <span style="color: #666; font-size: 14px;">Code: ${
          course.courseCode
        }</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${
          course.isLinkedCourseFree
            ? '<span style="color: #007bff;">FREE (Included)</span>'
            : isPromoCode
            ? '<span style="color: #28a745;">FREE</span>'
            : `$${course.price}`
        }
      </td>
    </tr>
  `
    )
    .join("");

  const emailHtml = `
    <html>
    <body>
      <h1>Course Registration Confirmed! 🎉</h1>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>You have successfully registered for the following courses.</p>
      
      <h3>Registration Details:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left;">Course</th>
            <th style="padding: 12px; text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${courseListHtml}
        </tbody>
      </table>
      
      <p><strong>Reference Number:</strong> ${referenceNumber}</p>
      <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
      
      <p>Thank you for choosing IAAI Training Institute!</p>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `Course Registration Confirmed - IAAI Training (Ref: ${referenceNumber})`,
    html: emailHtml,
  });
}
