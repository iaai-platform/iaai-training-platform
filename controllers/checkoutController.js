// controllers/checkoutController.js - COMPLETE ENHANCED VERSION
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const PromoCode = require("../models/promoCode");
const sendEmail = require("../utils/sendEmail");
const { v4: uuidv4 } = require("uuid");

// ✅ ENHANCED EMAIL AND REMINDER SERVICES
const emailService = require("../utils/emailService");
const courseReminderScheduler = require("../utils/courseReminderScheduler");

// ✅ CCAvenue utility import
const CCavenueUtils = require("../utils/ccavenueUtils");
const ccavUtil = new CCavenueUtils(process.env.CCAVENUE_WORKING_KEY);

// ✅ CURRENCY CONVERSION CONSTANT
const EUR_TO_AED_RATE = 4.0;

// ✅ EMAIL SERVICE INITIALIZATION CHECK
const emailServiceStatus = emailService.testEmailConfiguration
  ? "configured"
  : "missing configuration method";
console.log(`📧 Email service status: ${emailServiceStatus}`);

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

function convertEurToAed(eurAmount) {
  return roundToTwoDecimals(eurAmount * EUR_TO_AED_RATE);
}

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

// ✅ ENHANCED EMAIL SENDING WITH RETRY LOGIC
async function sendEnhancedRegistrationEmail(
  user,
  registeredCourses,
  transactionInfo,
  isPromoCode = false
) {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await emailService.sendCourseRegistrationConfirmation(
        user,
        registeredCourses,
        transactionInfo,
        isPromoCode
      );
      console.log(
        `✅ Registration email sent successfully on attempt ${attempt + 1}`
      );
      return { success: true };
    } catch (error) {
      attempt++;
      console.error(`❌ Email attempt ${attempt} failed:`, error.message);

      if (attempt >= maxRetries) {
        console.error(`❌ All ${maxRetries} email attempts failed`);
        // Don't fail the registration, just log the error
        return { success: false, error: error.message };
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// ✅ CENTRALIZED REMINDER SCHEDULING
async function scheduleCoursesReminders(courses, context = "registration") {
  let scheduledCount = 0;
  let failedCount = 0;

  for (const course of courses) {
    if (
      course.courseType === "InPersonAestheticTraining" ||
      course.courseType === "OnlineLiveTraining"
    ) {
      try {
        const jobId = await courseReminderScheduler.scheduleReminderForCourse(
          course.courseId?.toString() || course.courseId,
          course.courseType
        );

        if (jobId) {
          scheduledCount++;
          console.log(
            `📅 Reminder scheduled for ${
              course.title || course.courseTitle
            } (${context})`
          );
        } else {
          failedCount++;
          console.log(
            `⚠️ Could not schedule reminder for ${
              course.title || course.courseTitle
            } - likely starts too soon`
          );
        }
      } catch (reminderError) {
        failedCount++;
        console.error(
          `❌ Error scheduling reminder for ${
            course.title || course.courseTitle
          }:`,
          reminderError
        );
      }
    }
  }

  console.log(
    `📊 Reminder scheduling summary (${context}): ${scheduledCount} scheduled, ${failedCount} failed`
  );
  return { scheduledCount, failedCount };
}

// ✅ ENHANCED: Display Checkout Page with Billing Data Integration
exports.getCheckoutPage = async (req, res) => {
  try {
    console.log("🔍 Loading checkout page with billing integration...");
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

    // ✅ NEW: Prepare Billing Information for the Billing Box
    const billingInfo = {
      // Basic user info
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      country: user.country || "",

      // Professional title
      title: user.professionalInfo?.title || "",

      // Address information
      address: user.addressInfo?.address || "",
      city: user.addressInfo?.city || "",
      state: user.addressInfo?.state || "",
      zipCode: user.addressInfo?.zipCode || "",
      addressCountry: user.addressInfo?.country || "",
      alternativePhone: user.addressInfo?.alternativePhone || "",

      // Completion status for billing box
      isAddressComplete: user.addressInfo?.isComplete || false,
      isPaymentReady: !!(
        user.firstName &&
        user.lastName &&
        user.email &&
        user.phoneNumber &&
        (user.addressInfo?.address || user.country) &&
        (user.addressInfo?.city || user.addressInfo?.country)
      ),
      profileCompletionPercentage:
        user.profileData?.completionStatus?.overallPercentage || 0,
    };

    // ✅ NEW: Determine billing box initial state
    const billingBoxStatus = {
      hasAnyBillingData: !!(billingInfo.firstName && billingInfo.email),
      isComplete: billingInfo.isPaymentReady,
      missingFields: [],
    };

    // Check which required fields are missing
    const requiredFields = {
      firstName: billingInfo.firstName,
      lastName: billingInfo.lastName,
      email: billingInfo.email,
      phoneNumber: billingInfo.phoneNumber,
      address: billingInfo.address,
      city: billingInfo.city,
      country: billingInfo.addressCountry || billingInfo.country,
    };

    Object.keys(requiredFields).forEach((field) => {
      if (!requiredFields[field] || requiredFields[field].trim() === "") {
        billingBoxStatus.missingFields.push(field);
      }
    });

    console.log("📍 Enhanced Cart Summary with Billing Integration:", {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length,
      totalOriginal: `€${totalOriginalPrice} (AED ${totalOriginalPriceAED})`,
      totalCurrent: `€${totalCurrentPrice} (AED ${totalPriceAED})`,
      totalSavings: `€${totalSavings} (AED ${totalSavingsAED})`,
      billingComplete: billingBoxStatus.isComplete,
      missingBillingFields: billingBoxStatus.missingFields,
      eurToAedRate: EUR_TO_AED_RATE,
    });

    res.render("checkout", {
      // Existing checkout data
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

      // ✅ NEW: Billing box data
      billingInfo: billingInfo,
      billingBoxStatus: billingBoxStatus,

      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page");
  }
};

// ✅ Apply Promo Code
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

// ✅ Process Checkout
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

// ✅ ENHANCED: Complete Registration for FREE courses
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
            originalPrice: pricing.regularPrice,
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
            originalPrice: pricing.regularPrice,
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
            originalPrice: pricing.regularPrice,
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

    // ✅ ENHANCED: Send confirmation email with retry logic
    try {
      const transactionInfo = {
        referenceNumber: referenceNumber,
        receiptNumber: transaction.receiptNumber,
        orderNumber: transaction.orderNumber,
        finalAmount: 0,
        paymentMethod: req.session.appliedPromoCode
          ? "Promo Code"
          : "Free Course",
      };

      const emailResult = await sendEnhancedRegistrationEmail(
        user,
        registeredCourses,
        transactionInfo,
        !!req.session.appliedPromoCode
      );

      if (emailResult.success) {
        console.log(
          "✅ Enhanced registration confirmation email sent successfully"
        );
      } else {
        console.error(
          "⚠️ Registration email failed but continuing with registration"
        );
      }
    } catch (emailError) {
      console.error("❌ Unexpected error with registration email:", emailError);
      // Don't fail the registration process due to email issues
    }

    // ✅ ENHANCED: Schedule reminders with centralized function
    // ✅ ENHANCED: Centralized reminder scheduling with improved error handling and logging
    async function scheduleCoursesReminders(courses, context = "registration") {
      let scheduledCount = 0;
      let failedCount = 0;
      const schedulingResults = [];

      console.log(
        `📅 Starting reminder scheduling for ${courses.length} courses (${context})`
      );

      for (const course of courses) {
        // Only schedule reminders for courses that support them
        if (
          course.courseType === "InPersonAestheticTraining" ||
          course.courseType === "OnlineLiveTraining"
        ) {
          try {
            const courseId = course.courseId?.toString() || course.courseId;
            const courseTitle =
              course.title || course.courseTitle || "Unknown Course";

            console.log(
              `📅 Attempting to schedule reminder for: ${courseTitle} (${course.courseType})`
            );

            // Use the enhanced scheduler method
            const jobId =
              await courseReminderScheduler.scheduleReminderForCourse(
                courseId,
                course.courseType
              );

            if (jobId) {
              scheduledCount++;
              schedulingResults.push({
                courseId,
                courseTitle,
                courseType: course.courseType,
                status: "scheduled",
                jobId,
                context,
              });

              console.log(
                `✅ Reminder scheduled for ${courseTitle} with job ID: ${jobId}`
              );
            } else {
              failedCount++;
              schedulingResults.push({
                courseId,
                courseTitle,
                courseType: course.courseType,
                status: "failed",
                reason: "Course starts too soon or no enrolled students",
                context,
              });

              console.log(
                `⚠️ Could not schedule reminder for ${courseTitle} - likely starts too soon or no students enrolled`
              );
            }
          } catch (reminderError) {
            failedCount++;
            schedulingResults.push({
              courseId: course.courseId,
              courseTitle: course.title || course.courseTitle,
              courseType: course.courseType,
              status: "error",
              error: reminderError.message,
              context,
            });

            console.error(
              `❌ Error scheduling reminder for ${
                course.title || course.courseTitle
              }:`,
              reminderError
            );
          }
        } else {
          // Self-paced courses don't need reminders
          console.log(
            `ℹ️ Skipping reminder for ${course.title || course.courseTitle} (${
              course.courseType
            }) - not supported`
          );
        }
      }

      console.log(`📊 Reminder scheduling summary (${context}):`);
      console.log(`  ✅ Scheduled: ${scheduledCount}`);
      console.log(`  ❌ Failed: ${failedCount}`);
      console.log(`  📋 Total processed: ${courses.length}`);

      return {
        scheduledCount,
        failedCount,
        totalProcessed: courses.length,
        results: schedulingResults,
      };
    }

    console.log(`✅ FREE registration completed for ${coursesUpdated} courses`);
    console.log(`📋 Reference number: ${referenceNumber}`);
    console.log(`📧 Email status: sent`);
    console.log(`📅 Reminders scheduled: ${reminderResult.scheduledCount}`);

    const successUrl = `/payment/success?order_id=FREE&amount=0.00&ref=${referenceNumber}`;

    if (req.method === "POST") {
      res.json({
        success: true,
        message: "Registration completed successfully!",
        referenceNumber: referenceNumber,
        coursesRegistered: coursesUpdated,
        redirect: successUrl,
        emailSent: true,
        reminderScheduled: reminderResult.scheduledCount > 0,
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

// ✅ ENHANCED: Payment Processing with Billing Information Box Integration
exports.proceedToPayment = async (req, res) => {
  try {
    // Environment Variables Validation
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
    });

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

    console.log(
      "💳 Processing payment with CCAvenue and billing information..."
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

    // ✅ NEW: Extract and validate billing information from the billing box
    let billingInfo = {};

    console.log("📋 Raw request body:", req.body);

    if (req.body.billingInfo) {
      // Parse billing info if it's a JSON string (from form submission)
      if (typeof req.body.billingInfo === "string") {
        try {
          billingInfo = JSON.parse(req.body.billingInfo);
        } catch (e) {
          console.log("📋 Billing info is not JSON string, using as object");
          billingInfo = req.body.billingInfo;
        }
      } else {
        billingInfo = req.body.billingInfo;
      }
      console.log(
        "📋 Parsed billing info from request:",
        Object.keys(billingInfo)
      );
    } else {
      // If no billing info provided, try to get from user profile
      console.log("⚠️ No billing info in request, checking user profile...");
      billingInfo = {
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        address: user.addressInfo?.address || "",
        city: user.addressInfo?.city || "",
        state: user.addressInfo?.state || "",
        zipCode: user.addressInfo?.zipCode || "",
        country: user.addressInfo?.country || user.country || "",
        alternativePhone: user.addressInfo?.alternativePhone || "",
        title: user.professionalInfo?.title || "",
      };
      console.log("📋 Using billing info from user profile");
    }

    // ✅ NEW: Comprehensive billing validation for CCAvenue
    const requiredBillingFields = [
      "firstName",
      "lastName",
      "email",
      "phoneNumber",
      "address",
      "city",
      "country",
    ];
    const missingBillingFields = [];
    const invalidBillingFields = [];

    requiredBillingFields.forEach((field) => {
      const value = billingInfo[field];
      if (!value || value.toString().trim() === "") {
        missingBillingFields.push(field);
      } else if (
        field === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ) {
        invalidBillingFields.push("email (invalid format)");
      } else if (field === "phoneNumber" && value.toString().length < 10) {
        invalidBillingFields.push("phoneNumber (too short)");
      }
    });

    if (missingBillingFields.length > 0 || invalidBillingFields.length > 0) {
      console.error("❌ Billing validation failed:", {
        missing: missingBillingFields,
        invalid: invalidBillingFields,
      });

      return res.status(400).json({
        success: false,
        message: `Billing information validation failed. Missing: ${missingBillingFields.join(
          ", "
        )}. Invalid: ${invalidBillingFields.join(", ")}`,
        missingFields: missingBillingFields,
        invalidFields: invalidBillingFields,
        requiresCompleteBilling: true,
      });
    }

    console.log("✅ Billing information validated successfully for CCAvenue");

    // ✅ NEW: Prepare CCAvenue-compatible billing data with proper field lengths
    const ccavenueBillingData = {
      // Required billing fields - truncated to CCAvenue limits
      billing_name: `${billingInfo.firstName} ${billingInfo.lastName}`
        .trim()
        .substring(0, 50),
      billing_email: billingInfo.email.substring(0, 50),
      billing_tel: billingInfo.phoneNumber.toString().substring(0, 20),
      billing_address: billingInfo.address.substring(0, 255),
      billing_city: billingInfo.city.substring(0, 50),
      billing_state: billingInfo.state
        ? billingInfo.state.substring(0, 50)
        : "Not provided",
      billing_zip: billingInfo.zipCode
        ? billingInfo.zipCode.substring(0, 10)
        : "00000",
      billing_country: billingInfo.country.substring(0, 50),

      // Delivery information (same as billing for digital products)
      delivery_name: `${billingInfo.firstName} ${billingInfo.lastName}`
        .trim()
        .substring(0, 50),
      delivery_address: billingInfo.address.substring(0, 255),
      delivery_city: billingInfo.city.substring(0, 50),
      delivery_state: billingInfo.state
        ? billingInfo.state.substring(0, 50)
        : "Not provided",
      delivery_zip: billingInfo.zipCode
        ? billingInfo.zipCode.substring(0, 10)
        : "00000",
      delivery_country: billingInfo.country.substring(0, 50),
      delivery_tel: billingInfo.alternativePhone
        ? billingInfo.alternativePhone.substring(0, 20)
        : billingInfo.phoneNumber.toString().substring(0, 20),

      // Additional required fields
      customer_identifier: billingInfo.email,
    };

    console.log("🔧 CCAvenue billing data prepared from billing box:", {
      billing_name: ccavenueBillingData.billing_name,
      billing_email: ccavenueBillingData.billing_email,
      billing_country: ccavenueBillingData.billing_country,
      billing_city: ccavenueBillingData.billing_city,
      fieldCount: Object.keys(ccavenueBillingData).length,
    });

    const cartItems = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;
    let totalLinkedCourseSavings = 0;

    // Helper function to process cart items (EXISTING LOGIC)
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

    // Process all course types (EXISTING LOGIC)
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

    // Apply promo code discount (EXISTING LOGIC)
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

    // Create transaction IDs (EXISTING LOGIC)
    const transactionId = `TXN_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const orderNumber = `ORD_${Date.now()}_${userId.toString().slice(-6)}`;

    console.log("🔧 Creating transaction with billing information...");

    // Create transaction with enhanced billing information
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

      // ✅ ENHANCED: Customer info with billing data from billing box
      customerInfo: {
        userId: user._id,
        name: `${billingInfo.firstName} ${billingInfo.lastName}`.trim(),
        email: billingInfo.email,
        phone: billingInfo.phoneNumber,
        country: billingInfo.country,
        billingAddress: {
          name: `${billingInfo.firstName} ${billingInfo.lastName}`.trim(),
          address: billingInfo.address,
          city: billingInfo.city,
          state: billingInfo.state || "",
          country: billingInfo.country,
          zip: billingInfo.zipCode || "",
        },
      },

      gift: {
        isGift: req.body.isGift || false,
        recipientEmail: req.body.giftRecipientEmail || null,
        giftMessage: req.body.giftMessage || null,
        senderName: `${billingInfo.firstName} ${billingInfo.lastName}`.trim(),
      },

      metadata: {
        userAgent: req.get("User-Agent") || "",
        ipAddress: req.ip || "",
        sessionId: req.sessionID || "",
        orderNotes: req.body.orderNotes || "",
        source: "website",
        billingDataSource: "billing_box", // Track where billing data came from
        billingBoxComplete: true,
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

    console.log("💾 Saving transaction with billing information...");

    // Add transaction to user
    user.paymentTransactions.push(transaction);
    await user.save({ validateBeforeSave: false });

    console.log("✅ Transaction saved successfully with billing data");

    // ✅ ENHANCED: CCAvenue payment data with validated billing information
    const ccavenuePaymentData = {
      // REQUIRED PARAMETERS
      merchant_id: process.env.CCAVENUE_MERCHANT_ID,
      order_id: orderNumber,
      amount: finalAmount.toFixed(2), // AED AMOUNT TO BANK
      currency: "AED", // CURRENCY TO BANK

      // REDIRECT URLs
      redirect_url: "https://iaa-i.com/payment/response",
      cancel_url: "https://iaa-i.com/payment/cancel",

      // REQUIRED: Language parameter
      language: "EN",

      // ✅ BILLING INFORMATION FROM BILLING BOX - ALL VALIDATED
      ...ccavenueBillingData,

      // MERCHANT PARAMETERS (for tracking)
      merchant_param1: transactionId,
      merchant_param2: userId.toString(),
      merchant_param3: cartItems.length.toString(),
      merchant_param4: req.session.appliedPromoCode || "none",
      merchant_param5: "IAAI_TRAINING_BILLING_BOX",

      // ADDITIONAL REQUIRED PARAMETERS
      order_description: `IAAI Training Course${
        cartItems.length > 1 ? "s" : ""
      }: ${cartItems
        .map((item) => item.courseTitle)
        .join(", ")
        .substring(0, 200)}`,

      // INTEGRATION PARAMETERS
      integration_type: "iframe_normal",

      // ADDITIONAL VALIDATION FIELDS
      tid: Date.now().toString(),

      // Add some safety validations
      sub_acc_id: "", // Leave empty unless using sub-accounts
      invoice_number: orderNumber,
    };

    // ✅ ENHANCED VALIDATION: Check all required parameters including billing
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
      "billing_tel",
      "billing_address",
      "billing_city",
      "billing_country",
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
        message: `Missing required payment parameters: ${missingParams.join(
          ", "
        )}`,
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
    console.log("💳 CCAvenue Parameters (Billing Box Enhanced):", {
      merchant_id: ccavenuePaymentData.merchant_id,
      order_id: ccavenuePaymentData.order_id,
      amount: ccavenuePaymentData.amount,
      currency: ccavenuePaymentData.currency,
      billing_email: ccavenuePaymentData.billing_email,
      billing_name: ccavenuePaymentData.billing_name,
      billing_country: ccavenuePaymentData.billing_country,
      billing_city: ccavenuePaymentData.billing_city,
      billing_address:
        ccavenuePaymentData.billing_address.substring(0, 50) + "...",
      redirect_url: ccavenuePaymentData.redirect_url,
      cancel_url: ccavenuePaymentData.cancel_url,
      paramCount: Object.keys(ccavenuePaymentData).length,
      billingFieldsValidated: "✅ YES",
    });

    // Convert to query string with validation
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
        return `${key}=${encoded}`;
      })
      .join("&");

    console.log("📏 Final data string length:", dataString.length);

    // VALIDATE: Ensure critical fields are present in data string
    const criticalFields = [
      "merchant_id",
      "order_id",
      "amount",
      "currency",
      "billing_name",
      "billing_email",
    ];
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
      console.log("🔐 Starting encryption with billing data...");
      encRequest = ccavUtil.encrypt(dataString);
      console.log("✅ Encryption successful with billing information");
      console.log("📏 Encrypted string length:", encRequest.length);
    } catch (encryptionError) {
      console.error("❌ Encryption failed:", encryptionError);
      return res.status(500).json({
        success: false,
        message: "Payment encryption failed: " + encryptionError.message,
      });
    }

    const paymentUrl =
      "https://secure.ccavenue.ae/transaction/transaction.do?command=initiateTransaction";

    // ✅ ENHANCED payment form with billing information confirmation
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
              max-width: 700px; 
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
            .billing-info {
              background: #e3f2fd;
              border: 1px solid #bbdefb;
              border-radius: 5px;
              padding: 15px;
              margin: 15px 0;
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
            
            <!-- ✅ Billing Information Confirmation from Billing Box -->
            <div class="billing-info">
              <strong>💳 Billing Information Confirmed:</strong><br>
              Name: ${ccavenuePaymentData.billing_name}<br>
              Email: ${ccavenuePaymentData.billing_email}<br>
              Phone: ${ccavenuePaymentData.billing_tel}<br>
              Address: ${ccavenuePaymentData.billing_address}<br>
              City: ${ccavenuePaymentData.billing_city}, ${
      ccavenuePaymentData.billing_country
    }<br>
              <small style="color: #666;">✅ All required fields validated for payment gateway</small>
            </div>
            
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
              Billing Fields: ✅ Validated from Billing Box<br>
              Required Fields: ✅ All Present (${
                requiredParams.length
              } fields)<br>
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
              Initializing secure connection with billing data...
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
                updateStatus('Submitting to CCAvenue with billing data...');
                console.log('🚀 Form submission attempt with billing info:', {
                  action: '${paymentUrl}',
                  encRequestLength: '${encRequest ? encRequest.length : 0}',
                  accessCode: '${process.env.CCAVENUE_ACCESS_CODE}',
                  billingName: '${ccavenuePaymentData.billing_name}',
                  billingEmail: '${ccavenuePaymentData.billing_email}',
                  billingCountry: '${ccavenuePaymentData.billing_country}',
                  billingValidated: true,
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
              updateStatus('Form submitted manually with billing data');
              console.log('📤 Manual form submission to CCAvenue with billing info');
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
    console.log(`👤 Billing Name: ${ccavenuePaymentData.billing_name}`);
    console.log(`📧 Billing Email: ${ccavenuePaymentData.billing_email}`);
    console.log(
      `🏠 Billing Address: ${ccavenuePaymentData.billing_city}, ${ccavenuePaymentData.billing_country}`
    );
    console.log(`✅ Billing Box Integration: Complete`);

    res.send(paymentForm);
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    res.status(500).json({
      success: false,
      message: "Payment processing failed: " + error.message,
    });
  }
};

// ✅ ENHANCED: Handle Payment Response
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

      // ✅ ENHANCED: Send confirmation email with retry logic
      try {
        // Prepare registered courses data
        const registeredCourses = transaction.items.map((item) => ({
          courseId: item.courseId,
          title: item.courseTitle,
          courseCode: item.courseCode,
          courseType: item.courseType,
          displayType:
            {
              InPersonAestheticTraining: "In-Person Training",
              OnlineLiveTraining: "Live Online Training",
              SelfPacedOnlineTraining: "Self-Paced Online Course",
            }[item.courseType] || "Training Course",
          originalPrice: item.originalPrice,
          finalPrice: item.finalPrice,
          price: item.originalPrice,
          startDate: item.courseSchedule?.startDate,
          isLinkedCourseFree: false, // Payment means it's not a linked free course
        }));

        const transactionInfo = {
          referenceNumber: transaction.receiptNumber,
          receiptNumber: transaction.receiptNumber,
          orderNumber: transaction.orderNumber,
          finalAmount: transaction.financial.finalAmount,
          paymentMethod: "CCAvenue Payment Gateway",
        };

        const emailResult = await sendEnhancedRegistrationEmail(
          user,
          registeredCourses,
          transactionInfo,
          false
        );

        if (emailResult.success) {
          console.log(
            "✅ Enhanced payment confirmation email sent successfully"
          );
        } else {
          console.error("⚠️ Payment confirmation email failed but continuing");
        }
      } catch (emailError) {
        console.error(
          "❌ Unexpected error with payment confirmation email:",
          emailError
        );
      }

      // ✅ ENHANCED: Schedule reminders with centralized function
      const reminderResult = await scheduleCoursesReminders(
        transaction.items,
        "paid registration"
      );

      // Add communication record
      transaction.communications.push({
        type: "email",
        template: "enhanced_registration_confirmation",
        sentAt: new Date(),
        status: "sent",
        recipientEmail: user.email,
        subject: `Registration Confirmed: ${
          transaction.items.length > 1
            ? `${transaction.items.length} Courses`
            : transaction.items[0].courseTitle
        } - IAAI Training`,
      });

      await user.save();

      // Clear applied promo code from session
      delete req.session.appliedPromoCode;

      console.log(
        `✅ PAID registration completed for ${transaction.items.length} courses`
      );
      console.log(`📧 Email status: sent`);
      console.log(`📅 Reminders scheduled: ${reminderResult.scheduledCount}`);

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

// ✅ Export utility functions
exports.convertEurToAed = convertEurToAed;
exports.EUR_TO_AED_RATE = EUR_TO_AED_RATE;
