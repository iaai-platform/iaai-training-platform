// controllers/ordersController.js - Updated for new user model

const User = require('../models/user');
const SelfPacedOnlineTraining = require('../models/selfPacedOnlineTrainingModel');
const InPersonAestheticTraining = require('../models/InPersonAestheticTraining');
const OnlineLiveTraining = require('../models/onlineLiveTrainingModel');



// controllers/ordersController.js - Updated with correct price fields

exports.getCartPage = async (req, res) => {
  try {
    console.log('🔍 Fetching user cart data...');
    
    // Populate course details for cart items
    const user = await User.findById(req.user._id)
      .populate({
        path: 'myInPersonCourses.courseId',
        select: 'basic enrollment schedule venue'  // Changed from 'pricing' to 'enrollment'
      })
      .populate({
        path: 'myLiveCourses.courseId',
        select: 'basic enrollment schedule platform'  // Changed from 'pricing' to 'enrollment'
      })
      .populate({
        path: 'mySelfPacedCourses.courseId',
        select: 'basic access content'  // Changed from 'pricing' to 'access'
      })
      .lean();

    if (!user) {
      console.error('❌ User not found');
      return res.status(404).send('User not found');
    }

    // Initialize cart items array
    const cartItems = [];

    // ✅ Process In-Person Courses with status = 'cart'
    if (user.myInPersonCourses && user.myInPersonCourses.length > 0) {
      user.myInPersonCourses.forEach(enrollment => {
        if (enrollment.enrollmentData?.status === 'cart' && enrollment.courseId) {
          const course = enrollment.courseId;
          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || 'Untitled Course',
            courseCode: course.basic?.courseCode || 'N/A',
            // Use the price from enrollmentData (already transferred) or from course model
            price: enrollment.enrollmentData.paidAmount || course.enrollment?.price || 0,
            courseType: 'InPersonAestheticTraining',
            displayType: 'In-Person',
            status: 'In Cart',
            addedDate: enrollment.enrollmentData.registrationDate,
            // Additional course info for display
            startDate: course.schedule?.startDate,
            location: course.venue?.name || course.venue?.city
          });
        }
      });
    }

    // ✅ Process Online Live Courses with status = 'cart'
    if (user.myLiveCourses && user.myLiveCourses.length > 0) {
      user.myLiveCourses.forEach(enrollment => {
        if (enrollment.enrollmentData?.status === 'cart' && enrollment.courseId) {
          const course = enrollment.courseId;
          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || 'Untitled Course',
            courseCode: course.basic?.courseCode || 'N/A',
            // Use the price from enrollmentData (already transferred) or from course model
            price: enrollment.enrollmentData.paidAmount || course.enrollment?.price || 0,
            courseType: 'OnlineLiveTraining',
            displayType: 'Online Live',
            status: 'In Cart',
            addedDate: enrollment.enrollmentData.registrationDate,
            // Additional course info
            startDate: course.schedule?.startDate,
            platform: course.platform?.name
          });
        }
      });
    }

    // ✅ Process Self-Paced Courses with status = 'cart'
    if (user.mySelfPacedCourses && user.mySelfPacedCourses.length > 0) {
      user.mySelfPacedCourses.forEach(enrollment => {
        if (enrollment.enrollmentData?.status === 'cart' && enrollment.courseId) {
          const course = enrollment.courseId;
          cartItems.push({
            courseId: course._id.toString(),
            enrollmentId: enrollment._id.toString(),
            title: course.basic?.title || 'Untitled Course',
            courseCode: course.basic?.courseCode || 'N/A',
            // Use the price from enrollmentData (already transferred) or from course model
            price: enrollment.enrollmentData.paidAmount || course.access?.price || 0,
            courseType: 'SelfPacedOnlineTraining',
            displayType: 'Self-Paced',
            status: 'In Cart',
            addedDate: enrollment.enrollmentData.registrationDate,
            // Additional course info
            accessDays: course.access?.accessDays,
            totalVideos: course.videos?.length || 0
          });
        }
      });
    }

    // Sort cart items by date added (most recent first)
    cartItems.sort((a, b) => {
      const dateA = new Date(a.addedDate || 0);
      const dateB = new Date(b.addedDate || 0);
      return dateB - dateA;
    });

    console.log(`\n📍 Cart Summary: ${cartItems.length} items`);
    cartItems.forEach((item, index) => {
      console.log(`Item ${index + 1}: ${item.title} - $${item.price}`);
    });

    // ✅ Calculate total price
    const totalAmount = cartItems.reduce((total, item) => {
      return total + (parseFloat(item.price) || 0);
    }, 0);

    console.log(`\n💰 Total Cart Amount: $${totalAmount.toFixed(2)}`);

    res.render('orders', { 
      orders: cartItems,
      totalAmount: totalAmount.toFixed(2), 
      user 
    });
  } catch (err) {
    console.error('❌ Error fetching cart:', err);
    res.status(500).send('Error fetching cart');
  }
};

// Update the checkout method similarly
// In ordersController.js - Update the checkout method around line 226
exports.checkout = async (req, res) => {
  try {
    console.log('🔍 Loading checkout page...');
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error('❌ User not found');
      return res.status(404).send('User not found');
    }

    const coursesInCart = [];
    let totalPrice = 0;

    // Process In-Person Courses
    const inPersonCartItems = user.myInPersonCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId).lean();
      if (course) {
        const price = course.enrollment?.price || 0;
        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || 'Untitled Course',
          courseCode: course.basic?.courseCode || 'N/A',
          price: price,
          courseType: 'In-Person',
          status: item.enrollmentData.status,
          startDate: course.schedule?.startDate || null
        });
        totalPrice += price;
      }
    }

    // Process Online Live Courses
    const liveCartItems = user.myLiveCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId).lean();
      if (course) {
        const price = course.enrollment?.price || 0;
        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || 'Untitled Course',
          courseCode: course.basic?.courseCode || 'N/A',
          price: price,
          courseType: 'Online Live',
          status: item.enrollmentData.status,
          startDate: course.schedule?.startDate || null
        });
        totalPrice += price;
      }
    }

    // Process Self-Paced Courses
    const selfPacedCartItems = user.mySelfPacedCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(item.courseId).lean();
      if (course) {
        const price = course.access?.price || 0;
        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || 'Untitled Course',
          courseCode: course.basic?.courseCode || 'N/A',
          price: price,
          courseType: 'Self-Paced',
          status: item.enrollmentData.status,
          startDate: null
        });
        totalPrice += price;
      }
    }

    console.log(`📋 Checkout Summary: ${coursesInCart.length} items, Total: $${totalPrice.toFixed(2)}`);

    // Debug log to see what we're passing
    console.log('📦 Passing to view:', {
      coursesInCart: coursesInCart.length,
      totalPrice: totalPrice,
      hasUser: !!user
    });

    // Make sure to pass coursesInCart to the view!
    res.render('checkout', { 
      coursesInCart: coursesInCart,  // <-- This is what was missing!
      totalPrice: totalPrice, 
      user: user, 
      successMessage: '' 
    });
    
  } catch (err) {
    console.error('❌ Error loading checkout page:', err);
    res.status(500).send('Error loading checkout page: ' + err.message);
  }
};


// Controller to remove selected courses from the cart
exports.removeFromCart = async (req, res) => {
  const { courseIds } = req.body;
  const userId = req.user._id;

  try {
    console.log('🗑️ Course IDs to remove:', courseIds);

    if (!courseIds || courseIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No courses selected to remove.' 
      });
    }

    // Ensure courseIds is an array
    const courseIdArray = Array.isArray(courseIds) ? courseIds : [courseIds];

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Track removed courses for response
    let removedCount = 0;
    const removedTitles = [];

    // Helper function to check and track removals
    const checkAndRemove = (enrollment, courseArray) => {
      if (courseIdArray.includes(enrollment.courseId.toString()) && 
          enrollment.enrollmentData.status === 'cart') {
        removedCount++;
        return true;
      }
      return false;
    };

    // Remove from myInPersonCourses
    const originalInPersonCount = user.myInPersonCourses.length;
    user.myInPersonCourses = user.myInPersonCourses.filter(enrollment => {
      return !checkAndRemove(enrollment, 'InPerson');
    });

    // Remove from myLiveCourses
    const originalLiveCount = user.myLiveCourses.length;
    user.myLiveCourses = user.myLiveCourses.filter(enrollment => {
      return !checkAndRemove(enrollment, 'Live');
    });

    // Remove from mySelfPacedCourses
    const originalSelfPacedCount = user.mySelfPacedCourses.length;
    user.mySelfPacedCourses = user.mySelfPacedCourses.filter(enrollment => {
      return !checkAndRemove(enrollment, 'SelfPaced');
    });

    // Save the updated user
    await user.save();

    console.log(`✅ ${removedCount} courses removed from cart`);
    console.log(`   In-Person: ${originalInPersonCount - user.myInPersonCourses.length} removed`);
    console.log(`   Live: ${originalLiveCount - user.myLiveCourses.length} removed`);
    console.log(`   Self-Paced: ${originalSelfPacedCount - user.mySelfPacedCourses.length} removed`);

    res.json({ 
      success: true, 
      message: `${removedCount} course${removedCount !== 1 ? 's' : ''} removed from cart`,
      removedCount: removedCount
    });
  } catch (err) {
    console.error('❌ Error removing courses from cart:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing courses from cart' 
    });
  }
};


