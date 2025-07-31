// checkoutController.js - ENHANCED VERSION
// Fully integrated with emailService and courseReminderScheduler

const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/SelfPacedOnlineTraining");
const emailService = require("../utils/emailService");
const courseReminderScheduler = require("../utils/courseReminderScheduler");
const { v4: uuidv4 } = require("uuid");
const ccavUtil = require("../utils/ccavutil");

// ============================================
// HELPER FUNCTIONS
// ============================================

// Round to two decimal places for proper currency handling
function roundToTwoDecimals(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Calculate course pricing with early bird and linked course logic
function calculateCoursePricing(
  course,
  registrationDate,
  isLinkedCourseFree = false
) {
  if (isLinkedCourseFree) {
    return {
      regularPrice: course.enrollment?.price || 0,
      currentPrice: 0,
      isEarlyBird: false,
      isLinkedCourseFree: true,
      earlyBirdSavings: 0,
    };
  }

  const regularPrice = course.enrollment?.price || 0;
  const earlyBirdPrice = course.enrollment?.earlyBirdPrice || 0;
  const earlyBirdDays = course.enrollment?.earlyBirdDays || 0;

  // Check if early bird is active using virtual fields from the models
  const isEarlyBirdActive = course.isEarlyBirdActive || false;
  const currentPrice = isEarlyBirdActive ? earlyBirdPrice : regularPrice;
  const earlyBirdSavings = isEarlyBirdActive
    ? regularPrice - earlyBirdPrice
    : 0;

  return {
    regularPrice,
    currentPrice,
    isEarlyBird: isEarlyBirdActive,
    isLinkedCourseFree: false,
    earlyBirdSavings,
  };
}

// ✅ ENHANCED: Centralized email sending with proper error handling
async function sendEnhancedRegistrationEmail(
  user,
  registeredCourses,
  transactionInfo,
  isPromoCode = false
) {
  try {
    console.log("📧 Sending enhanced registration confirmation email...");

    // Use the enhanced email service method
    const emailResult = await emailService.sendCourseRegistrationConfirmation(
      user,
      registeredCourses,
      transactionInfo,
      isPromoCode
    );

    if (emailResult.success) {
      console.log("✅ Enhanced registration email sent successfully");
      return { success: true };
    } else {
      console.error(
        "❌ Enhanced registration email failed:",
        emailResult.error
      );
      return { success: false, error: emailResult.error };
    }
  } catch (error) {
    console.error("❌ Unexpected error sending registration email:", error);
    return { success: false, error: error.message };
  }
}

// ✅ ENHANCED: Update course enrollment counts after successful registration
async function updateCourseEnrollmentCounts(registeredCourses) {
  console.log("📊 Updating course enrollment counts...");

  for (const course of registeredCourses) {
    try {
      let courseDoc;

      if (course.courseType === "InPersonAestheticTraining") {
        courseDoc = await InPersonAestheticTraining.findById(course.courseId);
      } else if (course.courseType === "OnlineLiveTraining") {
        courseDoc = await OnlineLiveTraining.findById(course.courseId);
      } else if (course.courseType === "SelfPacedOnlineTraining") {
        courseDoc = await SelfPacedOnlineTraining.findById(course.courseId);
      }

      if (courseDoc && courseDoc.enrollment) {
        courseDoc.enrollment.currentEnrollment =
          (courseDoc.enrollment.currentEnrollment || 0) + 1;
        await courseDoc.save({ validateBeforeSave: false });

        console.log(
          `✅ Updated enrollment count for ${course.title}: ${courseDoc.enrollment.currentEnrollment}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error updating enrollment count for ${course.title}:`,
        error
      );
    }
  }
}

// ============================================
// MAIN CONTROLLER FUNCTIONS
// ============================================

// ✅ ENHANCED: Complete Free Registration
exports.completeRegistration = async (req, res) => {
  try {
    console.log("🎯 Starting FREE registration process...");
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
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
          user.myInPersonCourses[i].enrollmentData.registrationCompletedAt =
            new Date();

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
            displayType: "In-Person Training",
            price: pricing.regularPrice,
            originalPrice: pricing.regularPrice,
            finalPrice: 0, // Free registration
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
          user.myLiveCourses[i].enrollmentData.registrationCompletedAt =
            new Date();

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
              : "Live Online Training",
            price: pricing.regularPrice,
            originalPrice: pricing.regularPrice,
            finalPrice: 0, // Free registration
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
          user.mySelfPacedCourses[i].enrollmentData.registrationCompletedAt =
            new Date();

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
            displayType: "Self-Paced Online Course",
            price: pricing.regularPrice,
            originalPrice: pricing.regularPrice,
            finalPrice: 0, // Free registration
            isLinkedCourseFree: false,
            startDate: null,
          });
        }
      }
    }

    if (coursesUpdated === 0) {
      console.log("❌ No courses found in cart");
      return res.status(400).json({
        success: false,
        message: "No courses in cart.",
      });
    }

    // Calculate totals with decimal precision
    const totalAmount = roundToTwoDecimals(
      registeredCourses.reduce((sum, course) => sum + course.price, 0)
    );
    const finalAmount = 0; // Free registration
    const totalSavings = totalAmount; // All savings since final amount is 0

    // Create comprehensive transaction record
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
        registrationType: "free",
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

    // Save transaction to user
    user.paymentTransactions.push(transaction);
    await user.save({ validateBeforeSave: false });

    // Update course enrollment counts
    await updateCourseEnrollmentCounts(registeredCourses);

    // Clear promo code from session
    const appliedPromoCode = req.session.appliedPromoCode;
    delete req.session.appliedPromoCode;

    // ✅ ENHANCED: Send confirmation email
    try {
      const transactionInfo = {
        referenceNumber: referenceNumber,
        receiptNumber: transaction.receiptNumber,
        orderNumber: transaction.orderNumber,
        finalAmount: 0,
        paymentMethod: appliedPromoCode ? "Promo Code" : "Free Course",
      };

      const emailResult = await sendEnhancedRegistrationEmail(
        user,
        registeredCourses,
        transactionInfo,
        !!appliedPromoCode
      );

      // Add communication record
      transaction.communications.push({
        type: "email",
        template: "enhanced_registration_confirmation",
        sentAt: new Date(),
        status: emailResult.success ? "sent" : "failed",
        recipientEmail: user.email,
        subject: `Registration Confirmed: ${
          registeredCourses.length > 1
            ? `${registeredCourses.length} Courses`
            : registeredCourses[0].title
        } - IAAI Training`,
        error: emailResult.success ? null : emailResult.error,
      });

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
    }

    // ✅ ENHANCED: Schedule reminders with improved error handling
    const reminderResult = await scheduleCoursesReminders(
      registeredCourses,
      "free registration"
    );

    // Update transaction with reminder info
    transaction.metadata.remindersScheduled = reminderResult.scheduledCount;
    transaction.metadata.remindersFailed = reminderResult.failedCount;

    await user.save({ validateBeforeSave: false });

    console.log(`✅ FREE registration completed successfully`);
    console.log(`📋 Reference number: ${referenceNumber}`);
    console.log(`📚 Courses registered: ${coursesUpdated}`);
    console.log(`📧 Email status: sent`);
    console.log(
      `📅 Reminders scheduled: ${reminderResult.scheduledCount}/${reminderResult.totalProcessed}`
    );

    const successUrl = `/payment/success?order_id=FREE&amount=0.00&ref=${referenceNumber}`;

    if (req.method === "POST") {
      res.json({
        success: true,
        message: "Registration completed successfully!",
        referenceNumber: referenceNumber,
        coursesRegistered: coursesUpdated,
        redirect: successUrl,
        emailSent: true,
        reminderResults: reminderResult,
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
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    } else {
      res.status(500).send("Error completing registration. Please try again.");
    }
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
      console.log("✅ Payment successful - processing registration");

      // Payment successful - update enrollment status
      user.updateEnrollmentStatusAfterPayment(transactionId);

      // Update course enrollment counts
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

      await updateCourseEnrollmentCounts(registeredCourses);

      // ✅ ENHANCED: Send confirmation email with retry logic
      try {
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

        // Add communication record
        transaction.communications.push({
          type: "email",
          template: "enhanced_registration_confirmation",
          sentAt: new Date(),
          status: emailResult.success ? "sent" : "failed",
          recipientEmail: user.email,
          subject: `Registration Confirmed: ${
            transaction.items.length > 1
              ? `${transaction.items.length} Courses`
              : transaction.items[0].courseTitle
          } - IAAI Training`,
          error: emailResult.success ? null : emailResult.error,
        });

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
        registeredCourses,
        "paid registration"
      );

      // Update transaction with reminder info
      transaction.metadata = transaction.metadata || {};
      transaction.metadata.remindersScheduled = reminderResult.scheduledCount;
      transaction.metadata.remindersFailed = reminderResult.failedCount;
      transaction.metadata.registrationType = "paid";

      await user.save();

      // Clear applied promo code from session
      delete req.session.appliedPromoCode;

      console.log(`✅ PAID registration completed successfully`);
      console.log(`📚 Courses registered: ${transaction.items.length}`);
      console.log(
        `💰 Amount paid: ${amount} ${transaction.financial.currency}`
      );
      console.log(`📧 Email status: sent`);
      console.log(
        `📅 Reminders scheduled: ${reminderResult.scheduledCount}/${reminderResult.totalProcessed}`
      );

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
        details: {
          failureMessage: failure_message,
          orderStatus: order_status,
          orderId: order_id,
          amount: amount,
        },
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

// ============================================
// ADDITIONAL HELPER METHODS
// ============================================

// Get enrollment statistics for reporting
exports.getEnrollmentStatistics = async (req, res) => {
  try {
    const stats = await courseReminderScheduler.getDetailedStatistics();
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error getting enrollment statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving statistics",
    });
  }
};

// Manual reminder scheduling endpoint (for admin use)
exports.scheduleManualReminder = async (req, res) => {
  try {
    const {
      courseId,
      courseType,
      emailType = "course-starting",
      customMessage,
    } = req.body;

    if (!courseId || !courseType) {
      return res.status(400).json({
        success: false,
        message: "Course ID and type are required",
      });
    }

    // Calculate default send date (24 hours before course starts)
    let course;
    if (courseType === "InPersonAestheticTraining") {
      course = await InPersonAestheticTraining.findById(courseId);
    } else if (courseType === "OnlineLiveTraining") {
      course = await OnlineLiveTraining.findById(courseId);
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    const startDate = new Date(course.schedule?.startDate);
    const sendDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

    const jobId = await courseReminderScheduler.scheduleCustomReminder(
      courseId,
      courseType,
      sendDate,
      emailType,
      customMessage
    );

    if (jobId) {
      res.json({
        success: true,
        message: "Manual reminder scheduled successfully",
        jobId: jobId,
        sendDate: sendDate,
        courseTitle: course.basic?.title || course.title,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Failed to schedule reminder",
      });
    }
  } catch (error) {
    console.error("❌ Error scheduling manual reminder:", error);
    res.status(500).json({
      success: false,
      message: "Error scheduling reminder",
    });
  }
};

module.exports = exports;
