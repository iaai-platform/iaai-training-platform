// myCoursesController.js - SIMPLE FIX
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

exports.getMyCourses = async (req, res) => {
  try {
    console.log("📚 Fetching user courses...");

    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error("❌ User not found");
      return res.status(404).send("User not found");
    }

    console.log("👤 User found:", user.email);

    const registeredCourses = [];
    const upcomingCourses = [];
    const completedCourses = [];
    const inProgressCourses = [];

    // ✅ SIMPLE: Get image URL or null
    const getImageUrl = (imageData) => {
      if (!imageData) return null;

      // If it's already a full URL (Cloudinary), return as-is
      if (typeof imageData === "string" && imageData.startsWith("http")) {
        return imageData;
      }

      // If it's an object with url property (Cloudinary format)
      if (imageData.url && imageData.url.startsWith("http")) {
        return imageData.url;
      }

      return null; // No valid image, show icon instead
    };

    // ✅ Process In-Person Courses
    // ✅ Process In-Person Courses - SIMPLE FIX
    // myCoursesController.js - DEBUG VERSION for In-Person courses

    // Replace ONLY the In-Person courses section with this debug version:

    // ✅ Process In-Person Courses - DEBUG VERSION
    const registeredInPersonCourses =
      user.myInPersonCourses?.filter((enrollment) =>
        ["paid", "registered", "completed"].includes(
          enrollment.enrollmentData.status
        )
      ) || [];

    console.log(
      `🔍 DEBUG: Found ${registeredInPersonCourses.length} registered in-person courses`
    );

    for (const enrollment of registeredInPersonCourses) {
      try {
        const courseDetails = await InPersonAestheticTraining.findById(
          enrollment.courseId
        ).lean();

        if (courseDetails) {
          console.log(`\n=== DEBUG IN-PERSON COURSE ===`);
          console.log(`Course ID: ${courseDetails._id}`);
          console.log(`Course Title: ${courseDetails.basic?.title}`);

          // Debug the full media object
          console.log(
            `Full media object:`,
            JSON.stringify(courseDetails.media, null, 2)
          );

          // Debug specific image paths
          console.log(`media exists: ${!!courseDetails.media}`);
          console.log(
            `media.mainImage exists: ${!!courseDetails.media?.mainImage}`
          );
          console.log(
            `media.mainImage.url exists: ${!!courseDetails.media?.mainImage
              ?.url}`
          );
          console.log(
            `media.mainImage.url value: "${courseDetails.media?.mainImage?.url}"`
          );
          console.log(
            `media.mainImage.url type: ${typeof courseDetails.media?.mainImage
              ?.url}`
          );

          // Check if it's a valid URL
          if (courseDetails.media?.mainImage?.url) {
            const url = courseDetails.media.mainImage.url;
            console.log(`URL starts with http: ${url.startsWith("http")}`);
            console.log(
              `URL includes cloudinary: ${url.includes("cloudinary.com")}`
            );
            console.log(`URL length: ${url.length}`);
            console.log(`URL trimmed: "${url.trim()}"`);
          }

          // 🔥 SIMPLE: Get the image URL
          let mainImageUrl = null;

          if (
            courseDetails.media?.mainImage?.url &&
            courseDetails.media.mainImage.url.startsWith("http")
          ) {
            mainImageUrl = courseDetails.media.mainImage.url;
            console.log(`✅ FINAL mainImageUrl SET: "${mainImageUrl}"`);
          } else {
            console.log(`❌ FINAL mainImageUrl is NULL - no valid image found`);
          }

          console.log(`===============================\n`);

          const courseData = {
            enrollmentId: enrollment._id,
            courseId: courseDetails._id,
            courseCode: courseDetails.basic?.courseCode,
            title: courseDetails.basic?.title,
            description: courseDetails.basic?.description,
            courseType: "In-Person",
            typeLabel: "In-Person Training",
            startDate: courseDetails.schedule?.startDate,
            endDate: courseDetails.schedule?.endDate,
            duration: courseDetails.schedule?.duration,
            location: `${courseDetails.venue?.city}, ${courseDetails.venue?.country}`,
            venue: courseDetails.venue?.name,
            price: courseDetails.enrollment?.price || 0,
            paidAmount: enrollment.enrollmentData.paidAmount || 0,
            status: enrollment.enrollmentData.status,
            registrationDate: enrollment.enrollmentData.registrationDate,
            promoCodeUsed: enrollment.enrollmentData.promoCodeUsed,
            progress: enrollment.userProgress?.overallAttendancePercentage || 0,
            courseStatus:
              enrollment.userProgress?.courseStatus || "not-started",
            certificateId: enrollment.certificateId,
            instructors:
              courseDetails.instructorNames ||
              courseDetails.instructors?.primary?.name,
            // 🔥 DEBUG: Use the extracted image URL or null
            mainImage: mainImageUrl,
            enrollmentData: enrollment.enrollmentData,
            userProgress: enrollment.userProgress,
            galleryImages: courseDetails.media?.gallery?.images || [],
            documents: courseDetails.media?.documents || [],
          };

          // Also debug what we're sending to the view
          console.log(
            `📤 SENDING TO VIEW - Course: ${courseData.title}, mainImage: "${courseData.mainImage}"`
          );

          // Rest of your categorization logic stays the same...
          const now = new Date();
          const startDate = new Date(courseDetails.schedule?.startDate);

          if (
            enrollment.userProgress?.courseStatus === "completed" ||
            enrollment.enrollmentData.status === "completed"
          ) {
            completedCourses.push(courseData);
          } else if (startDate > now) {
            upcomingCourses.push(courseData);
          } else {
            inProgressCourses.push(courseData);
          }

          registeredCourses.push(courseData);
        } else {
          console.log(
            `❌ No course details found for ID: ${enrollment.courseId}`
          );
        }
      } catch (err) {
        console.warn(
          `⚠️ Could not fetch in-person course ${enrollment.courseId}:`,
          err.message
        );
      }
    }

    // Add this debug log before rendering
    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`Total courses to render: ${registeredCourses.length}`);
    registeredCourses.forEach((course, index) => {
      console.log(
        `  ${index + 1}. ${course.title} - Image: ${
          course.mainImage ? "HAS IMAGE" : "NO IMAGE"
        }`
      );
      if (course.mainImage) {
        console.log(`     URL: ${course.mainImage.substring(0, 50)}...`);
      }
    });
    console.log(`\n`);

    // ✅ Process Online Live Courses
    const registeredLiveCourses =
      user.myLiveCourses?.filter((enrollment) =>
        ["paid", "registered", "completed"].includes(
          enrollment.enrollmentData.status
        )
      ) || [];

    for (const enrollment of registeredLiveCourses) {
      try {
        const courseDetails = await OnlineLiveTraining.findById(
          enrollment.courseId
        ).lean();
        if (courseDetails) {
          const courseData = {
            enrollmentId: enrollment._id,
            courseId: courseDetails._id,
            courseCode: courseDetails.basic?.courseCode,
            title: courseDetails.basic?.title,
            description: courseDetails.basic?.description,
            courseType: "Online-Live",
            typeLabel: "Live Online Training",
            startDate: courseDetails.schedule?.startDate,
            endDate: courseDetails.schedule?.endDate,
            duration: courseDetails.schedule?.duration,
            location: "Online",
            platform: courseDetails.platform?.name,
            price: courseDetails.enrollment?.price || 0,
            paidAmount: enrollment.enrollmentData.paidAmount || 0,
            status: enrollment.enrollmentData.status,
            registrationDate: enrollment.enrollmentData.registrationDate,
            promoCodeUsed: enrollment.enrollmentData.promoCodeUsed,
            progress: enrollment.userProgress?.overallAttendancePercentage || 0,
            courseStatus:
              enrollment.userProgress?.courseStatus || "not-started",
            certificateId: enrollment.certificateId,
            instructors:
              courseDetails.instructorNames ||
              courseDetails.instructors?.primary?.name,
            // 🔥 SIMPLE: Just get the image URL or null
            mainImage: getImageUrl(courseDetails.media?.mainImage),
            enrollmentData: enrollment.enrollmentData,
            userProgress: enrollment.userProgress,
            recordingsAvailable:
              courseDetails.recording?.availability?.forStudents,
            galleryImages: courseDetails.media?.gallery?.images || [],
            documents: courseDetails.media?.documents || [],
          };

          // Categorize
          const now = new Date();
          const startDate = new Date(courseDetails.schedule?.startDate);

          if (
            enrollment.userProgress?.courseStatus === "completed" ||
            enrollment.enrollmentData.status === "completed"
          ) {
            completedCourses.push(courseData);
          } else if (startDate > now) {
            upcomingCourses.push(courseData);
          } else {
            inProgressCourses.push(courseData);
          }

          registeredCourses.push(courseData);
        }
      } catch (err) {
        console.warn(
          `⚠️ Could not fetch live course ${enrollment.courseId}:`,
          err.message
        );
      }
    }

    // ✅ Process Self-Paced Courses
    const registeredSelfPacedCourses =
      user.mySelfPacedCourses?.filter(
        (enrollment) =>
          ["paid", "registered"].includes(enrollment.enrollmentData.status) &&
          (!enrollment.enrollmentData.expiryDate ||
            new Date(enrollment.enrollmentData.expiryDate) > new Date())
      ) || [];

    for (const enrollment of registeredSelfPacedCourses) {
      try {
        const courseDetails = await SelfPacedOnlineTraining.findById(
          enrollment.courseId
        ).lean();
        if (courseDetails) {
          const courseData = {
            enrollmentId: enrollment._id,
            courseId: courseDetails._id,
            courseCode: courseDetails.basic?.courseCode,
            title: courseDetails.basic?.title,
            description: courseDetails.basic?.description,
            courseType: "Self-Paced",
            typeLabel: "Self-Paced Training",
            startDate: null,
            duration: `${courseDetails.content?.estimatedMinutes || 0} minutes`,
            location: "Online",
            price: courseDetails.access?.price || 0,
            paidAmount: enrollment.enrollmentData.paidAmount || 0,
            status: enrollment.enrollmentData.status,
            registrationDate: enrollment.enrollmentData.registrationDate,
            expiryDate: enrollment.enrollmentData.expiryDate,
            promoCodeUsed: enrollment.enrollmentData.promoCodeUsed,
            progress: enrollment.courseProgress?.overallPercentage || 0,
            courseStatus: enrollment.courseProgress?.status || "not-started",
            certificateId: enrollment.certificateId,
            instructor: courseDetails.instructor?.name,
            // 🔥 SIMPLE: Check for thumbnail in different locations
            mainImage: getImageUrl(
              courseDetails.media?.thumbnailUrl || courseDetails.thumbnailUrl
            ),
            enrollmentData: enrollment.enrollmentData,
            courseProgress: enrollment.courseProgress,
            totalVideos: courseDetails.videos?.length || 0,
            completedVideos:
              enrollment.courseProgress?.completedVideos?.length || 0,
            lastAccessedAt: enrollment.courseProgress?.lastAccessedAt,
            videos: courseDetails.videos || [],
          };

          // Categorize
          if (enrollment.courseProgress?.status === "completed") {
            completedCourses.push(courseData);
          } else if (enrollment.courseProgress?.status === "in-progress") {
            inProgressCourses.push(courseData);
          } else {
            upcomingCourses.push(courseData);
          }

          registeredCourses.push(courseData);
        }
      } catch (err) {
        console.warn(
          `⚠️ Could not fetch self-paced course ${enrollment.courseId}:`,
          err.message
        );
      }
    }

    // Sort courses
    upcomingCourses.sort(
      (a, b) =>
        new Date(a.startDate || a.registrationDate) -
        new Date(b.startDate || b.registrationDate)
    );
    inProgressCourses.sort(
      (a, b) => new Date(b.registrationDate) - new Date(a.registrationDate)
    );
    completedCourses.sort(
      (a, b) => new Date(b.registrationDate) - new Date(a.registrationDate)
    );

    console.log(`🎯 Courses categorized:`, {
      total: registeredCourses.length,
      upcoming: upcomingCourses.length,
      inProgress: inProgressCourses.length,
      completed: completedCourses.length,
    });

    // Calculate statistics
    const stats = {
      totalCourses: registeredCourses.length,
      completedCourses: completedCourses.length,
      inProgressCourses: inProgressCourses.length,
      upcomingCourses: upcomingCourses.length,
      totalInPerson: registeredCourses.filter(
        (c) => c.courseType === "In-Person"
      ).length,
      totalOnlineLive: registeredCourses.filter(
        (c) => c.courseType === "Online-Live"
      ).length,
      totalSelfPaced: registeredCourses.filter(
        (c) => c.courseType === "Self-Paced"
      ).length,
      certificatesEarned: registeredCourses.filter((c) => c.certificateId)
        .length,
    };

    res.render("my-courses", {
      registeredCourses,
      upcomingCourses,
      inProgressCourses,
      completedCourses,
      stats,
      user,
      title: "My Learning Dashboard",
    });
  } catch (err) {
    console.error("❌ Error fetching My Courses:", err);
    res.status(500).send("Server error");
  }
};
