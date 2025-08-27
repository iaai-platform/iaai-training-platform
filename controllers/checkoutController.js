// controllers/checkoutController.js - COMPLETE FIXED VERSION WITH CERTIFICATE PRICING
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const PromoCode = require("../models/promoCode");
const sendEmail = require("../utils/sendEmail");
const { v4: uuidv4 } = require("uuid");
const { validatePromoCode } = require("./promoCodeAdminController");

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

// ✅ FIXED: Helper function to get stored course price (includes certificate fees)
function getStoredCoursePrice(enrollment, isLinkedCourse = false) {
  if (isLinkedCourse) {
    return 0; // Linked courses are always free
  }

  // Use the stored paidAmount which includes certificate fees
  const storedPrice = enrollment.enrollmentData.paidAmount || 0;

  console.log(`💰 Using stored price:`, {
    courseName: enrollment.enrollmentData.courseName,
    originalPrice: enrollment.enrollmentData.originalPrice,
    paidAmount: storedPrice,
    certificateFee: enrollment.enrollmentData.certificateFee,
    enrollmentType: enrollment.enrollmentData.enrollmentType,
    isLinkedCourse: isLinkedCourse,
  });

  return storedPrice;
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

// ✅ FIXED: Display Checkout Page with Certificate Price Support
exports.getCheckoutPage = async (req, res) => {
  try {
    console.log("🔍 Loading checkout page with certificate price support...");
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

    // ✅ FIXED: Process In-Person Courses
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

        // ⭐ FIX: Use stored price instead of recalculating
        const finalPrice = getStoredCoursePrice(item, isLinkedCourse);
        const originalPrice = item.enrollmentData.originalPrice || 0;

        // Calculate savings for display
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate,
          isLinkedCourse
        );

        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: finalPrice, // ✅ NOW USES STORED PRICE WITH CERTIFICATE
          originalPrice: originalPrice,
          isEarlyBird: pricing.isEarlyBird,
          earlyBirdSavings: pricing.earlyBirdSavings,
          isLinkedCourseFree: pricing.isLinkedCourseFree,
          courseType: "InPersonAestheticTraining",
          displayType: "In-Person",
          startDate: course.schedule?.startDate || null,
          enrollmentType: item.enrollmentData.enrollmentType || "paid_regular",
          certificateRequested:
            item.enrollmentData.certificateRequested || false,
          certificateFee: item.enrollmentData.certificateFee || 0,
          isFreeWithCertificate:
            item.enrollmentData.enrollmentType === "free_with_certificate",
        });

        totalOriginalPrice += originalPrice;
        totalCurrentPrice += finalPrice; // ✅ NOW INCLUDES CERTIFICATE FEES
        totalEarlyBirdSavings += pricing.earlyBirdSavings;
        if (pricing.isLinkedCourseFree) {
          totalLinkedCourseSavings += originalPrice;
        }
      }
    }

    // ✅ FIXED: Process Online Live Courses with Certificate Support
    const liveCartItems =
      user.myLiveCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId).lean();
      if (course) {
        const isLinkedCourse = item.enrollmentData.isLinkedCourseFree || false;

        // ⭐ FIX: Use stored price instead of recalculating
        const finalPrice = getStoredCoursePrice(item, isLinkedCourse);
        const originalPrice = item.enrollmentData.originalPrice || 0;

        console.log(`💰 Online course pricing - FIXED:`, {
          courseTitle: course.basic?.title,
          originalPrice: originalPrice,
          paidAmount: item.enrollmentData.paidAmount,
          finalPrice: finalPrice,
          certificateFee: item.enrollmentData.certificateFee,
          enrollmentType: item.enrollmentData.enrollmentType,
          isLinkedCourse: isLinkedCourse,
        });

        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: finalPrice, // ✅ NOW USES STORED PRICE WITH CERTIFICATE
          originalPrice: originalPrice,
          isEarlyBird: false, // For linked courses, no early bird
          earlyBirdSavings: 0,
          isLinkedCourseFree: isLinkedCourse,
          courseType: "OnlineLiveTraining",
          displayType: isLinkedCourse
            ? "Online Live (Included)"
            : "Online Live",
          startDate: course.schedule?.startDate || null,
          enrollmentType:
            item.enrollmentData.enrollmentType ||
            (isLinkedCourse ? "linked_free" : "free_no_certificate"),
          certificateRequested:
            item.enrollmentData.certificateRequested || false,
          certificateFee: item.enrollmentData.certificateFee || 0,
          isFreeWithCertificate:
            item.enrollmentData.enrollmentType === "free_with_certificate",
        });

        totalOriginalPrice += originalPrice;
        totalCurrentPrice += finalPrice; // ✅ NOW INCLUDES CERTIFICATE FEES
        if (isLinkedCourse) {
          totalLinkedCourseSavings += originalPrice;
        }
      }
    }

    // ✅ FIXED: Process Self-Paced Courses
    const selfPacedCartItems =
      user.mySelfPacedCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(
        item.courseId
      ).lean();
      if (course) {
        // ⭐ FIX: Use stored price instead of recalculating
        const finalPrice = getStoredCoursePrice(item, false);
        const originalPrice = item.enrollmentData.originalPrice || 0;

        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || "Untitled Course",
          courseCode: course.basic?.courseCode || "N/A",
          price: finalPrice, // ✅ NOW USES STORED PRICE
          originalPrice: originalPrice,
          isEarlyBird: false,
          earlyBirdSavings: 0,
          isLinkedCourseFree: false,
          courseType: "SelfPacedOnlineTraining",
          displayType: "Self-Paced",
          startDate: null,
          enrollmentType: item.enrollmentData.enrollmentType || "paid_regular",
          certificateRequested: false,
          certificateFee: 0,
          isFreeWithCertificate: false,
        });

        totalOriginalPrice += originalPrice;
        totalCurrentPrice += finalPrice; // ✅ NOW USES STORED PRICE
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

    // ✅ Prepare Billing Information for the Billing Box
    const billingInfo = {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      country: user.country || "",
      title: user.professionalInfo?.title || "",
      address: user.addressInfo?.address || "",
      city: user.addressInfo?.city || "",
      state: user.addressInfo?.state || "",
      zipCode: user.addressInfo?.zipCode || "",
      addressCountry: user.addressInfo?.country || "",
      alternativePhone: user.addressInfo?.alternativePhone || "",
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

    // ✅ Determine billing box initial state
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

    // ✅ CRITICAL: Debug pricing calculations with certificate support
    console.log("💰 CERTIFICATE FIX - Detailed Pricing Debug:", {
      coursesInCart: coursesInCart.length,
      courseDetails: coursesInCart.map((course) => ({
        title: course.title,
        price: course.price,
        originalPrice: course.originalPrice,
        enrollmentType: course.enrollmentType,
        certificateFee: course.certificateFee,
        certificateRequested: course.certificateRequested,
      })),
      totals: {
        originalPrice: totalOriginalPrice,
        currentPrice: totalCurrentPrice, // ✅ NOW INCLUDES CERTIFICATE FEES
        earlyBirdSavings: totalEarlyBirdSavings,
        linkedCourseSavings: totalLinkedCourseSavings,
        totalSavings: totalSavings,
      },
    });

    console.log("📍 Enhanced Cart Summary with Certificate Support:", {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length,
      totalOriginal: `€${totalOriginalPrice} (AED ${totalOriginalPriceAED})`,
      totalCurrent: `€${totalCurrentPrice} (AED ${totalPriceAED})`, // ✅ NOW INCLUDES CERTIFICATES
      totalSavings: `€${totalSavings} (AED ${totalSavingsAED})`,
      billingComplete: billingBoxStatus.isComplete,
      missingBillingFields: billingBoxStatus.missingFields,
      eurToAedRate: EUR_TO_AED_RATE,
    });

    res.render("checkout", {
      coursesInCart,
      totalPrice: totalCurrentPrice, // ✅ NOW INCLUDES CERTIFICATE FEES
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
      billingInfo: billingInfo,
      billingBoxStatus: billingBoxStatus,
      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page");
  }
};

// ✅ FIXED: Apply Promo Code with Certificate Support
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
    const coursesInCart = []; // NEW: Track courses for validation

    // ✅ ENHANCED: Collect course information for validation
    const inPersonCartItems =
      user.myInPersonCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId);
      if (course) {
        const isLinkedCourse = item.enrollmentData.isLinkedCourseFree || false;
        const coursePrice = getStoredCoursePrice(item, isLinkedCourse);
        totalPrice += coursePrice;

        // NEW: Add course info for promo validation
        coursesInCart.push({
          courseId: item.courseId,
          courseType: "InPerson",
        });
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
        const coursePrice = getStoredCoursePrice(item, isLinkedCourse);
        totalPrice += coursePrice;

        // NEW: Add course info for promo validation
        coursesInCart.push({
          courseId: item.courseId,
          courseType: "OnlineLive",
        });

        console.log(`💰 Promo calculation - FIXED:`, {
          courseTitle: course.basic?.title,
          paidAmount: item.enrollmentData.paidAmount,
          certificateFee: item.enrollmentData.certificateFee,
          coursePrice: coursePrice,
          isLinkedCourse: isLinkedCourse,
        });
      }
    }

    const selfPacedCartItems =
      user.mySelfPacedCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(item.courseId);
      if (course) {
        const coursePrice = getStoredCoursePrice(item, false);
        totalPrice += coursePrice;

        // NEW: Add course info for promo validation
        coursesInCart.push({
          courseId: item.courseId,
          courseType: "SelfPaced",
        });
      }
    }

    totalPrice = roundToTwoDecimals(totalPrice);

    console.log(`💰 CERTIFICATE FIX - Promo Total Price: €${totalPrice}`);

    if (totalPrice === 0) {
      return res.json({ success: false, message: "No courses in cart." });
    }

    // ✅ NEW: Enhanced promo code validation with course restrictions
    let promoValidationPassed = false;
    let validationMessage = "";

    // Basic promo code lookup
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

    // ✅ NEW: Enhanced validation for course and email restrictions
    if (promo.restrictionType === "email" || promo.restrictionType === "both") {
      if (
        promo.allowedEmails.length > 0 &&
        !promo.allowedEmails.includes(user.email)
      ) {
        return res.json({
          success: false,
          message: "This promo code is not valid for your email address.",
        });
      }
    }

    if (
      promo.restrictionType === "course" ||
      promo.restrictionType === "both"
    ) {
      if (promo.allowedCourses.length > 0) {
        // Check if any course in cart is allowed
        const hasValidCourse = coursesInCart.some((cartCourse) =>
          promo.allowedCourses.some(
            (allowedCourseId) =>
              allowedCourseId.toString() === cartCourse.courseId.toString()
          )
        );

        if (!hasValidCourse) {
          return res.json({
            success: false,
            message:
              "This promo code is not valid for the courses in your cart.",
          });
        }
      }
    }

    console.log(
      `✅ Applying Promo Code: ${promo.code} - Discount: ${promo.discountPercentage}%`
    );

    const promoResult = calculateDiscount(totalPrice, promo.discountPercentage);

    // Calculate AED equivalents for response
    const newTotalPriceAED = convertEurToAed(promoResult.finalPrice);
    const discountAmountAED = convertEurToAed(promoResult.discountAmount);

    console.log(
      `💰 Promo Calculation with Certificates: €${promoResult.originalPrice} - €${promoResult.discountAmount} = €${promoResult.finalPrice}`
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

// ✅ FIXED: Process Checkout with Certificate Support
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

    // ✅ FIXED: Calculate total price with certificate support
    for (const enrollment of user.myInPersonCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await InPersonAestheticTraining.findById(
        enrollment.courseId
      );
      if (course) {
        const isLinkedCourse =
          enrollment.enrollmentData.isLinkedCourseFree || false;
        // ⭐ FIX: Use stored price instead of recalculating
        const coursePrice = getStoredCoursePrice(enrollment, isLinkedCourse);
        totalPrice += coursePrice;

        console.log(`💰 Checkout processing - In-Person - FIXED:`, {
          courseTitle: course.basic?.title,
          paidAmount: enrollment.enrollmentData.paidAmount,
          coursePrice: coursePrice,
          isLinkedCourse: isLinkedCourse,
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
        // ⭐ FIX: Use stored price instead of recalculating
        const coursePrice = getStoredCoursePrice(enrollment, isLinkedCourse);
        totalPrice += coursePrice;

        console.log(`💰 Checkout processing - Live Online - FIXED:`, {
          courseTitle: course.basic?.title,
          paidAmount: enrollment.enrollmentData.paidAmount,
          certificateFee: enrollment.enrollmentData.certificateFee,
          coursePrice: coursePrice,
          isLinkedCourse: isLinkedCourse,
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
        // ⭐ FIX: Use stored price instead of recalculating
        const coursePrice = getStoredCoursePrice(enrollment, false);
        totalPrice += coursePrice;

        console.log(`💰 Checkout processing - Self-Paced - FIXED:`, {
          courseTitle: course.basic?.title,
          paidAmount: enrollment.enrollmentData.paidAmount,
          coursePrice: coursePrice,
        });
      }
    }

    totalPrice = roundToTwoDecimals(totalPrice);
    console.log(
      `💰 CERTIFICATE FIX - Calculated total price: €${totalPrice} (AED ${convertEurToAed(
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

        // ✅ If course is FREE, redirect to free registration (no billing needed)
        if (finalPrice <= 0) {
          console.log(
            "🎯 Course is FREE after promo - redirecting to complete registration (no billing required)"
          );
          return res.redirect("/complete-registration");
        }

        console.log(
          `🏷️ Promo applied to certificate-inclusive price: ${appliedPromo}, Final price: €${finalPrice} (AED ${convertEurToAed(
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

// ✅ FIXED: Process Payment with Certificate Support
exports.processPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let totalPrice = 0;
    const cartCourses = [];

    // ✅ FIXED: Process all course types using stored prices
    for (const enrollment of user.myInPersonCourses?.filter(
      (e) => e.enrollmentData.status === "cart"
    ) || []) {
      const course = await InPersonAestheticTraining.findById(
        enrollment.courseId
      );
      if (course) {
        const isLinkedCourse =
          enrollment.enrollmentData.isLinkedCourseFree || false;
        // ⭐ FIX: Use stored price instead of recalculating
        const coursePrice = getStoredCoursePrice(enrollment, isLinkedCourse);
        totalPrice += coursePrice;

        cartCourses.push({
          title: course.basic?.title,
          price: coursePrice, // ✅ NOW INCLUDES CERTIFICATE FEES
          isLinkedCourseFree: isLinkedCourse,
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
        // ⭐ FIX: Use stored price instead of recalculating
        const coursePrice = getStoredCoursePrice(enrollment, isLinkedCourse);
        totalPrice += coursePrice;

        cartCourses.push({
          title: course.basic?.title,
          price: coursePrice, // ✅ NOW INCLUDES CERTIFICATE FEES
          isLinkedCourseFree: isLinkedCourse,
        });

        console.log(`💰 Payment processing - Live Course - FIXED:`, {
          courseTitle: course.basic?.title,
          paidAmount: enrollment.enrollmentData.paidAmount,
          certificateFee: enrollment.enrollmentData.certificateFee,
          coursePrice: coursePrice,
          isLinkedCourse: isLinkedCourse,
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
        // ⭐ FIX: Use stored price instead of recalculating
        const coursePrice = getStoredCoursePrice(enrollment, false);
        totalPrice += coursePrice;

        cartCourses.push({
          title: course.basic?.title,
          price: coursePrice, // ✅ NOW USES STORED PRICE
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

    // ✅ Schedule reminders with proper variable declaration
    let reminderResult = { scheduledCount: 0, failedCount: 0 };

    try {
      console.log(
        `📅 Starting reminder scheduling for ${registeredCourses.length} courses`
      );
      reminderResult = await scheduleCoursesReminders(
        registeredCourses,
        "free registration"
      );
      console.log(
        `📅 Reminders scheduled: ${reminderResult.scheduledCount}, failed: ${reminderResult.failedCount}`
      );
    } catch (reminderError) {
      console.error("❌ Error during reminder scheduling:", reminderError);
      // Don't fail the registration due to reminder issues
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

// ✅ FIXED: Payment Processing with Certificate Price Support
// ✅ FIXED: Payment Processing with Certificate Support
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

    // ENHANCED: More detailed credential debugging
    console.log("🔧 Detailed CCAvenue Credentials:", {
      MERCHANT_ID: {
        exists: !!process.env.CCAVENUE_MERCHANT_ID,
        length: process.env.CCAVENUE_MERCHANT_ID?.length || 0,
        preview: process.env.CCAVENUE_MERCHANT_ID
          ? process.env.CCAVENUE_MERCHANT_ID.substring(0, 4) +
            "..." +
            process.env.CCAVENUE_MERCHANT_ID.slice(-4)
          : "MISSING",
      },
      ACCESS_CODE: {
        exists: !!process.env.CCAVENUE_ACCESS_CODE,
        length: process.env.CCAVENUE_ACCESS_CODE?.length || 0,
        preview: process.env.CCAVENUE_ACCESS_CODE
          ? process.env.CCAVENUE_ACCESS_CODE.substring(0, 6) + "..."
          : "MISSING",
      },
      WORKING_KEY: {
        exists: !!process.env.CCAVENUE_WORKING_KEY,
        length: process.env.CCAVENUE_WORKING_KEY?.length || 0,
        isValidLength: process.env.CCAVENUE_WORKING_KEY?.length === 32,
      },
    });

    // CRITICAL: Validate credential format
    const credentialIssues = [];
    if (
      !process.env.CCAVENUE_MERCHANT_ID ||
      process.env.CCAVENUE_MERCHANT_ID.trim() === ""
    ) {
      credentialIssues.push("MERCHANT_ID is empty");
    }
    if (
      !process.env.CCAVENUE_ACCESS_CODE ||
      process.env.CCAVENUE_ACCESS_CODE.trim() === ""
    ) {
      credentialIssues.push("ACCESS_CODE is empty");
    }
    if (
      !process.env.CCAVENUE_WORKING_KEY ||
      process.env.CCAVENUE_WORKING_KEY.length !== 32
    ) {
      credentialIssues.push("WORKING_KEY invalid (should be 32 characters)");
    }

    if (credentialIssues.length > 0) {
      console.error("❌ CRITICAL CREDENTIAL ISSUES:", credentialIssues);
      return res.status(500).json({
        success: false,
        message:
          "CCAvenue credentials configuration error: " +
          credentialIssues.join(", "),
      });
    }

    console.log(
      "💳 Processing payment with CCAvenue and certificate price support..."
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

    console.log("📋 Raw request body:", req.body);

    const cartItems = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;
    let totalLinkedCourseSavings = 0;

    // ✅ FIXED: Helper function to process cart items with certificate support
    const processCartItems = (enrollments, courseType) => {
      enrollments
        .filter((e) => e.enrollmentData.status === "cart")
        .forEach((enrollment) => {
          const course = enrollment.courseId;
          if (course) {
            const isLinkedCourse =
              enrollment.enrollmentData.isLinkedCourseFree || false;

            // ⭐ FIX: Use stored price instead of recalculating
            const originalPrice = enrollment.enrollmentData.originalPrice || 0;
            const finalPrice = getStoredCoursePrice(enrollment, isLinkedCourse);

            console.log(`💰 Payment initiation - ${courseType} - FIXED:`, {
              courseTitle: course.basic?.title,
              originalPrice: originalPrice,
              paidAmount: enrollment.enrollmentData.paidAmount,
              finalPrice: finalPrice,
              certificateFee: enrollment.enrollmentData.certificateFee,
              enrollmentType: enrollment.enrollmentData.enrollmentType,
              isLinkedCourse: isLinkedCourse,
            });

            cartItems.push({
              courseId: course._id,
              courseType: courseType,
              courseTitle: course.basic?.title || "Untitled Course",
              courseCode: course.basic?.courseCode || "N/A",
              originalPrice: originalPrice,
              finalPrice: finalPrice, // ✅ NOW INCLUDES CERTIFICATE FEES
              isEarlyBird: false, // Set based on enrollment data if needed
              earlyBirdSavings: 0,
              isLinkedCourseFree: isLinkedCourse,
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

            totalOriginalPrice += originalPrice;
            totalCurrentPrice += finalPrice; // ✅ NOW INCLUDES CERTIFICATE FEES
            if (isLinkedCourse) {
              totalLinkedCourseSavings += originalPrice;
            }
          }
        });
    };

    // Process all course types with certificate support
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

        console.log(
          `💰 Promo discount applied to certificate-inclusive total: €${promoCodeDiscount}`
        );
      }
    }

    // ⭐ CRITICAL: Calculate finalAmountEUR with certificate fees included
    const finalAmountEUR = roundToTwoDecimals(
      Math.max(0, totalCurrentPrice - promoCodeDiscount)
    );
    const finalAmount = convertEurToAed(finalAmountEUR);

    console.log(
      `💰 CERTIFICATE FIX - Final amount calculated: EUR ${finalAmountEUR} -> AED ${finalAmount}`
    );

    // Check if free first
    if (finalAmountEUR <= 0) {
      console.log("🎯 Final amount is €0, redirecting to free registration");
      return res.redirect("/complete-registration");
    }

    // ✅ Extract and validate billing information from the billing box
    let billingInfo = {};

    if (req.body.billingInfo) {
      if (typeof req.body.billingInfo === "string") {
        try {
          billingInfo = JSON.parse(req.body.billingInfo);
        } catch (e) {
          billingInfo = req.body.billingInfo;
        }
      } else {
        billingInfo = req.body.billingInfo;
      }
    } else {
      // Fallback to user profile data
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
    }

    // ✅ Only validate billing for paid courses (finalAmountEUR > 0)
    if (finalAmountEUR > 0) {
      // Only validate billing for paid courses
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
    } else {
      console.log("🎁 Free course - skipping billing validation");
    }

    // ✅ Prepare CCAvenue-compatible billing data with proper field lengths
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

    // Create transaction IDs
    const transactionId = `TXN_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const orderNumber = `ORD_${Date.now()}_${userId.toString().slice(-6)}`;

    console.log("🔧 Creating transaction with billing information...");
    console.log("🆔 Transaction identifiers:", {
      transactionId: transactionId,
      orderNumber: orderNumber,
      userId: userId.toString(),
    });

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
        finalAmount: finalAmountEUR, // ✅ NOW INCLUDES CERTIFICATE FEES
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
        finalPrice: item.finalPrice, // ✅ NOW INCLUDES CERTIFICATE FEES
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
      amount: finalAmount.toFixed(2), // AED AMOUNT TO BANK (includes certificates)
      currency: "AED", // CURRENCY TO BANK

      // REDIRECT URLs
      redirect_url: "https://iaa-i.com/payment/response",
      cancel_url: "https://iaa-i.com/payment/cancel",

      // REQUIRED: Language parameter
      language: "EN",

      // ✅ BILLING INFORMATION FROM BILLING BOX - ALL VALIDATED
      ...ccavenueBillingData,

      // MERCHANT PARAMETERS (for tracking) - ENHANCED
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

    // ENHANCED: Debug merchant parameters being sent
    console.log("🔗 Merchant params being sent to CCAvenue:", {
      merchant_param1: ccavenuePaymentData.merchant_param1,
      merchant_param2: ccavenuePaymentData.merchant_param2,
      merchant_param3: ccavenuePaymentData.merchant_param3,
      merchant_param4: ccavenuePaymentData.merchant_param4,
      merchant_param5: ccavenuePaymentData.merchant_param5,
      orderNumber: orderNumber,
      transactionId: transactionId,
      userId: userId.toString(),
    });

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
    console.log("💳 CCAvenue Parameters (Certificate Price Fixed):", {
      merchant_id: ccavenuePaymentData.merchant_id,
      order_id: ccavenuePaymentData.order_id,
      amount: ccavenuePaymentData.amount, // ✅ NOW INCLUDES CERTIFICATE FEES
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
      certificateFeesIncluded: "✅ YES",
    });

    // ✅ CRITICAL DEBUG: Log certificate pricing breakdown
    console.log("💰 CERTIFICATE FIX - Final Payment Debug:", {
      totalOriginalPrice: totalOriginalPrice,
      totalCurrentPrice: totalCurrentPrice, // ✅ Includes certificate fees
      finalAmountEUR: finalAmountEUR, // ✅ Amount being charged in EUR
      finalAmountAED: finalAmount, // ✅ Amount being charged to bank in AED
      certificateCoursesInCart: cartItems
        .filter(
          (item) =>
            item.courseTitle.includes("certificate") ||
            item.finalPrice > item.originalPrice
        )
        .map((item) => ({
          title: item.courseTitle,
          originalPrice: item.originalPrice,
          finalPrice: item.finalPrice,
          certificateAdded: item.finalPrice > item.originalPrice,
        })),
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
      console.log("🔐 Pre-encryption data validation:", {
        dataStringLength: dataString.length,
        workingKeyLength: process.env.CCAVENUE_WORKING_KEY?.length,
        sampleData: dataString.substring(0, 200) + "...",
      });

      console.log(
        "🔐 Starting encryption with certificate-inclusive billing data..."
      );
      encRequest = ccavUtil.encrypt(dataString);

      // Verify encrypted string is not empty
      if (!encRequest || encRequest.trim() === "") {
        throw new Error("Encryption resulted in empty string");
      }

      console.log("✅ Encryption successful with certificate pricing included");
      console.log("📏 Encrypted string length:", encRequest.length);
      console.log(
        "📏 Encrypted string preview:",
        encRequest.substring(0, 50) + "..."
      );
    } catch (encryptionError) {
      console.error("❌ Encryption failed:", encryptionError);
      console.error("❌ Working key status:", {
        exists: !!process.env.CCAVENUE_WORKING_KEY,
        length: process.env.CCAVENUE_WORKING_KEY?.length,
      });
      return res.status(500).json({
        success: false,
        message: "Payment encryption failed: " + encryptionError.message,
      });
    }

    const paymentUrl =
      "https://secure.ccavenue.ae/transaction/transaction.do?command=initiateTransaction";

    // Final Payment Data Verification
    console.log("💳 Final Payment Data Verification:", {
      merchant_id: ccavenuePaymentData.merchant_id,
      access_code: process.env.CCAVENUE_ACCESS_CODE?.substring(0, 6) + "...",
      order_id: ccavenuePaymentData.order_id,
      amount: ccavenuePaymentData.amount,
      currency: ccavenuePaymentData.currency,
      dataStringLength: dataString.length,
      encryptedLength: encRequest?.length || 0,
      hasAllRequiredParams: !!(
        ccavenuePaymentData.merchant_id &&
        ccavenuePaymentData.order_id &&
        ccavenuePaymentData.amount &&
        ccavenuePaymentData.currency
      ),
    });

    // ✅ ENHANCED payment form with certificate pricing confirmation
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
            .certificate-info {
              background: #fff3e0;
              border: 1px solid #ffcc02;
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

            <!-- ✅ NEW: Certificate Pricing Confirmation -->
            <div class="certificate-info">
              <strong>📜 Certificate Pricing Included:</strong><br>
              Original Course Total: €${totalOriginalPrice.toFixed(2)}<br>
              Final Total (with certificates): €${finalAmountEUR.toFixed(2)}<br>
              Payment Amount: AED ${finalAmount.toFixed(2)}<br>
              <small style="color: #666;">✅ Certificate fees are included in the final amount</small>
            </div>
            
            <!-- Debug Information -->
            <div class="debug">
              <strong>🔍 Payment Debug Info (Certificate Fix Applied):</strong><br>
              Order ID: ${orderNumber}<br>
              Transaction ID: ${transactionId}<br>
              Amount: AED ${finalAmount.toFixed(
                2
              )} (EUR ${finalAmountEUR.toFixed(2)})<br>
              Original Total: €${totalOriginalPrice.toFixed(2)}<br>
              Certificate Fees Included: ✅ YES<br>
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
              Initializing secure connection with certificate pricing...
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
                updateStatus('Submitting to CCAvenue with certificate pricing...');
                console.log('🚀 Form submission attempt with certificate fees:', {
                  action: '${paymentUrl}',
                  encRequestLength: '${encRequest ? encRequest.length : 0}',
                  accessCode: '${process.env.CCAVENUE_ACCESS_CODE}',
                  billingName: '${ccavenuePaymentData.billing_name}',
                  billingEmail: '${ccavenuePaymentData.billing_email}',
                  billingCountry: '${ccavenuePaymentData.billing_country}',
                  finalAmountEUR: '${finalAmountEUR.toFixed(2)}',
                  finalAmountAED: '${finalAmount.toFixed(2)}',
                  certificateFeesIncluded: true,
                  billingValidated: true,
                  transactionId: '${transactionId}',
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
              updateStatus('Form submitted manually with certificate pricing');
              console.log('📤 Manual form submission to CCAvenue with certificate fees included');
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
      )} (EUR ${finalAmountEUR.toFixed(2)}) - Certificate Fees Included`
    );
    console.log(`👤 Billing Name: ${ccavenuePaymentData.billing_name}`);
    console.log(`📧 Billing Email: ${ccavenuePaymentData.billing_email}`);
    console.log(
      `🏠 Billing Address: ${ccavenuePaymentData.billing_city}, ${ccavenuePaymentData.billing_country}`
    );
    console.log(`✅ Certificate Fix Integration: Complete`);

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
// ✅ ENHANCED: Handle Payment Response
exports.handlePaymentResponse = async (req, res) => {
  try {
    console.log("📥 Received payment response from CCAvenue");
    console.log("📋 Raw CCAvenue response body:", req.body);

    const { encResp } = req.body;

    if (!encResp) {
      console.error("❌ No encResp in response body");
      return res.status(400).send("Invalid payment response");
    }

    // Decrypt the response
    console.log("🔓 Decrypting CCAvenue response...");
    const decryptedResponse = ccavUtil.decrypt(encResp);
    console.log("🔓 Decrypted response:", decryptedResponse);

    // Parse response data
    const responseData = {};
    decryptedResponse.split("&").forEach((pair) => {
      const [key, value] = pair.split("=");
      responseData[decodeURIComponent(key)] = decodeURIComponent(value || "");
    });

    console.log("💳 Complete Payment Response Data:", responseData);

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

    console.log("🔍 Extracted payment details:", {
      order_status,
      order_id,
      tracking_id,
      amount,
      transactionId,
      userId,
      payment_mode,
      bank_ref_no,
    });

    // Enhanced user lookup with debugging
    console.log("👤 Looking up user with ID:", userId);
    const user = await User.findById(userId);

    if (!user) {
      console.error("❌ User not found in database:", userId);
      console.error("❌ This could indicate session issues or user deletion");
      return res.redirect("/payment/error?message=User not found");
    }

    console.log("✅ User found:", user.email);
    console.log(
      "📊 User has",
      user.paymentTransactions.length,
      "payment transactions"
    );

    // Debug: List all user's transactions for reference
    if (user.paymentTransactions.length > 0) {
      console.log("🔍 User's existing transactions:");
      user.paymentTransactions.forEach((tx, index) => {
        console.log(
          `  ${index + 1}. TransactionID: ${tx.transactionId}, OrderID: ${
            tx.orderNumber
          }, Status: ${tx.paymentStatus}`
        );
      });
    }

    // Enhanced transaction lookup with multiple fallback methods
    console.log("🔍 Searching for transaction with ID:", transactionId);
    let transaction = user.paymentTransactions.find(
      (t) => t.transactionId === transactionId
    );

    if (!transaction && order_id) {
      console.log("🔍 TransactionId not found, trying by order_id:", order_id);
      transaction = user.paymentTransactions.find(
        (t) => t.orderNumber === order_id
      );
    }

    // Additional fallback: find by pending status and recent creation
    if (!transaction) {
      console.log("🔍 Trying to find by pending status and recent creation...");
      const recentTransactions = user.paymentTransactions
        .filter((t) => t.paymentStatus === "pending")
        .filter((t) => {
          const timeDiff = Date.now() - t.createdAt.getTime();
          return timeDiff < 30 * 60 * 1000; // Within last 30 minutes
        })
        .sort((a, b) => b.createdAt - a.createdAt); // Most recent first

      if (recentTransactions.length > 0) {
        transaction = recentTransactions[0];
        console.log(
          "🔍 Found recent pending transaction:",
          transaction.transactionId
        );
      }
    }

    if (!transaction) {
      console.error("❌ Transaction not found in user's payment history");
      console.error("❌ Search criteria:", {
        transactionId: transactionId,
        order_id: order_id,
        userId: userId,
      });
      console.error(
        "❌ Available transaction IDs:",
        user.paymentTransactions.map((t) => t.transactionId)
      );
      console.error(
        "❌ Available order numbers:",
        user.paymentTransactions.map((t) => t.orderNumber)
      );

      // Create a more detailed error message
      const errorMessage = `Transaction lookup failed. TransactionID: ${transactionId}, OrderID: ${order_id}`;
      return res.redirect(
        `/payment/error?message=${encodeURIComponent(errorMessage)}`
      );
    }

    console.log("✅ Transaction found:", {
      transactionId: transaction.transactionId,
      orderNumber: transaction.orderNumber,
      currentStatus: transaction.paymentStatus,
      amount: transaction.financial.finalAmount,
    });

    // Update payment transaction with CCAvenue response
    console.log("💾 Updating transaction with CCAvenue response...");

    // Update CCAvenue specific fields
    transaction.ccavenue = {
      orderId: order_id,
      trackingId: tracking_id,
      bankRefNo: bank_ref_no,
      paymentMode: payment_mode,
      cardName: card_name,
      statusCode: responseData.status_code || "",
      statusMessage: responseData.status_message || "",
      failureMessage: failure_message || "",
      rawResponse: responseData, // Store complete response for debugging
    };

    // Update transaction status and completion
    transaction.paymentStatus =
      order_status === "Success" ? "completed" : "failed";
    transaction.completedAt = new Date();

    // Add detailed logging for payment status
    console.log("📊 Payment status update:", {
      order_status: order_status,
      new_paymentStatus: transaction.paymentStatus,
      tracking_id: tracking_id,
      amount_processed: amount,
    });

    if (order_status === "Success") {
      console.log("✅ Payment successful - processing course enrollment...");

      // Update course enrollment status after successful payment
      let enrollmentsUpdated = 0;

      transaction.items.forEach((item) => {
        console.log(`🔄 Processing course enrollment for: ${item.courseTitle}`);

        // Update enrollment status based on course type
        if (item.courseType === "InPersonAestheticTraining") {
          const enrollment = user.myInPersonCourses.find(
            (e) =>
              e.courseId.toString() === item.courseId.toString() &&
              e.enrollmentData.status === "cart"
          );
          if (enrollment) {
            enrollment.enrollmentData.status = "paid";
            enrollment.enrollmentData.paidAmount = item.finalPrice;
            enrollment.enrollmentData.paymentTransactionId =
              transaction.transactionId;
            enrollmentsUpdated++;
            console.log(
              `✅ Updated In-Person course enrollment: ${item.courseTitle}`
            );
          }
        } else if (item.courseType === "OnlineLiveTraining") {
          const enrollment = user.myLiveCourses.find(
            (e) =>
              e.courseId.toString() === item.courseId.toString() &&
              e.enrollmentData.status === "cart"
          );
          if (enrollment) {
            enrollment.enrollmentData.status = "paid";
            enrollment.enrollmentData.paidAmount = item.finalPrice;
            enrollment.enrollmentData.paymentTransactionId =
              transaction.transactionId;
            enrollmentsUpdated++;
            console.log(
              `✅ Updated Online Live course enrollment: ${item.courseTitle}`
            );
          }
        } else if (item.courseType === "SelfPacedOnlineTraining") {
          const enrollment = user.mySelfPacedCourses.find(
            (e) =>
              e.courseId.toString() === item.courseId.toString() &&
              e.enrollmentData.status === "cart"
          );
          if (enrollment) {
            enrollment.enrollmentData.status = "paid";
            enrollment.enrollmentData.paidAmount = item.finalPrice;
            enrollment.enrollmentData.paymentTransactionId =
              transaction.transactionId;

            // Set expiry date for self-paced courses
            if (item.courseSchedule.accessDays) {
              const expiryDate = new Date();
              expiryDate.setDate(
                expiryDate.getDate() + item.courseSchedule.accessDays
              );
              enrollment.enrollmentData.expiryDate = expiryDate;
              console.log(
                `📅 Set expiry date for self-paced course: ${expiryDate}`
              );
            }

            enrollmentsUpdated++;
            console.log(
              `✅ Updated Self-Paced course enrollment: ${item.courseTitle}`
            );
          }
        }
      });

      console.log(
        `📊 Total enrollments updated: ${enrollmentsUpdated}/${transaction.items.length}`
      );

      // ✅ ENHANCED: Send confirmation email with retry logic
      try {
        console.log("📧 Preparing to send payment confirmation email...");

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
          finalPrice: item.finalPrice, // ✅ Includes certificate fees
          price: item.originalPrice,
          startDate: item.courseSchedule?.startDate,
          isLinkedCourseFree: false, // Payment means it's not a linked free course
        }));

        const transactionInfo = {
          referenceNumber: transaction.receiptNumber,
          receiptNumber: transaction.receiptNumber,
          orderNumber: transaction.orderNumber,
          finalAmount: transaction.financial.finalAmount, // ✅ Includes certificate fees
          paymentMethod: "CCAvenue Payment Gateway",
          trackingId: tracking_id,
          bankRefNo: bank_ref_no,
        };

        const emailResult = await sendEnhancedRegistrationEmail(
          user,
          registeredCourses,
          transactionInfo,
          false
        );

        if (emailResult.success) {
          console.log("✅ Payment confirmation email sent successfully");
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
      console.log("📅 Scheduling course reminders...");
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

      // Save all changes
      await user.save({ validateBeforeSave: false });

      // Clear applied promo code from session
      delete req.session.appliedPromoCode;

      console.log(`✅ PAID registration completed successfully`);
      console.log(
        `📧 Email status: ${emailResult?.success ? "sent" : "failed"}`
      );
      console.log(`📅 Reminders scheduled: ${reminderResult.scheduledCount}`);
      console.log(`🎯 Redirecting to success page`);

      res.redirect(
        `/payment/success?order_id=${order_id}&amount=${amount}&ref=${transaction.receiptNumber}&userId=${userId}`
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
        failureReason: failure_message,
      });

      await user.save({ validateBeforeSave: false });

      console.log(`❌ Payment failed, redirecting to failure page`);
      res.redirect(
        `/payment/failure?order_id=${order_id}&reason=${encodeURIComponent(
          failure_message || "Payment failed"
        )}&userId=${userId}`
      );
    }
  } catch (error) {
    console.error("❌ Payment response handling error:", error);
    console.error("❌ Error stack:", error.stack);

    // Log additional context for debugging
    console.error("❌ Request details:", {
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url,
    });

    res.redirect(
      "/payment/error?message=Payment processing error - please contact support"
    );
  }
};

// ✅ Handle Payment Cancellation
exports.handlePaymentCancel = (req, res) => {
  console.log("❌ Payment cancelled by user");
  res.redirect("/payment/cancelled");
};

// ✅ NEW: API route for getting user billing info
exports.getUserBillingInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "firstName lastName email phoneNumber country addressInfo professionalInfo"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      country: user.country || "",
      addressInfo: user.addressInfo || {},
      professionalInfo: user.professionalInfo || {},
    });
  } catch (error) {
    console.error("❌ Error fetching user billing info:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ NEW: API route for updating user billing info
exports.updateUserBillingInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      city,
      state,
      zipCode,
      country,
      alternativePhone,
      title,
    } = req.body;

    // Update basic info
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (country) user.country = country;

    // Update professional info
    if (!user.professionalInfo) user.professionalInfo = {};
    if (title) user.professionalInfo.title = title;

    // Update address info
    if (!user.addressInfo) user.addressInfo = {};
    if (address) user.addressInfo.address = address;
    if (city) user.addressInfo.city = city;
    if (state) user.addressInfo.state = state;
    if (zipCode) user.addressInfo.zipCode = zipCode;
    if (country) user.addressInfo.country = country;
    if (alternativePhone) user.addressInfo.alternativePhone = alternativePhone;

    // Check completion status
    const requiredFields = [
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      city,
      country,
    ];
    const isComplete = requiredFields.every(
      (field) => field && field.trim() !== ""
    );
    user.addressInfo.isComplete = isComplete;
    user.addressInfo.lastUpdated = new Date();

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: "Billing information updated successfully",
      isComplete: isComplete,
    });
  } catch (error) {
    console.error("❌ Error updating user billing info:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Export utility functions
exports.convertEurToAed = convertEurToAed;
exports.EUR_TO_AED_RATE = EUR_TO_AED_RATE;
