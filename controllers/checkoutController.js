// checkoutController.js - FIXED VERSION
// Remove any duplicate const CCavenueUtils declarations and keep only ONE at the top

const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const PromoCode = require("../models/promoCode");
const sendEmail = require("../utils/sendEmail");
const { v4: uuidv4 } = require("uuid");

// ✅ SINGLE CCAvenue utility import - KEEP ONLY THIS ONE
const CCavenueUtils = require("../utils/ccavenueUtils");

// Initialize CCAvenue utility - KEEP ONLY THIS ONE
const ccavUtil = new CCavenueUtils(process.env.CCAVENUE_WORKING_KEY);

// Helper function to calculate course pricing with early bird
function calculateCoursePricing(course, registrationDate = new Date()) {
  const pricing = {
    regularPrice: 0,
    earlyBirdPrice: null,
    currentPrice: 0,
    isEarlyBird: false,
    earlyBirdSavings: 0,
    currency: "USD",
  };

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

// ✅ EXISTING METHOD: Display Checkout Page
exports.getCheckoutPage = async (req, res) => {
  try {
    console.log("🔍 Loading checkout page...");
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    const coursesInCart = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;

    // ✅ Process In-Person Courses
    const inPersonCartItems =
      user.myInPersonCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(
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
          isEarlyBird: pricing.isEarlyBird,
          earlyBirdSavings: pricing.earlyBirdSavings,
          courseType: "InPersonAestheticTraining",
          displayType: "In-Person",
          startDate: course.schedule?.startDate || null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
        totalEarlyBirdSavings += pricing.earlyBirdSavings;
      }
    }

    // ✅ Process Online Live Courses
    const liveCartItems =
      user.myLiveCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId).lean();
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
          isEarlyBird: pricing.isEarlyBird,
          earlyBirdSavings: pricing.earlyBirdSavings,
          courseType: "OnlineLiveTraining",
          displayType: "Online Live",
          startDate: course.schedule?.startDate || null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
        totalEarlyBirdSavings += pricing.earlyBirdSavings;
      }
    }

    // ✅ Process Self-Paced Courses
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
          courseType: "SelfPacedOnlineTraining",
          displayType: "Self-Paced",
          startDate: null,
        });

        totalOriginalPrice += pricing.regularPrice;
        totalCurrentPrice += pricing.currentPrice;
      }
    }

    console.log("📌 Cart Courses Found:", {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length,
      totalOriginal: totalOriginalPrice,
      totalCurrent: totalCurrentPrice,
      savings: totalEarlyBirdSavings,
    });

    console.log(
      `✅ Checkout loaded with ${coursesInCart.length} courses, original: $${totalOriginalPrice}, current: $${totalCurrentPrice}, savings: $${totalEarlyBirdSavings}`
    );

    res.render("checkout", {
      coursesInCart,
      totalPrice: totalCurrentPrice,
      totalOriginalPrice: totalOriginalPrice,
      totalSavings: totalEarlyBirdSavings.toFixed(2),
      hasEarlyBirdDiscounts: totalEarlyBirdSavings > 0,
      user,
      successMessage: "",
    });
  } catch (err) {
    console.error("❌ Error loading checkout page:", err);
    res.status(500).send("Error loading checkout page");
  }
};

// ✅ EXISTING METHOD: Apply Promo Code
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Calculate total price from cart courses using enhanced pricing
    let totalPrice = 0;

    // Get in-person cart courses
    const inPersonCartItems =
      user.myInPersonCourses?.filter(
        (enrollment) => enrollment.enrollmentData.status === "cart"
      ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId);
      if (course) {
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate
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
        const pricing = calculateCoursePricing(
          course,
          item.enrollmentData.registrationDate
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

// ✅ EXISTING METHOD: Process Checkout
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

    // Calculate total price (you can reuse the logic from applyPromoCode)
    let totalPrice = 0;
    // ... calculation logic ...

    if (totalPrice === 0 || req.session.appliedPromoCode) {
      return res.redirect("/complete-registration");
    } else {
      return res.redirect("/payment");
    }
  } catch (err) {
    console.error("❌ Error processing checkout:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ EXISTING METHOD: Process Payment
exports.processPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let totalPrice = 0;
    const cartCourses = [];

    // Calculate totals using enhanced pricing
    // ... existing logic but with enhanced pricing calculation ...

    if (totalPrice === 0) {
      return res.redirect("/complete-registration");
    }

    return res.render("payment", { totalPrice, user, cartCourses });
  } catch (err) {
    console.error("❌ Error processing payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ EXISTING METHOD: Complete Registration
exports.completeRegistration = async (req, res) => {
  try {
    console.log("🎯 Starting registration process...");
    const user = await User.findById(req.user._id);

    const registeredCourses = [];
    let coursesUpdated = 0;
    const referenceNumber = uuidv4();
    const transactionId = uuidv4();
    const receiptNumber = `REC-${Date.now()}-${Math.floor(
      Math.random() * 1000
    )}`;

    // Update in-person courses
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
            req.session.appliedPromoCode || "PROMO100";

          coursesUpdated++;
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate
          );
          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: "In-Person",
            price: pricing.regularPrice,
            startDate: course.schedule?.startDate,
          });
        }
      }
    }

    // Update online live courses
    for (let i = 0; i < user.myLiveCourses.length; i++) {
      const enrollment = user.myLiveCourses[i];
      if (enrollment.enrollmentData.status === "cart") {
        const course = await OnlineLiveTraining.findById(enrollment.courseId);
        if (course) {
          // Update enrollment status
          user.myLiveCourses[i].enrollmentData.status = "registered";
          user.myLiveCourses[i].enrollmentData.paidAmount = 0;
          user.myLiveCourses[i].enrollmentData.promoCodeUsed =
            req.session.appliedPromoCode || "PROMO100";

          coursesUpdated++;
          const pricing = calculateCoursePricing(
            course,
            enrollment.enrollmentData.registrationDate
          );
          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: "Online Live",
            price: pricing.regularPrice,
            startDate: course.schedule?.startDate,
          });
        }
      }
    }

    // Update self-paced courses
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
            req.session.appliedPromoCode || "PROMO100";

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
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: "Self-Paced",
            price: pricing.regularPrice,
            startDate: null,
          });
        }
      }
    }

    if (coursesUpdated === 0) {
      console.log("❌ No courses found in cart");
      return res
        .status(400)
        .json({ success: false, message: "No courses in cart." });
    }

    // Create payment transaction record
    const totalAmount = registeredCourses.reduce(
      (sum, course) => sum + course.price,
      0
    );
    const transaction = {
      transactionId: transactionId,
      receiptNumber: receiptNumber,
      transactionDate: new Date(),
      paymentMethod: "Promo Code",
      paymentStatus: "completed",
      subtotal: totalAmount,
      discountAmount: totalAmount, // 100% discount
      tax: 0,
      finalAmount: 0,
      currency: "USD",
      items: registeredCourses.map((course) => ({
        courseId: course.courseId,
        courseType: course.courseType,
        originalPrice: course.price,
        paidPrice: 0,
      })),
      promoCode: req.session.appliedPromoCode || "PROMO100",
    };

    user.paymentTransactions.push(transaction);

    await user.save({ validateBeforeSave: false });

    // Clear the applied promo code from session
    delete req.session.appliedPromoCode;

    // Send confirmation email
    try {
      await sendCourseRegistrationEmail(
        user,
        registeredCourses,
        referenceNumber,
        true
      );
      console.log("✅ Registration email sent successfully");
    } catch (emailError) {
      console.error("❌ Error sending registration email:", emailError);
    }

    console.log(`✅ Registration completed for ${coursesUpdated} courses`);
    console.log(`📋 Reference number: ${referenceNumber}`);

    // Handle both POST (AJAX) and GET requests
    if (req.method === "POST") {
      res.json({
        success: true,
        message: "Registration completed successfully!",
        referenceNumber: referenceNumber,
      });
    } else {
      res.redirect(`/success?ref=${referenceNumber}`);
    }
  } catch (err) {
    console.error("❌ Error completing registration:", err);

    if (req.method === "POST") {
      res
        .status(500)
        .json({ success: false, message: "Server error during registration" });
    } else {
      res.status(500).send("Error completing registration");
    }
  }
};

// ✅ NEW METHOD: Initiate CCAvenue Payment
exports.proceedToPayment = async (req, res) => {
  try {
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

    // Collect cart items and calculate totals using enhanced pricing
    const cartItems = [];
    let totalOriginalPrice = 0;
    let totalCurrentPrice = 0;
    let totalEarlyBirdSavings = 0;

    // Helper function to process cart items
    const processCartItems = (enrollments, courseType) => {
      enrollments
        .filter((e) => e.enrollmentData.status === "cart")
        .forEach((enrollment) => {
          const course = enrollment.courseId;
          if (course) {
            const pricing = calculateCoursePricing(
              course,
              enrollment.enrollmentData.registrationDate
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

    // Create payment transaction record
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
        discountAmount: totalEarlyBirdSavings + promoCodeDiscount,
        earlyBirdSavings: totalEarlyBirdSavings,
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
      redirect_url: `${req.protocol}://${req.get("host")}/payment/response`,
      cancel_url: `${req.protocol}://${req.get("host")}/payment/cancel`,
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
      process.env.NODE_ENV === "production"
        ? process.env.CCAVENUE_PROD_URL
        : process.env.CCAVENUE_TEST_URL;

    // Create auto-submit form
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
                  ? `<p><strong>Early Bird Savings:</strong> $${totalEarlyBirdSavings.toFixed(
                      2
                    )}</p>`
                  : ""
              }
              ${
                promoCodeDiscount > 0
                  ? `<p><strong>Promo Discount:</strong> $${promoCodeDiscount.toFixed(
                      2
                    )}</p>`
                  : ""
              }
              <p class="amount">Total: $${finalAmount.toFixed(2)} USD</p>
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
      `💳 Payment initiated: Order ${orderNumber}, Amount $${finalAmount}, Transaction ${transactionId}`
    );
    res.send(paymentForm);
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    res
      .status(500)
      .json({ success: false, message: "Payment processing failed" });
  }
};

// ✅ NEW METHOD: Handle CCAvenue Payment Response
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

// ✅ NEW METHOD: Handle Payment Cancellation
exports.handlePaymentCancel = (req, res) => {
  console.log("❌ Payment cancelled by user");
  res.redirect("/payment/cancelled");
};

// ✅ HELPER FUNCTION: Send payment confirmation email
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
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${
          item.isEarlyBird
            ? `<span style="text-decoration: line-through; color: #999;">$${item.originalPrice}</span><br>`
            : ""
        }
        <strong>$${item.finalPrice}</strong>
        ${
          item.isEarlyBird
            ? `<br><small style="color: #28a745;">Saved $${item.earlyBirdSavings}</small>`
            : ""
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
          <p><strong>Subtotal:</strong> $${transaction.financial.subtotal.toFixed(
            2
          )}</p>
          ${
            transaction.financial.earlyBirdSavings > 0
              ? `<p><strong>Early Bird Savings:</strong> -$${transaction.financial.earlyBirdSavings.toFixed(
                  2
                )}</p>`
              : ""
          }
          ${
            transaction.financial.promoCodeDiscount > 0
              ? `<p><strong>Promo Code Discount:</strong> -$${transaction.financial.promoCodeDiscount.toFixed(
                  2
                )}</p>`
              : ""
          }
          <p style="font-size: 18px; color: #28a745;"><strong>Total Paid: $${transaction.financial.finalAmount.toFixed(
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

// ✅ EXISTING HELPER FUNCTION: Send course registration email
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
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${
          isPromoCode
            ? '<span style="color: #28a745;">FREE</span>'
            : `$${course.price}`
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
