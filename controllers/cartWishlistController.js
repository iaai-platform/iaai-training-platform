// controllers/cartWishlistController.js
const User = require('../models/user');
const InPersonAestheticTraining = require('../models/InPersonAestheticTraining');
const OnlineLiveTraining = require('../models/onlineLiveTrainingModel');
const SelfPacedOnlineTraining = require('../models/selfPacedOnlineTrainingModel');

// Helper function to create enrollment object based on course type
function createEnrollmentObject(courseType, course, status = 'cart') {
  const baseEnrollment = {
    courseId: course._id,
    enrollmentData: {
      status: status,
      registrationDate: new Date(),
      paidAmount: 0, // Will be set based on course price
      paymentTransactionId: null,
      promoCodeUsed: null
    }
  };

  // Set price and type-specific fields based on course type
  switch(courseType) {
    case 'InPersonAestheticTraining':
      // Transfer price from course model
      baseEnrollment.enrollmentData.paidAmount = course.enrollment?.price || 0;
      
      // Initialize user progress structure for in-person courses
      baseEnrollment.userProgress = {
        attendanceRecords: [],
        overallAttendancePercentage: 0,
        assessmentScore: null,
        assessmentCompleted: false,
        courseStatus: 'not-started',
        completionDate: null
      };
      
      // Set notifications
      baseEnrollment.notificationsEnabled = true;
      break;

    case 'OnlineLiveTraining':
      // Transfer price from course model
      baseEnrollment.enrollmentData.paidAmount = course.enrollment?.price || 0;
      
      // Initialize user progress structure for online live courses
      baseEnrollment.userProgress = {
        sessionsAttended: [],
        overallAttendancePercentage: 0,
        recordingsWatched: [],
        assessmentAttempts: [],
        bestAssessmentScore: null,
        courseStatus: 'not-started',
        completionDate: null
      };
      
      // Initialize downloaded materials array
      baseEnrollment.downloadedMaterials = [];
      baseEnrollment.notificationsEnabled = true;
      break;

    case 'SelfPacedOnlineTraining':
      // Transfer price from course model
      baseEnrollment.enrollmentData.paidAmount = course.access?.price || 0;
      
      // Don't set expiry date until payment is completed
      baseEnrollment.enrollmentData.expiryDate = null;
      
      // Initialize video progress for each video in the course
      baseEnrollment.videoProgress = [];
      if (course.videos && course.videos.length > 0) {
        baseEnrollment.videoProgress = course.videos.map(video => ({
          videoId: video._id,
          watchProgress: {
            currentTime: 0,
            totalDuration: video.duration ? video.duration * 60 : 0, // Convert minutes to seconds
            percentageWatched: 0,
            isCompleted: false,
            completedDate: null,
            lastWatchedAt: null,
            watchCount: 0
          }
        }));
      }
      
      // Initialize exam progress
      baseEnrollment.examProgress = [];
      
      // Initialize course progress
      baseEnrollment.courseProgress = {
        completedVideos: [],
        completedExams: [],
        overallPercentage: 0,
        totalWatchTime: 0,
        averageExamScore: 0,
        lastAccessedAt: null,
        status: 'not-started',
        completionDate: null
      };
      
      // Initialize arrays for notes and bookmarks
      baseEnrollment.videoNotes = [];
      baseEnrollment.bookmarks = [];
      break;
  }

  return baseEnrollment;
}

// Add to Cart - Single method for all course types
exports.addToCart = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please log in to add courses to cart' 
      });
    }

    const { courseId, courseType } = req.body;
    
    console.log('🛒 Adding to cart:', { courseId, courseType });
    
    // Map course types to their models and user fields
    const COURSE_MAPPINGS = {
      'InPersonAestheticTraining': {
        userField: 'myInPersonCourses',
        model: InPersonAestheticTraining
      },
      'OnlineLiveTraining': {
        userField: 'myLiveCourses',
        model: OnlineLiveTraining
      },
      'SelfPacedOnlineTraining': {
        userField: 'mySelfPacedCourses',
        model: SelfPacedOnlineTraining
      }
    };
    
    // Validate course type
    const courseMapping = COURSE_MAPPINGS[courseType];
    if (!courseMapping) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid course type' 
      });
    }

    // Fetch the complete course data
    const course = await courseMapping.model.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    console.log('📚 Found course:', {
      id: course._id,
      title: course.basic?.title || course.title,
      price: courseType === 'SelfPacedOnlineTraining' ? course.access?.price : course.enrollment?.price
    });

    // Validate course availability
    if (courseType === 'InPersonAestheticTraining') {
      if (course.basic?.status !== 'open') {
        return res.status(400).json({ 
          success: false, 
          message: 'This course is not open for registration' 
        });
      }
      
      // Check available seats
      const enrolledCount = await User.countDocuments({
        'myInPersonCourses.courseId': courseId,
        'myInPersonCourses.enrollmentData.status': { $in: ['paid', 'registered'] }
      });
      
      const availableSeats = (course.enrollment?.seatsAvailable || 0) - enrolledCount;
      if (availableSeats <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'This course is full' 
        });
      }
    } else if (courseType === 'OnlineLiveTraining') {
      if (course.basic?.status === 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          message: 'This course has been cancelled' 
        });
      }
      
      // Check if course has started
      if (course.schedule?.startDate && new Date(course.schedule.startDate) <= new Date()) {
        return res.status(400).json({ 
          success: false, 
          message: 'This course has already started' 
        });
      }
    } else if (courseType === 'SelfPacedOnlineTraining') {
      if (course.basic?.status !== 'published') {
        return res.status(400).json({ 
          success: false, 
          message: 'This course is not available for enrollment' 
        });
      }
    }

    // Get user and check if course already exists
    const user = await User.findById(req.user._id);
    const userCourseArray = user[courseMapping.userField];
    
    // Initialize array if it doesn't exist
    if (!userCourseArray) {
      user[courseMapping.userField] = [];
    }
    
    const existingIndex = userCourseArray.findIndex(
      item => item && item.courseId && item.courseId.toString() === courseId
    );

    if (existingIndex !== -1) {
      const existing = userCourseArray[existingIndex];
      
      // Check current status
      if (['paid', 'registered', 'completed'].includes(existing.enrollmentData.status)) {
        return res.status(400).json({ 
          success: false, 
          message: 'You have already enrolled in this course' 
        });
      }

      if (existing.enrollmentData.status === 'cart') {
        return res.status(400).json({ 
          success: false, 
          message: 'This course is already in your cart' 
        });
      }

      // Update from wishlist to cart
      userCourseArray[existingIndex].enrollmentData.status = 'cart';
      userCourseArray[existingIndex].enrollmentData.registrationDate = new Date();
      
      // Update the price in case it changed
      if (courseType === 'SelfPacedOnlineTraining') {
        userCourseArray[existingIndex].enrollmentData.paidAmount = course.access?.price || 0;
      } else {
        userCourseArray[existingIndex].enrollmentData.paidAmount = course.enrollment?.price || 0;
      }
      
      console.log('✅ Updated existing enrollment from wishlist to cart');
    } else {
      // Create new enrollment with all required data
      const newEnrollment = createEnrollmentObject(courseType, course, 'cart');
      userCourseArray.push(newEnrollment);
      console.log('✅ Created new enrollment for cart:', {
        courseId: newEnrollment.courseId,
        status: newEnrollment.enrollmentData.status,
        price: newEnrollment.enrollmentData.paidAmount
      });
    }

    await user.save();
    console.log('💾 User data saved successfully');

    res.json({ 
      success: true, 
      message: 'Course added to cart successfully!' 
    });

  } catch (error) {
    console.error('❌ Error adding to cart:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding course to cart' 
    });
  }
};

// Add to Wishlist - Single method for all course types
exports.addToWishlist = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please log in to add courses to wishlist' 
      });
    }

    const { courseId, courseType } = req.body;
    
    console.log('💝 Adding to wishlist:', { courseId, courseType });
    
    // Map course types to their models and user fields
    const COURSE_MAPPINGS = {
      'InPersonAestheticTraining': {
        userField: 'myInPersonCourses',
        model: InPersonAestheticTraining
      },
      'OnlineLiveTraining': {
        userField: 'myLiveCourses',
        model: OnlineLiveTraining
      },
      'SelfPacedOnlineTraining': {
        userField: 'mySelfPacedCourses',
        model: SelfPacedOnlineTraining
      }
    };
    
    // Validate course type
    const courseMapping = COURSE_MAPPINGS[courseType];
    if (!courseMapping) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid course type' 
      });
    }

    // Fetch the complete course data
    const course = await courseMapping.model.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    // Get user and check if course already exists
    const user = await User.findById(req.user._id);
    const userCourseArray = user[courseMapping.userField];
    
    // Initialize array if it doesn't exist
    if (!userCourseArray) {
      user[courseMapping.userField] = [];
    }
    
    const existingIndex = userCourseArray.findIndex(
      item => item && item.courseId && item.courseId.toString() === courseId
    );

    if (existingIndex !== -1) {
      const existing = userCourseArray[existingIndex];
      
      if (['paid', 'registered', 'completed'].includes(existing.enrollmentData.status)) {
        return res.status(400).json({ 
          success: false, 
          message: 'You have already enrolled in this course' 
        });
      }

      if (existing.enrollmentData.status === 'wishlist') {
        return res.status(400).json({ 
          success: false, 
          message: 'This course is already in your wishlist' 
        });
      }

      // Update to wishlist
      userCourseArray[existingIndex].enrollmentData.status = 'wishlist';
      userCourseArray[existingIndex].enrollmentData.registrationDate = new Date();
      
      // Update the price in case it changed
      if (courseType === 'SelfPacedOnlineTraining') {
        userCourseArray[existingIndex].enrollmentData.paidAmount = course.access?.price || 0;
      } else {
        userCourseArray[existingIndex].enrollmentData.paidAmount = course.enrollment?.price || 0;
      }
      
      console.log('✅ Updated existing enrollment to wishlist');
    } else {
      // Create new enrollment with all required data
      const newEnrollment = createEnrollmentObject(courseType, course, 'wishlist');
      userCourseArray.push(newEnrollment);
      console.log('✅ Created new enrollment for wishlist');
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Course added to wishlist successfully!' 
    });

  } catch (error) {
    console.error('❌ Error adding to wishlist:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding course to wishlist' 
    });
  }
};


// In controllers/cartWishlistController.js, add this method:

exports.removeFromCart = async (req, res) => {
  try {
    const { courseId, courseType } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('🗑️ Removing from cart:', { courseId, courseType });

    // Map course types to user fields
    const COURSE_MAPPINGS = {
      'In-Person': 'myInPersonCourses',
      'InPersonAestheticTraining': 'myInPersonCourses',
      'Online Live': 'myLiveCourses',
      'OnlineLiveTraining': 'myLiveCourses',
      'Self-Paced': 'mySelfPacedCourses',
      'SelfPacedOnlineTraining': 'mySelfPacedCourses'
    };

    const userField = COURSE_MAPPINGS[courseType];
    if (!userField) {
      return res.status(400).json({ success: false, message: 'Invalid course type' });
    }

    // Find the course in user's array
    const courseArray = user[userField];
    const courseIndex = courseArray.findIndex(
      item => item.courseId.toString() === courseId
    );

    if (courseIndex === -1) {
      return res.status(404).json({ success: false, message: 'Course not found in cart' });
    }

    // Check if it's actually in cart
    if (courseArray[courseIndex].enrollmentData.status !== 'cart') {
      return res.status(400).json({ 
        success: false, 
        message: 'Course is not in cart' 
      });
    }

    // Remove the course from array
    courseArray.splice(courseIndex, 1);

    await user.save();

    console.log('✅ Course removed from cart successfully');
    res.json({ success: true, message: 'Course removed from cart' });

  } catch (error) {
    console.error('❌ Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Error removing course from cart' });
  }
};
