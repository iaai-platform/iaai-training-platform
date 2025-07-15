//myCoursesController.js
const User = require("../models/user");
const SelfPacedOnlineTraining = require("../models/selfPacedOnlineTrainingModel");
const InPersonAestheticTraining = require("../models/InPersonAestheticTraining");
const OnlineLiveTraining = require("../models/onlineLiveTrainingModel");

// ✅ Controller to display My Courses page - Updated for new user model
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

    // ✅ Process In-Person Courses
    const registeredInPersonCourses =
      user.myInPersonCourses?.filter((enrollment) =>
        ["paid", "registered", "completed"].includes(
          enrollment.enrollmentData.status
        )
      ) || [];

    for (const enrollment of registeredInPersonCourses) {
      try {
        const courseDetails = await InPersonAestheticTraining.findById(
          enrollment.courseId
        ).lean();
        if (courseDetails) {
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
            mainImage: courseDetails.media?.mainImage?.url,
            enrollmentData: enrollment.enrollmentData,
            userProgress: enrollment.userProgress,
          };

          // Categorize based on dates and status
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
          `⚠️ Could not fetch in-person course ${enrollment.courseId}:`,
          err.message
        );
      }
    }

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
            mainImage: courseDetails.media?.mainImage?.url,
            enrollmentData: enrollment.enrollmentData,
            userProgress: enrollment.userProgress,
            recordingsAvailable:
              courseDetails.recording?.availability?.forStudents,
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
          // In the self-paced courses section, add this before the courseData object:
          console.log("=== DEBUGGING SELF-PACED COURSE ===");
          console.log("Course ID:", courseDetails._id);
          console.log("Course title:", courseDetails.basic?.title);
          console.log(
            "Full media object:",
            JSON.stringify(courseDetails.media, null, 2)
          );
          console.log(
            "thumbnailUrl specifically:",
            courseDetails.media?.thumbnailUrl
          );
          console.log("===============================");
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
            mainImage:
              courseDetails.media?.thumbnailUrl?.trim() ||
              "/images/default-course-thumbnail.jpg",
            enrollmentData: enrollment.enrollmentData,
            courseProgress: enrollment.courseProgress,
            totalVideos: courseDetails.videos?.length || 0,
            completedVideos:
              enrollment.courseProgress?.completedVideos?.length || 0,
            lastAccessedAt: enrollment.courseProgress?.lastAccessedAt,
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
