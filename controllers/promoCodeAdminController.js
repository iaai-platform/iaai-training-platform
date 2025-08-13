const PromoCode = require("../models/promoCode");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");

// ✅ Fetch and Display All Promo Codes with All Course Types
exports.getPromoCodes = async (req, res) => {
  try {
    // Get promo codes without populate since we don't have a single Course model
    const promoCodes = await PromoCode.find();

    // Fetch all course types with proper status filtering
    const [onlineLive, selfPaced, inPerson] = await Promise.all([
      OnlineLiveTraining.find({
        "basic.status": { $in: ["open", "full", "draft"] },
      }).select("basic.title _id"),
      SelfPacedOnlineTraining.find({
        "basic.status": { $in: ["draft", "published"] },
      }).select("basic.title _id"),
      InPersonAestheticTraining.find({
        "basic.status": { $in: ["open", "full", "draft"] },
      }).select("basic.title _id"),
    ]);

    // Combine all courses with type information
    const courses = [
      ...onlineLive.map((course) => ({
        _id: course._id,
        title: course.basic.title,
        courseType: "OnlineLive",
      })),
      ...selfPaced.map((course) => ({
        _id: course._id,
        title: course.basic.title,
        courseType: "SelfPaced",
      })),
      ...inPerson.map((course) => ({
        _id: course._id,
        title: course.basic.title,
        courseType: "InPerson",
      })),
    ];

    // Create a course lookup map for displaying promo code restrictions
    const courseMap = {};
    courses.forEach((course) => {
      courseMap[course._id.toString()] = course;
    });

    // Enhance promo codes with course information
    const enhancedPromoCodes = await Promise.all(
      promoCodes.map(async (promo) => {
        const promoObj = promo.toObject();

        // Add course information for display
        if (promoObj.allowedCourses && promoObj.allowedCourses.length > 0) {
          promoObj.allowedCoursesInfo = promoObj.allowedCourses.map(
            (courseId) => {
              const courseInfo = courseMap[courseId.toString()];
              return courseInfo
                ? {
                    id: courseInfo._id,
                    title: courseInfo.title,
                    type: courseInfo.courseType,
                  }
                : {
                    id: courseId,
                    title: "Unknown Course",
                    type: "Unknown",
                  };
            }
          );
        } else {
          promoObj.allowedCoursesInfo = [];
        }

        return promoObj;
      })
    );

    res.render("admin-promo-codes", {
      promoCodes: enhancedPromoCodes,
      courses,
    });
  } catch (err) {
    console.error("❌ Error fetching promo codes:", err);
    res.status(500).send("Server error");
  }
};

// ✅ Add a New Promo Code with Enhanced Restrictions
exports.addPromoCode = async (req, res) => {
  try {
    const {
      code,
      discountPercentage,
      expiryDate,
      restrictionType,
      allowedEmails,
      allowedCourses,
    } = req.body;

    const newPromo = {
      code,
      discountPercentage,
      expiryDate: expiryDate || null,
      restrictionType,
    };

    // Handle email restrictions
    if (restrictionType === "email" || restrictionType === "both") {
      if (allowedEmails) {
        newPromo.allowedEmails = allowedEmails
          .split("\n")
          .map((email) => email.trim())
          .filter((email) => email.length > 0);
      }
    }

    // Handle course restrictions
    if (restrictionType === "course" || restrictionType === "both") {
      if (allowedCourses) {
        newPromo.allowedCourses = Array.isArray(allowedCourses)
          ? allowedCourses
          : [allowedCourses];
      }
    }

    const promoCode = new PromoCode(newPromo);
    await promoCode.save();
    res.redirect("/admin-promo-codes");
  } catch (err) {
    console.error("❌ Error adding promo code:", err);
    res.status(500).send("Server error");
  }
};

// ✅ Delete a Promo Code (unchanged)
exports.deletePromoCode = async (req, res) => {
  try {
    await PromoCode.findByIdAndDelete(req.params.id);
    res.redirect("/admin-promo-codes");
  } catch (err) {
    console.error("❌ Error deleting promo code:", err);
    res.status(500).send("Server error");
  }
};

// ✅ New function to validate promo code usage with multiple course types
exports.validatePromoCode = async (
  promoCode,
  userEmail,
  courseId,
  courseType
) => {
  try {
    const promo = await PromoCode.findOne({
      code: promoCode,
      isActive: true,
    });

    if (!promo) {
      return { valid: false, message: "Invalid promo code" };
    }

    // Check expiry
    if (promo.expiryDate && new Date() > promo.expiryDate) {
      return { valid: false, message: "Promo code has expired" };
    }

    // Check email restrictions
    if (
      (promo.restrictionType === "email" || promo.restrictionType === "both") &&
      promo.allowedEmails.length > 0
    ) {
      if (!promo.allowedEmails.includes(userEmail)) {
        return {
          valid: false,
          message: "This promo code is not valid for your email address",
        };
      }
    }

    // Check course restrictions
    if (
      (promo.restrictionType === "course" ||
        promo.restrictionType === "both") &&
      promo.allowedCourses.length > 0
    ) {
      // Verify the course exists and is in the allowed list
      let courseExists = false;
      let courseDetails = null;
      let coursePrice = 0;

      // Check in the appropriate model based on courseType
      try {
        switch (courseType) {
          case "OnlineLive":
            courseDetails = await OnlineLiveTraining.findById(courseId);
            if (courseDetails) {
              coursePrice = courseDetails.enrollment?.price || 0;
            }
            break;
          case "SelfPaced":
            courseDetails = await SelfPacedOnlineTraining.findById(courseId);
            if (courseDetails) {
              coursePrice = courseDetails.access?.price || 0;
            }
            break;
          case "InPerson":
            courseDetails = await InPersonAestheticTraining.findById(courseId);
            if (courseDetails) {
              coursePrice = courseDetails.enrollment?.price || 0;
            }
            break;
          default:
            // Try to find in all course types if courseType not specified
            courseDetails = await OnlineLiveTraining.findById(courseId);
            if (courseDetails) {
              coursePrice = courseDetails.enrollment?.price || 0;
            } else {
              courseDetails = await SelfPacedOnlineTraining.findById(courseId);
              if (courseDetails) {
                coursePrice = courseDetails.access?.price || 0;
              } else {
                courseDetails = await InPersonAestheticTraining.findById(
                  courseId
                );
                if (courseDetails) {
                  coursePrice = courseDetails.enrollment?.price || 0;
                }
              }
            }
        }

        courseExists = !!courseDetails;
      } catch (err) {
        console.error("Error checking course existence:", err);
      }

      if (!courseExists) {
        return { valid: false, message: "Course not found" };
      }

      // Check if course is in allowed list
      const allowedCourseIds = promo.allowedCourses.map((course) =>
        course.toString()
      );
      if (!allowedCourseIds.includes(courseId.toString())) {
        return {
          valid: false,
          message: "This promo code is not valid for this course",
        };
      }
    }

    return {
      valid: true,
      discount: promo.discountPercentage,
      message: "Promo code applied successfully",
    };
  } catch (err) {
    console.error("❌ Error validating promo code:", err);
    return { valid: false, message: "Error validating promo code" };
  }
};
