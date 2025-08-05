// controllers/wishlistController.js
const User = require("../models/user");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");

// ✅ 1️⃣ Fetch and Display Wishlist Page
exports.getWishlistPage = async (req, res) => {
  try {
    console.log("📄 Rendering wishlist page for user:", req.user._id);

    // Populate course details for wishlist items
    const user = await User.findById(req.user._id)
      .populate({
        path: "myInPersonCourses.courseId",
        select: "basic enrollment schedule venue instructorNames",
      })
      .populate({
        path: "myLiveCourses.courseId",
        select: "basic enrollment schedule platform instructorNames",
      })
      .populate({
        path: "mySelfPacedCourses.courseId",
        select: "basic access content instructorNames",
      });

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).render("error", {
        message: "User not found",
        title: "Error - IAAI",
      });
    }

    // ✅ Collect wishlist items from all course types
    const wishlist = [];

    // Get In-Person courses with status = 'wishlist'
    if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
      user.myInPersonCourses.forEach((enrollment) => {
        // ✅ Check if courseId exists and is not null
        if (!enrollment || !enrollment.courseId) {
          console.warn("⚠️ Found enrollment with null courseId, skipping...");
          return;
        }

        if (
          enrollment.enrollmentData &&
          enrollment.enrollmentData.status === "wishlist"
        ) {
          wishlist.push({
            courseId: enrollment.courseId._id,
            courseCode: enrollment.courseId.basic?.courseCode || "N/A",
            title: enrollment.courseId.basic?.title || "Course Title",
            price:
              enrollment.enrollmentData.paidAmount ||
              enrollment.courseId.enrollment?.price ||
              0,
            currency:
              enrollment.enrollmentData.currency ||
              enrollment.courseId.enrollment?.currency ||
              "USD",
            courseType: "InPersonAestheticTraining",
            courseTypeDisplay: "In-Person Training",
            addedAt: enrollment.enrollmentData.registrationDate,
            status: enrollment.enrollmentData.status,
            enrollmentId: enrollment._id,
            location: `${enrollment.courseId.venue?.city || "TBD"}, ${
              enrollment.courseId.venue?.country || "TBD"
            }`,
            startDate: enrollment.courseId.schedule?.startDate,
            duration: enrollment.courseId.schedule?.duration,
            instructor:
              enrollment.courseId.instructorNames || "Expert Instructors",
          });
        }
      });
    }

    // Get Live courses with status = 'wishlist'
    if (user.myLiveCourses && user.myLiveCourses.length > 0) {
      user.myLiveCourses.forEach((enrollment) => {
        // ✅ Check if courseId exists and is not null
        if (!enrollment || !enrollment.courseId) {
          console.warn("⚠️ Found enrollment with null courseId, skipping...");
          return;
        }

        if (
          enrollment.enrollmentData &&
          enrollment.enrollmentData.status === "wishlist"
        ) {
          wishlist.push({
            courseId: enrollment.courseId._id,
            courseCode: enrollment.courseId.basic?.courseCode || "N/A",
            title: enrollment.courseId.basic?.title || "Course Title",
            price:
              enrollment.enrollmentData.paidAmount ||
              enrollment.courseId.enrollment?.price ||
              0,
            currency:
              enrollment.enrollmentData.currency ||
              enrollment.courseId.enrollment?.currency ||
              "USD",
            courseType: "OnlineLiveTraining",
            courseTypeDisplay: "Online Live Training",
            addedAt: enrollment.enrollmentData.registrationDate,
            status: enrollment.enrollmentData.status,
            enrollmentId: enrollment._id,
            location: "Online",
            startDate: enrollment.courseId.schedule?.startDate,
            duration: enrollment.courseId.schedule?.duration,
            instructor:
              enrollment.courseId.instructorNames || "Expert Instructors",
          });
        }
      });
    }

    // Get Self-Paced courses with status = 'wishlist'
    if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
      user.mySelfPacedCourses.forEach((enrollment) => {
        // ✅ Check if courseId exists and is not null
        if (!enrollment || !enrollment.courseId) {
          console.warn("⚠️ Found enrollment with null courseId, skipping...");
          return;
        }

        if (
          enrollment.enrollmentData &&
          enrollment.enrollmentData.status === "wishlist"
        ) {
          wishlist.push({
            courseId: enrollment.courseId._id,
            courseCode: enrollment.courseId.basic?.courseCode || "N/A",
            title: enrollment.courseId.basic?.title || "Course Title",
            price:
              enrollment.enrollmentData.paidAmount ||
              enrollment.courseId.access?.price ||
              0,
            currency:
              enrollment.enrollmentData.currency ||
              enrollment.courseId.access?.currency ||
              "USD",
            courseType: "SelfPacedOnlineTraining",
            courseTypeDisplay: "Self-Paced Training",
            addedAt: enrollment.enrollmentData.registrationDate,
            status: enrollment.enrollmentData.status,
            enrollmentId: enrollment._id,
            location: "Online - Self-Paced",
            duration:
              enrollment.courseId.content?.totalDuration || "Self-paced",
            instructor:
              enrollment.courseId.instructorNames || "Expert Instructors",
          });
        }
      });
    }

    // Sort by most recently added
    wishlist.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

    console.log(`📌 Wishlist Found: ${wishlist.length} items`);
    if (wishlist.length > 0) {
      console.log(
        "📋 Wishlist items:",
        wishlist.map((item) => `${item.courseCode} - ${item.title}`)
      );
    }

    // ✅ Render the wishlist page with proper data structure
    res.render("wishlist", {
      wishlist: wishlist,
      user: user,
      title: "My Wishlist - IAAI",
      totalItems: wishlist.length,
    });
  } catch (err) {
    console.error("❌ Error fetching wishlist:", err);
    res.status(500).render("error", {
      message: "Error loading wishlist page",
      title: "Error - IAAI",
    });
  }
};

// ✅ 2️⃣ Remove Course from Wishlist
exports.removeFromWishlist = async (req, res) => {
  console.log("🗑️ removeFromWishlist route triggered");

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "⚠️ You must be logged in",
    });
  }

  const { courseId, courseType } = req.body;
  console.log("📌 Removing from wishlist:", { courseId, courseType });

  if (!courseId || !courseType) {
    return res.status(400).json({
      success: false,
      message: "Course ID and course type are required",
    });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let courseArrayField;

    // ✅ Determine which array to use based on courseType
    switch (courseType) {
      case "InPersonAestheticTraining":
        courseArrayField = "myInPersonCourses";
        break;
      case "OnlineLiveTraining":
        courseArrayField = "myLiveCourses";
        break;
      case "SelfPacedOnlineTraining":
        courseArrayField = "mySelfPacedCourses";
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "❌ Invalid course type" });
    }

    // ✅ Find the course enrollment
    const enrollmentIndex = user[courseArrayField].findIndex(
      (enrollment) =>
        enrollment.courseId.toString() === courseId &&
        enrollment.enrollmentData.status === "wishlist"
    );

    if (enrollmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Course not found in your wishlist",
      });
    }

    // ✅ Remove the enrollment completely
    user[courseArrayField].splice(enrollmentIndex, 1);
    console.log("✅ Course removed from wishlist");

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: "✅ Course removed from wishlist successfully",
    });
  } catch (err) {
    console.error("❌ Error removing course from wishlist:", err);
    res.status(500).json({
      success: false,
      message: "❌ Error removing course from wishlist",
    });
  }
};

// ✅ 3️⃣ Move Course from Wishlist to Cart
exports.moveToCart = async (req, res) => {
  console.log("🛒 moveToCart route triggered");

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "⚠️ You must be logged in",
    });
  }

  const { courseId, courseType } = req.body;
  console.log("📌 Moving to cart:", { courseId, courseType });

  if (!courseId || !courseType) {
    return res.status(400).json({
      success: false,
      message: "Course ID and course type are required",
    });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let courseArrayField;

    // ✅ Determine which array to use based on courseType
    switch (courseType) {
      case "InPersonAestheticTraining":
        courseArrayField = "myInPersonCourses";
        break;
      case "OnlineLiveTraining":
        courseArrayField = "myLiveCourses";
        break;
      case "SelfPacedOnlineTraining":
        courseArrayField = "mySelfPacedCourses";
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "❌ Invalid course type" });
    }

    // ✅ Find the course enrollment
    const enrollment = user[courseArrayField].find(
      (enrollment) =>
        enrollment.courseId.toString() === courseId &&
        enrollment.enrollmentData.status === "wishlist"
    );

    if (!enrollment) {
      // Check if it's already in cart
      const cartEnrollment = user[courseArrayField].find(
        (enrollment) =>
          enrollment.courseId.toString() === courseId &&
          enrollment.enrollmentData.status === "cart"
      );

      if (cartEnrollment) {
        return res.json({
          success: false,
          message: "This course is already in your cart",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Course not found in your wishlist",
      });
    }

    // ✅ Update status from wishlist to cart
    enrollment.enrollmentData.status = "cart";
    enrollment.enrollmentData.registrationDate = new Date(); // Update timestamp

    console.log("✅ Course moved from wishlist to cart");

    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: "✅ Course moved to cart successfully",
    });
  } catch (err) {
    console.error("❌ Error moving course to cart:", err);
    res.status(500).json({
      success: false,
      message: "❌ Error moving course to cart",
    });
  }
};
