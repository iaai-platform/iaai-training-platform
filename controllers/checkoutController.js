// controllers/checkoutController.js - FULLY CORRECTED VERSION
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

// ✅ CURRENCY CONVERSION CONSTANT
const EUR_TO_AED_RATE = 4.0;

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

// ✅ Helper function to convert EUR to AED
function convertEurToAed(eurAmount) {
  return roundToTwoDecimals(eurAmount * EUR_TO_AED_RATE);
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
    currency: "EUR",
    isLinkedCourseFree: isLinkedCourse,
  };

  if (isLinkedCourse) {
    if (course.enrollment) {
      pricing.regularPrice = course.enrollment.price || 0;
      pricing.currency = course.enrollment.currency || "EUR";
    } else if (course.access) {
      pricing.regularPrice = course.access.price || 0;
      pricing.currency = course.access.currency || "EUR";
    }
    pricing.currentPrice = 0;
    console.log(
      "🔗 Linked course pricing set to FREE, original:",
      pricing.regularPrice
    );
    return pricing;
  }

  if (course.enrollment) {
    pricing.regularPrice = roundToTwoDecimals(course.enrollment.price || 0);
    pricing.earlyBirdPrice = course.enrollment.earlyBirdPrice
      ? roundToTwoDecimals(course.enrollment.earlyBirdPrice)
      : null;
    pricing.currency = course.enrollment.currency || "EUR";

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
    pricing.regularPrice = roundToTwoDecimals(course.access.price || 0);
    pricing.currentPrice = pricing.regularPrice;
    pricing.currency = course.access.currency || "EUR";
  }

  return pricing;
}

// ✅ Display Checkout Page with dual currency support
exports.getCheckoutPage = async (req, res) => {
  try {
    console.log(
      "🔍 Loading checkout page with dual currency support (EUR/AED)..."
    );
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

    // Round all totals
    totalOriginalPrice = roundToTwoDecimals(totalOriginalPrice);
    totalCurrentPrice = roundToTwoDecimals(totalCurrentPrice);
    totalEarlyBirdSavings = roundToTwoDecimals(totalEarlyBirdSavings);
    totalLinkedCourseSavings = roundToTwoDecimals(totalLinkedCourseSavings);
    const totalSavings = roundToTwoDecimals(
      totalEarlyBirdSavings + totalLinkedCourseSavings
    );

    // Calculate AED equivalents
    const totalPriceAED = convertEurToAed(totalCurrentPrice);
    const totalOriginalPriceAED = convertEurToAed(totalOriginalPrice);
    const totalSavingsAED = convertEurToAed(totalSavings);

    console.log("📍 Enhanced Cart Summary with Dual Currency:", {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length,
      totalOriginal: `€${totalOriginalPrice} (AED ${totalOriginalPriceAED})`,
      totalCurrent: `€${totalCurrentPrice} (AED ${totalPriceAED})`,
      earlyBirdSavings: totalEarlyBirdSavings,
      linkedCourseSavings: totalLinkedCourseSavings,
      totalSavings: `€${totalSavings} (AED ${totalSavingsAED})`,
      conversionRate: EUR_TO_AED_RATE,
    });

    res.render("checkout", {
      coursesInCart,
      totalPrice: totalCurrentPrice,
      totalPriceAED: totalPriceAED,
      totalOriginalPrice: totalOriginalPrice,
      totalOriginalPriceAED: totalOriginalPriceAED,
      totalSavings: totalSavings.toFixed(2),
      totalSavingsAED: totalSavingsAED.toFixed(2),
      hasEarlyBirdDiscounts: totalSavings > 0,
      eurToAedRate: EUR_TO_AED_RATE,
      user,
      paymentGatewayConfigured: !!(
        process.env.CCAVENUE_ACCESS_CODE && process.env.CCAVENUE_MERCHANT_ID
      ),
      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page");
  }
};

// ✅ Apply Promo Code with dual currency support
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

    const promoResult = calculateDiscount(totalPrice, promo.discountPercentage);

    // Calculate AED equivalents for response
    const newTotalPriceAED = convertEurToAed(promoResult.finalPrice);
    const discountAmountAED = convertEurToAed(promoResult.discountAmount);

    console.log(
      `💰 Promo Calculation: €${promoResult.originalPrice} - €${promoResult.discountAmount} = €${promoResult.finalPrice}`
    );
    console.log(
      `💰 AED Equivalent: AED ${convertEurToAed(
        promoResult.originalPrice
      )} - AED ${discountAmountAED} = AED ${newTotalPriceAED}`
    );

    req.session.appliedPromoCode = promo.code;
    const completeRegistration = promoResult.finalPrice <= 0;

    res.json({
      success: true,
      newTotalPrice: promoResult.finalPrice.toFixed(2),
      newTotalPriceAED: newTotalPriceAED.toFixed(2),
      discountAmount: promoResult.discountAmount.toFixed(2),
      discountAmountAED: discountAmountAED.toFixed(2),
      discountPercentage: promo.discountPercentage,
      completeRegistration,
      eurToAedRate: EUR_TO_AED_RATE,
    });
  } catch (err) {
    console.error("❌ Error applying promo code:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Process Checkout (keeping original logic, payment stays in EUR)
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

    totalPrice = roundToTwoDecimals(totalPrice);
    console.log(
      `💰 Calculated total price: €${totalPrice} (AED ${convertEurToAed(
        totalPrice
      )})`
    );

    // Apply promo code discount if exists
    const appliedPromo = req.session.appliedPromoCode;
    let finalPrice = totalPrice;

    if (appliedPromo) {
      const promo = await PromoCode.findOne({
        code: appliedPromo,
        isActive: true,
      });

      if (promo && (!promo.expiryDate || new Date() <= promo.expiryDate)) {
        const promoResult = calculateDiscount(
          totalPrice,
          promo.discountPercentage
        );
        finalPrice = promoResult.finalPrice;

        console.log(
          `🏷️ Promo applied: ${appliedPromo}, Final price: €${finalPrice} (AED ${convertEurToAed(
            finalPrice
          )})`
        );
      }
    }

    // Decide between free registration or payment
    if (finalPrice <= 0) {
      console.log("🎯 Total is €0 - redirecting to complete registration");
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

// ✅ Process Payment
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

// ✅ Complete Registration for FREE courses
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

    // Calculate totals with decimal precision
    const totalAmount = roundToTwoDecimals(
      registeredCourses.reduce((sum, course) => sum + course.price, 0)
    );
    const finalAmount = roundToTwoDecimals(
      registeredCourses.reduce((sum, course) => sum + course.finalPrice, 0)
    );
    const totalSavings = roundToTwoDecimals(totalAmount - finalAmount);

    // Create transaction with proper decimal handling
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
        currency: "EUR",
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

// ✅ FIXED: Payment Processing with Enhanced Error Handling
exports.proceedToPayment = async (req, res) => {
  try {
    // ✅ CRITICAL: Environment Variables Validation
    console.log("🔧 CCAvenue Environment Check:", {
      CCAVENUE_ACCESS_CODE: process.env.CCAVENUE_ACCESS_CODE
        ? "✅ SET"
        : "❌ MISSING",
      CCAVENUE_MERCHANT_ID: process.env.CCAVENUE_MERCHANT_ID
        ? "✅ SET"
        : "❌ MISSING",
      CCAVENUE_WORKING_KEY: process.env.CCAVENUE_WORKING_KEY
        ? "✅ SET"
        : "❌ MISSING",
      ACCESS_CODE_LENGTH: process.env.CCAVENUE_ACCESS_CODE?.length || 0,
      MERCHANT_ID_LENGTH: process.env.CCAVENUE_MERCHANT_ID?.length || 0,
      WORKING_KEY_LENGTH: process.env.CCAVENUE_WORKING_KEY?.length || 0,
    });

    // Check if all required env vars are present
    if (
      !process.env.CCAVENUE_ACCESS_CODE ||
      !process.env.CCAVENUE_MERCHANT_ID ||
      !process.env.CCAVENUE_WORKING_KEY
    ) {
      console.error("❌ CRITICAL: Missing CCAvenue environment variables");
      return res.status(500).json({
        success: false,
        message:
          "Payment gateway not configured. Missing environment variables.",
      });
    }

    console.log("💳 Processing payment with CCAvenue...");
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

    const cartItems = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;
    let totalLinkedCourseSavings = 0;

    // Helper function to process cart items
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
              finalPrice: pricing.currentPrice,
              isEarlyBird: pricing.isEarlyBird,
              earlyBirdSavings: pricing.earlyBirdSavings,
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

    // Round all totals to avoid floating point issues
    totalOriginalPrice = roundToTwoDecimals(totalOriginalPrice);
    totalCurrentPrice = roundToTwoDecimals(totalCurrentPrice);
    totalEarlyBirdSavings = roundToTwoDecimals(totalEarlyBirdSavings);
    totalLinkedCourseSavings = roundToTwoDecimals(totalLinkedCourseSavings);

    // Apply promo code discount
    let promoCodeDiscount = 0;
    let promoCodeData = null;

    if (req.session.appliedPromoCode) {
      const promo = await PromoCode.findOne({
        code: req.session.appliedPromoCode,
      });
      if (promo) {
        const promoResult = calculateDiscount(
          totalCurrentPrice,
          promo.discountPercentage
        );
        promoCodeDiscount = promoResult.discountAmount;

        promoCodeData = {
          code: promo.code,
          discountType: "percentage",
          discountValue: promo.discountPercentage,
          discountAmount: promoCodeDiscount,
        };

        console.log(`💰 Promo discount: €${promoCodeDiscount}`);
      }
    }

    // Convert EUR to AED for CCAvenue payment
    const finalAmountEUR = roundToTwoDecimals(
      Math.max(0, totalCurrentPrice - promoCodeDiscount)
    );
    const finalAmount = convertEurToAed(finalAmountEUR);
    console.log(
      `💰 Final amount for CCAvenue: AED ${finalAmount} (EUR ${finalAmountEUR})`
    );

    // If final amount is 0, redirect to free registration
    if (finalAmountEUR <= 0) {
      console.log("🎯 Final amount is €0, redirecting to free registration");
      return res.redirect("/complete-registration");
    }

    // Create transaction IDs
    const transactionId = `TXN_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const orderNumber = `ORD_${Date.now()}_${userId.toString().slice(-6)}`;

    console.log("🔧 Creating transaction...");

    // Create transaction with proper decimal handling including AED amounts
    const transaction = {
      transactionId: transactionId,
      orderNumber: orderNumber,
      receiptNumber: `REC_${Date.now()}_${Math.floor(Math.random() * 1000)}`,

      createdAt: new Date(),
      transactionDate: new Date(),
      completedAt: null,

      paymentStatus: "pending",
      paymentMethod: "CCAvenue",

      financial: {
        subtotal: totalOriginalPrice,
        subtotalAED: convertEurToAed(totalOriginalPrice),
        discountAmount: roundToTwoDecimals(
          totalEarlyBirdSavings + totalLinkedCourseSavings + promoCodeDiscount
        ),
        discountAmountAED: convertEurToAed(
          roundToTwoDecimals(
            totalEarlyBirdSavings + totalLinkedCourseSavings + promoCodeDiscount
          )
        ),
        earlyBirdSavings: totalEarlyBirdSavings,
        promoCodeDiscount: promoCodeDiscount,
        tax: 0,
        processingFee: 0,
        finalAmount: finalAmountEUR,
        finalAmountAED: finalAmount,
        currency: "EUR",
        currencyPaid: "AED",
        exchangeRate: EUR_TO_AED_RATE,
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
      },

      items: cartItems.map((item) => ({
        courseId: item.courseId,
        courseType: item.courseType,
        courseTitle: item.courseTitle,
        courseCode: item.courseCode,
        originalPrice: item.originalPrice,
        finalPrice: item.finalPrice,
        isEarlyBird: item.isEarlyBird,
        earlyBirdSavings: item.earlyBirdSavings,
        courseSchedule: item.courseSchedule,
        instructor: item.instructor,
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
        isGift: req.body.isGift || false,
        recipientEmail: req.body.giftRecipientEmail || null,
        giftMessage: req.body.giftMessage || null,
        senderName: `${user.firstName} ${user.lastName}`,
      },

      metadata: {
        userAgent: req.get("User-Agent") || "",
        ipAddress: req.ip || "",
        sessionId: req.sessionID || "",
        orderNotes: req.body.orderNotes || "",
        source: "website",
      },

      ccavenue: {
        processedCurrency: "AED",
        processedAmount: finalAmount,
        originalCurrency: "EUR",
        originalAmount: finalAmountEUR,
      },
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

    console.log("💾 Saving transaction...");

    // Add transaction to user
    user.paymentTransactions.push(transaction);
    await user.save({ validateBeforeSave: false });

    console.log("✅ Transaction saved successfully");

    // CCAvenue payment data - SEND AED TO BANK
    const ccavenuePaymentData = {
      // REQUIRED PARAMETERS
      merchant_id: process.env.CCAVENUE_MERCHANT_ID,
      order_id: orderNumber,
      amount: finalAmount.toFixed(2), // AED AMOUNT TO BANK
      currency: "AED", // CURRENCY TO BANK

      // FIXED: Use domain without www to match your actual domain
      redirect_url: "https://iaa-i.com/payment/response",
      cancel_url: "https://iaa-i.com/payment/cancel",

      // REQUIRED: Language parameter
      language: "EN",

      // BILLING INFORMATION (Required for validation)
      billing_name: `${user.firstName} ${user.lastName}`.trim(),
      billing_email: user.email,
      billing_tel: user.phoneNumber || "",
      billing_address: user.address || "Not provided",
      billing_city: user.city || "Not provided",
      billing_state: user.state || "Not provided",
      billing_zip: user.zipCode || "00000",
      billing_country: user.country || "United States",

      // DELIVERY INFORMATION (Can be same as billing)
      delivery_name: `${user.firstName} ${user.lastName}`.trim(),
      delivery_address: user.address || "Not provided",
      delivery_city: user.city || "Not provided",
      delivery_state: user.state || "Not provided",
      delivery_zip: user.zipCode || "00000",
      delivery_country: user.country || "United States",
      delivery_tel: user.phoneNumber || "",

      // MERCHANT PARAMETERS (for tracking)
      merchant_param1: transactionId,
      merchant_param2: userId.toString(),
      merchant_param3: cartItems.length.toString(),
      merchant_param4: req.session.appliedPromoCode || "none",
      merchant_param5: "IAAI_TRAINING",

      // ADDITIONAL REQUIRED PARAMETERS
      order_description: `IAAI Training Course${
        cartItems.length > 1 ? "s" : ""
      }: ${cartItems
        .map((item) => item.courseTitle)
        .join(", ")
        .substring(0, 200)}`,
      promo_code: req.session.appliedPromoCode || "",
      customer_identifier: user.email,

      // INTEGRATION PARAMETERS
      integration_type: "iframe_normal",

      // ADDITIONAL VALIDATION FIELDS
      tid: Date.now().toString(),

      // Add some safety validations
      sub_acc_id: "", // Leave empty unless using sub-accounts
      invoice_number: orderNumber,
    };

    // ✅ ENHANCED VALIDATION: Check all required parameters
    const requiredParams = [
      "merchant_id",
      "order_id",
      "amount",
      "currency",
      "redirect_url",
      "cancel_url",
      "language",
      "billing_name",
      "billing_email",
    ];

    const missingParams = requiredParams.filter(
      (param) =>
        !ccavenuePaymentData[param] ||
        ccavenuePaymentData[param].toString().trim() === ""
    );

    if (missingParams.length > 0) {
      console.error("❌ Missing required CCAvenue parameters:", missingParams);
      return res.status(500).json({
        success: false,
        message: `Missing required parameters: ${missingParams.join(", ")}`,
      });
    }

    // ADDITIONAL VALIDATION: Amount validation
    if (
      isNaN(parseFloat(ccavenuePaymentData.amount)) ||
      parseFloat(ccavenuePaymentData.amount) <= 0
    ) {
      console.error("❌ Invalid amount:", ccavenuePaymentData.amount);
      return res.status(500).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    // Enhanced logging for debugging
    console.log("💳 CCAvenue Parameters (Full):", {
      merchant_id: ccavenuePaymentData.merchant_id,
      order_id: ccavenuePaymentData.order_id,
      amount: ccavenuePaymentData.amount,
      currency: ccavenuePaymentData.currency,
      billing_email: ccavenuePaymentData.billing_email,
      redirect_url: ccavenuePaymentData.redirect_url,
      cancel_url: ccavenuePaymentData.cancel_url,
      language: ccavenuePaymentData.language,
      billing_name: ccavenuePaymentData.billing_name,
      billing_country: ccavenuePaymentData.billing_country,
      paramCount: Object.keys(ccavenuePaymentData).length,
    });

    // ✅ CRITICAL FIX: Enhanced data string validation
    console.log("🔍 Pre-encryption validation:");
    console.log("📊 CCAvenue payment data object:", {
      merchant_id: ccavenuePaymentData.merchant_id,
      order_id: ccavenuePaymentData.order_id,
      amount: ccavenuePaymentData.amount,
      currency: ccavenuePaymentData.currency,
      redirect_url: ccavenuePaymentData.redirect_url,
      cancel_url: ccavenuePaymentData.cancel_url,
      billing_name: ccavenuePaymentData.billing_name,
      billing_email: ccavenuePaymentData.billing_email,
      language: ccavenuePaymentData.language,
    });

    // Convert to query string with better validation
    const dataString = Object.keys(ccavenuePaymentData)
      .filter((key) => {
        const value = ccavenuePaymentData[key];
        const isValid = value !== null && value !== undefined && value !== "";
        if (!isValid) {
          console.log(`⚠️ Excluding empty field: ${key} = '${value}'`);
        }
        return isValid;
      })
      .map((key) => {
        const value = String(ccavenuePaymentData[key]).trim();
        const encoded = encodeURIComponent(value);
        console.log(`🔧 ${key}=${value} → ${encoded}`);
        return `${key}=${encoded}`;
      })
      .join("&");

    console.log("📏 Final data string length:", dataString.length);
    console.log("📝 First 300 chars:", dataString.substring(0, 300));

    // VALIDATE: Ensure critical fields are present in data string
    const criticalFields = ["merchant_id", "order_id", "amount", "currency"];
    const missingCritical = criticalFields.filter(
      (field) => !dataString.includes(field + "=")
    );

    if (missingCritical.length > 0) {
      console.error(
        "❌ CRITICAL FIELDS MISSING from data string:",
        missingCritical
      );
      return res.status(500).json({
        success: false,
        message: `Critical payment fields missing: ${missingCritical.join(
          ", "
        )}`,
      });
    }

    // ENCRYPTION: Use the CCAvenue utility
    let encRequest;
    try {
      console.log("🔐 Starting encryption...");
      encRequest = ccavUtil.encrypt(dataString);
      console.log("✅ Encryption successful");
      console.log("📏 Encrypted string length:", encRequest.length);
      console.log(
        "🔐 First 100 chars of encrypted:",
        encRequest.substring(0, 100)
      );
    } catch (encryptionError) {
      console.error("❌ Encryption failed:", encryptionError);
      console.error(
        "❌ Working key length:",
        process.env.CCAVENUE_WORKING_KEY?.length || 0
      );
      return res.status(500).json({
        success: false,
        message: "Payment encryption failed: " + encryptionError.message,
      });
    }

    // VALIDATE ENVIRONMENT VARIABLES
    if (
      !process.env.CCAVENUE_ACCESS_CODE ||
      !process.env.CCAVENUE_WORKING_KEY
    ) {
      console.error("❌ Missing CCAvenue environment variables");
      return res.status(500).json({
        success: false,
        message: "Payment gateway configuration error",
      });
    }

    const paymentUrl =
      "https://secure.ccavenue.ae/transaction/transaction.do?command=initiateTransaction";

    // ✅ ENHANCED payment form with comprehensive debugging
    const paymentForm = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting to CCAvenue...</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .container { 
              background: white; 
              padding: 40px; 
              border-radius: 15px; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
              max-width: 500px; 
              width: 90%;
            }
            .loader { 
              border: 4px solid #f3f3f3; 
              border-top: 4px solid #007bff; 
              border-radius: 50%; 
              width: 50px; 
              height: 50px; 
              animation: spin 1s linear infinite; 
              margin: 20px auto;
            }
            @keyframes spin { 
              0% { transform: rotate(0deg); } 
              100% { transform: rotate(360deg); } 
            }
            .btn { 
              background: #007bff; 
              color: white; 
              padding: 12px 24px; 
              border: none; 
              border-radius: 5px; 
              cursor: pointer; 
              margin: 10px;
              font-size: 16px;
              transition: background 0.3s;
            }
            .btn:hover { background: #0056b3; }
            .debug { 
              background: #f8f9fa; 
              border: 1px solid #dee2e6; 
              border-radius: 5px; 
              padding: 15px; 
              margin: 20px 0; 
              font-family: monospace; 
              font-size: 12px; 
              text-align: left;
            }
            .status { color: #28a745; font-weight: bold; }
            .error { color: #dc3545; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🔒 Secure Payment Gateway</h2>
            <div class="loader"></div>
            <p><strong>Redirecting to CCAvenue...</strong></p>
            <p>Please wait while we securely redirect you to complete your payment.</p>
            
            <!-- Debug Information -->
            <div class="debug">
              <strong>🔍 Payment Debug Info:</strong><br>
              Order ID: ${orderNumber}<br>
              Amount: AED ${finalAmount.toFixed(
                2
              )} (EUR ${finalAmountEUR.toFixed(2)})<br>
              Merchant ID: ${process.env.CCAVENUE_MERCHANT_ID}<br>
              Access Code: ${process.env.CCAVENUE_ACCESS_CODE}<br>
              Encryption: ${encRequest ? "✅ Success" : "❌ Failed"}<br>
              Data Length: ${encRequest ? encRequest.length : 0} chars<br>
              Redirect URL: ${ccavenuePaymentData.redirect_url}<br>
              Cancel URL: ${ccavenuePaymentData.cancel_url}<br>
              Gateway URL: ${paymentUrl}
            </div>
            
            <form id="paymentForm" method="post" action="${paymentUrl}">
              <input type="hidden" name="encRequest" value="${encRequest}">
              <input type="hidden" name="access_code" value="${
                process.env.CCAVENUE_ACCESS_CODE
              }">
              <button type="submit" class="btn">Proceed to Payment Gateway</button>
            </form>
            
            <div id="status" class="status">
              Initializing secure connection...
            </div>
            
            <div id="manualActions" style="display: none; margin-top: 20px;">
              <p class="error">⚠️ Auto-redirect failed. Please try manual actions:</p>
              <button onclick="retrySubmit()" class="btn">🔄 Retry Payment</button>
              <button onclick="goBack()" class="btn" style="background: #6c757d;">← Back to Checkout</button>
            </div>
          </div>
          
          <script>
            let redirectAttempts = 0;
            const maxAttempts = 3;
            
            function updateStatus(message, isError = false) {
              const statusEl = document.getElementById('status');
              statusEl.textContent = message;
              statusEl.className = isError ? 'error' : 'status';
              console.log(isError ? '❌' : '✅', message);
            }
            
            function retrySubmit() {
              if (redirectAttempts < maxAttempts) {
                redirectAttempts++;
                updateStatus(\`Retry attempt \${redirectAttempts}/\${maxAttempts}...\`);
                document.getElementById('manualActions').style.display = 'none';
                submitForm();
              } else {
                updateStatus('Max retry attempts reached. Please go back and try again.', true);
              }
            }
            
            function goBack() {
              window.location.href = '/checkout';
            }
            
            function submitForm() {
              try {
                updateStatus('Submitting to CCAvenue...');
                console.log('🚀 Form submission attempt:', {
                  action: '${paymentUrl}',
                  encRequestLength: '${encRequest ? encRequest.length : 0}',
                  accessCode: '${process.env.CCAVENUE_ACCESS_CODE}',
                  attempt: redirectAttempts + 1
                });
                
                document.getElementById('paymentForm').submit();
                
                // Set timeout to show manual options if redirect doesn't work
                setTimeout(() => {
                  updateStatus('Redirect taking longer than expected...', true);
                  document.getElementById('manualActions').style.display = 'block';
                }, 8000);
                
              } catch (error) {
                console.error('❌ Form submission error:', error);
                updateStatus('Form submission failed: ' + error.message, true);
                document.getElementById('manualActions').style.display = 'block';
              }
            }
            
            // Auto-submit after 3 seconds
            setTimeout(submitForm, 3000);
            
            // Manual form submission handler
            document.getElementById('paymentForm').addEventListener('submit', function(e) {
              updateStatus('Form submitted manually');
              console.log('📤 Manual form submission to CCAvenue');
            });
            
            // Page unload detection
            window.addEventListener('beforeunload', function() {
              console.log('📄 Page unloading - likely successful redirect to CCAvenue');
            });
          </script>
        </body>
      </html>
    `;

    console.log(`💳 Payment form generated for Order ${orderNumber}`);
    console.log(`🔗 Target URL: ${paymentUrl}`);
    console.log(
      `📊 Payment Amount: AED ${finalAmount.toFixed(
        2
      )} (EUR ${finalAmountEUR.toFixed(2)})`
    );

    res.send(paymentForm);
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Payment processing failed: " + error.message,
    });
  }
};

// ✅ Handle Payment Response
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
        <span style="color: #666; font-size: 14px;">Code: ${
          item.courseCode
        }</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        <strong>€${item.finalPrice.toFixed(2)}</strong>
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
      <p><strong>Amount Paid:</strong> €${transaction.financial.finalAmount.toFixed(
        2
      )} (AED ${
    transaction.financial.finalAmountAED
      ? transaction.financial.finalAmountAED.toFixed(2)
      : "N/A"
  })</p>
      
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
            : `€${course.price.toFixed(2)}`
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

// ✅ Additional utility functions for dual currency support
function getExchangeRate() {
  return EUR_TO_AED_RATE;
}

function formatCurrency(amount, currency = "EUR") {
  const rounded = roundToTwoDecimals(amount);
  return currency === "EUR"
    ? `€${rounded.toFixed(2)}`
    : `AED ${rounded.toFixed(2)}`;
}

function formatDualCurrency(eurAmount) {
  const aedAmount = convertEurToAed(eurAmount);
  return {
    eur: formatCurrency(eurAmount, "EUR"),
    aed: formatCurrency(aedAmount, "AED"),
    eurValue: roundToTwoDecimals(eurAmount),
    aedValue: roundToTwoDecimals(aedAmount),
  };
}

function logDualCurrencyAmount(description, eurAmount) {
  const aedAmount = convertEurToAed(eurAmount);
  console.log(
    `${description}: €${eurAmount.toFixed(2)} (AED ${aedAmount.toFixed(2)})`
  );
}

function validateCurrencyAmount(amount, currency = "EUR") {
  if (isNaN(amount) || amount < 0) {
    throw new Error(`Invalid ${currency} amount: ${amount}`);
  }
  return roundToTwoDecimals(amount);
}

function getCoursePricingSummary(courses) {
  const summary = {
    totalOriginalEUR: 0,
    totalCurrentEUR: 0,
    totalSavingsEUR: 0,
    totalOriginalAED: 0,
    totalCurrentAED: 0,
    totalSavingsAED: 0,
    courseCount: courses.length,
  };

  courses.forEach((course) => {
    summary.totalOriginalEUR += course.originalPrice || 0;
    summary.totalCurrentEUR += course.price || 0;
  });

  summary.totalOriginalEUR = roundToTwoDecimals(summary.totalOriginalEUR);
  summary.totalCurrentEUR = roundToTwoDecimals(summary.totalCurrentEUR);
  summary.totalSavingsEUR = roundToTwoDecimals(
    summary.totalOriginalEUR - summary.totalCurrentEUR
  );

  summary.totalOriginalAED = convertEurToAed(summary.totalOriginalEUR);
  summary.totalCurrentAED = convertEurToAed(summary.totalCurrentEUR);
  summary.totalSavingsAED = convertEurToAed(summary.totalSavingsEUR);

  return summary;
}

// ✅ Export utility functions for use in other modules if needed
exports.convertEurToAed = convertEurToAed;
exports.formatDualCurrency = formatDualCurrency;
exports.getExchangeRate = getExchangeRate;
exports.formatCurrency = formatCurrency;
exports.logDualCurrencyAmount = logDualCurrencyAmount;
exports.validateCurrencyAmount = validateCurrencyAmount;
exports.getCoursePricingSummary = getCoursePricingSummary;

// ✅ Export the conversion rate constant
module.exports.EUR_TO_AED_RATE = EUR_TO_AED_RATE;
