//checkoutController.js
const User = require('../models/user');
const SelfPacedOnlineTraining = require('../models/selfPacedOnlineTrainingModel');
const InPersonAestheticTraining = require('../models/InPersonAestheticTraining');
const OnlineLiveTraining = require('../models/onlineLiveTrainingModel');
const PromoCode = require('../models/promoCode');
const sendEmail = require('../utils/sendEmail'); 
const { v4: uuidv4 } = require('uuid');

// ✅ 1️⃣ Display Checkout Page - UPDATED FOR NEW USER MODEL
exports.getCheckoutPage = async (req, res) => {
  try {
    console.log('🔍 Loading checkout page...');
    const user = await User.findById(req.user._id).lean();

    if (!user) {
      console.error('❌ User not found');
      return res.status(404).send('User not found');
    }

    const coursesInCart = [];

    // ✅ Process In-Person Courses
    const inPersonCartItems = user.myInPersonCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];

    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId).lean();
      if (course) {
        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || 'Untitled Course',
          courseCode: course.basic?.courseCode || 'N/A',
          price: course.enrollment?.price || 0,  // ✅ FIXED: enrollment.price
          courseType: 'In-Person',
          status: item.enrollmentData.status,
          startDate: course.schedule?.startDate || null
        });
      }
    }

    // ✅ Process Online Live Courses
    const liveCartItems = user.myLiveCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];

    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId).lean();
      if (course) {
        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || 'Untitled Course',
          courseCode: course.basic?.courseCode || 'N/A',
          price: course.enrollment?.price || 0,  // ✅ FIXED: enrollment.price
          courseType: 'Online Live',
          status: item.enrollmentData.status,
          startDate: course.schedule?.startDate || null
        });
      }
    }

    // ✅ Process Self-Paced Courses
    const selfPacedCartItems = user.mySelfPacedCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];

    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(item.courseId).lean();
      if (course) {
        coursesInCart.push({
          courseId: item.courseId,
          title: course.basic?.title || 'Untitled Course',
          courseCode: course.basic?.courseCode || 'N/A',
          price: course.access?.price || 0,  // ✅ FIXED: access.price for self-paced
          courseType: 'Self-Paced',
          status: item.enrollmentData.status,
          startDate: null // Self-paced courses don't have start dates
        });
      }
    }

    console.log('📌 Cart Courses Found:', {
      inPerson: inPersonCartItems.length,
      live: liveCartItems.length,
      selfPaced: selfPacedCartItems.length
    });

    let totalPrice = coursesInCart.reduce((total, course) => total + (course.price || 0), 0);

    console.log(`✅ Checkout loaded with ${coursesInCart.length} courses, total: $${totalPrice}`);

    res.render('checkout', { 
      coursesInCart, 
      totalPrice, 
      user, 
      successMessage: '' 
    });
  } catch (err) {
    console.error('❌ Error loading checkout page:', err);
    res.status(500).send('Error loading checkout page');
  }
};

// ✅ 2️⃣ Apply Promo Code & Update Price - UPDATED
exports.applyPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Calculate total price from cart courses
    let totalPrice = 0;
    
    // Get in-person cart courses
    const inPersonCartItems = user.myInPersonCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];
    
    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId);
      if (course) {
        totalPrice += course.enrollment?.price || 0;  // ✅ FIXED
      }
    }

    // Get online live cart courses
    const liveCartItems = user.myLiveCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];
    
    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId);
      if (course) {
        totalPrice += course.enrollment?.price || 0;  // ✅ FIXED
      }
    }

    // Get self-paced cart courses
    const selfPacedCartItems = user.mySelfPacedCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];
    
    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(item.courseId);
      if (course) {
        totalPrice += course.access?.price || 0;  // ✅ FIXED
      }
    }

    if (totalPrice === 0) {
      return res.json({ success: false, message: 'No courses in cart.' });
    }

    // Fetch promo code from database
    const promo = await PromoCode.findOne({ 
      code: promoCode.toUpperCase(), 
      isActive: true 
    });

    if (!promo) {
      return res.json({ success: false, message: 'Invalid or expired promo code.' });
    }

    // Check if promo code has expired
    if (promo.expiryDate && new Date() > promo.expiryDate) {
      return res.json({ success: false, message: 'This promo code has expired.' });
    }

    console.log(`✅ Applying Promo Code: ${promo.code} - Discount: ${promo.discountPercentage}%`);
    const discountedPrice = totalPrice * (1 - promo.discountPercentage / 100);

    // Store promo code in session for later use
    req.session.appliedPromoCode = promo.code;

    const completeRegistration = discountedPrice <= 0;

    res.json({ 
      success: true, 
      newTotalPrice: discountedPrice.toFixed(2), 
      completeRegistration
    });

  } catch (err) {
    console.error('❌ Error applying promo code:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 3️⃣ Process Checkout - UPDATED
exports.processCheckout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Check if user has any courses in cart
    const hasCartItems = 
      user.myInPersonCourses?.some(e => e.enrollmentData.status === 'cart') ||
      user.myLiveCourses?.some(e => e.enrollmentData.status === 'cart') ||
      user.mySelfPacedCourses?.some(e => e.enrollmentData.status === 'cart');

    if (!hasCartItems) {
      return res.status(400).json({ success: false, message: 'No courses in cart.' });
    }

    // Calculate total price
    let totalPrice = 0;
    
    // Similar price calculation as in applyPromoCode
    // (You might want to extract this into a helper function)
    
    if (totalPrice === 0 || req.session.appliedPromoCode) {
      return res.redirect('/complete-registration');
    } else {
      return res.redirect('/payment');
    }
  } catch (err) {
    console.error('❌ Error processing checkout:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 4️⃣ Process Payment - UPDATED
exports.processPayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    let totalPrice = 0;
    const cartCourses = [];
    
    // Collect all cart courses with prices
    const inPersonCartItems = user.myInPersonCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];
    
    for (const item of inPersonCartItems) {
      const course = await InPersonAestheticTraining.findById(item.courseId);
      if (course) {
        const price = course.enrollment?.price || 0;  // ✅ FIXED
        totalPrice += price;
        cartCourses.push({
          title: course.basic?.title,
          price: price
        });
      }
    }

    const liveCartItems = user.myLiveCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];
    
    for (const item of liveCartItems) {
      const course = await OnlineLiveTraining.findById(item.courseId);
      if (course) {
        const price = course.enrollment?.price || 0;  // ✅ FIXED
        totalPrice += price;
        cartCourses.push({
          title: course.basic?.title,
          price: price
        });
      }
    }

    const selfPacedCartItems = user.mySelfPacedCourses?.filter(
      enrollment => enrollment.enrollmentData.status === 'cart'
    ) || [];
    
    for (const item of selfPacedCartItems) {
      const course = await SelfPacedOnlineTraining.findById(item.courseId);
      if (course) {
        const price = course.access?.price || 0;  // ✅ FIXED
        totalPrice += price;
        cartCourses.push({
          title: course.basic?.title,
          price: price
        });
      }
    }

    if (totalPrice === 0) {
      return res.redirect('/complete-registration');
    }

    return res.render('payment', { totalPrice, user, cartCourses });

  } catch (err) {
    console.error('❌ Error processing payment:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ 5️⃣ Complete Registration - UPDATED FOR NEW USER MODEL
exports.completeRegistration = async (req, res) => {
  try {
    console.log('🎯 Starting registration process...');
    const user = await User.findById(req.user._id);
    
    const registeredCourses = [];
    let coursesUpdated = 0;
    const referenceNumber = uuidv4();
    const transactionId = uuidv4();
    const receiptNumber = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Update in-person courses
    for (let i = 0; i < user.myInPersonCourses.length; i++) {
      const enrollment = user.myInPersonCourses[i];
      if (enrollment.enrollmentData.status === 'cart') {
        const course = await InPersonAestheticTraining.findById(enrollment.courseId);
        if (course) {
          // Update enrollment status
          user.myInPersonCourses[i].enrollmentData.status = 'registered';
          user.myInPersonCourses[i].enrollmentData.paidAmount = 0;
          user.myInPersonCourses[i].enrollmentData.promoCodeUsed = req.session.appliedPromoCode || 'PROMO100';
          
          coursesUpdated++;
          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: 'In-Person',
            price: course.enrollment?.price || 0,  // ✅ FIXED
            startDate: course.schedule?.startDate
          });
        }
      }
    }

    // Update online live courses
    for (let i = 0; i < user.myLiveCourses.length; i++) {
      const enrollment = user.myLiveCourses[i];
      if (enrollment.enrollmentData.status === 'cart') {
        const course = await OnlineLiveTraining.findById(enrollment.courseId);
        if (course) {
          // Update enrollment status
          user.myLiveCourses[i].enrollmentData.status = 'registered';
          user.myLiveCourses[i].enrollmentData.paidAmount = 0;
          user.myLiveCourses[i].enrollmentData.promoCodeUsed = req.session.appliedPromoCode || 'PROMO100';
          
          coursesUpdated++;
          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: 'Online Live',
            price: course.enrollment?.price || 0,  // ✅ FIXED
            startDate: course.schedule?.startDate
          });
        }
      }
    }

    // Update self-paced courses
    for (let i = 0; i < user.mySelfPacedCourses.length; i++) {
      const enrollment = user.mySelfPacedCourses[i];
      if (enrollment.enrollmentData.status === 'cart') {
        const course = await SelfPacedOnlineTraining.findById(enrollment.courseId);
        if (course) {
          // Update enrollment status and set expiry date
          user.mySelfPacedCourses[i].enrollmentData.status = 'registered';
          user.mySelfPacedCourses[i].enrollmentData.paidAmount = 0;
          user.mySelfPacedCourses[i].enrollmentData.promoCodeUsed = req.session.appliedPromoCode || 'PROMO100';
          
          // Set expiry date based on course access days
          if (course.access?.accessDays) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + course.access.accessDays);
            user.mySelfPacedCourses[i].enrollmentData.expiryDate = expiryDate;
          }
          
          coursesUpdated++;
          registeredCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: 'Self-Paced',
            price: course.access?.price || 0,  // ✅ FIXED for self-paced
            startDate: null
          });
        }
      }
    }

    if (coursesUpdated === 0) {
      console.log('❌ No courses found in cart');
      return res.status(400).json({ success: false, message: 'No courses in cart.' });
    }

    // Create payment transaction record
    const totalAmount = registeredCourses.reduce((sum, course) => sum + course.price, 0);
    const transaction = {
      transactionId: transactionId,
      receiptNumber: receiptNumber,
      transactionDate: new Date(),
      paymentMethod: 'Promo Code',
      paymentStatus: 'completed',
      subtotal: totalAmount,
      discountAmount: totalAmount, // 100% discount
      tax: 0,
      finalAmount: 0,
      currency: 'USD',
      items: registeredCourses.map(course => ({
        courseId: course.courseId,
        courseType: course.courseType,
        originalPrice: course.price,
        paidPrice: 0
      })),
      promoCode: req.session.appliedPromoCode || 'PROMO100'
    };

    user.paymentTransactions.push(transaction);
    
    await user.save({ validateBeforeSave: false });

    // Clear the applied promo code from session
    delete req.session.appliedPromoCode;

    // Send confirmation email
    try {
      await sendCourseRegistrationEmail(user, registeredCourses, referenceNumber, true);
      console.log('✅ Registration email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending registration email:', emailError);
    }

    console.log(`✅ Registration completed for ${coursesUpdated} courses`);
    console.log(`📋 Reference number: ${referenceNumber}`);

    // Handle both POST (AJAX) and GET requests
    if (req.method === 'POST') {
      res.json({ 
        success: true, 
        message: 'Registration completed successfully!',
        referenceNumber: referenceNumber
      });
    } else {
      res.redirect(`/success?ref=${referenceNumber}`);
    }

  } catch (err) {
    console.error('❌ Error completing registration:', err);
    
    if (req.method === 'POST') {
      res.status(500).json({ success: false, message: 'Server error during registration' });
    } else {
      res.status(500).send('Error completing registration');
    }
  }
};

// ✅ 6️⃣ Process payment confirmation - UPDATED
exports.processPaymentConfirmation = async (req, res) => {
  try {
    const { paymentMethod, amount } = req.body;
    const user = await User.findById(req.user._id);
    
    const paidCourses = [];
    const referenceNumber = uuidv4();
    const transactionId = uuidv4();
    const receiptNumber = `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Update in-person courses
    for (let i = 0; i < user.myInPersonCourses.length; i++) {
      const enrollment = user.myInPersonCourses[i];
      if (enrollment.enrollmentData.status === 'cart') {
        const course = await InPersonAestheticTraining.findById(enrollment.courseId);
        if (course) {
          const coursePrice = course.enrollment?.price || 0;  // ✅ FIXED
          
          user.myInPersonCourses[i].enrollmentData.status = 'paid';
          user.myInPersonCourses[i].enrollmentData.paidAmount = coursePrice;
          user.myInPersonCourses[i].enrollmentData.paymentTransactionId = transactionId;
          
          paidCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: 'In-Person',
            price: coursePrice,
            startDate: course.schedule?.startDate
          });
        }
      }
    }

    // Update online live courses
    for (let i = 0; i < user.myLiveCourses.length; i++) {
      const enrollment = user.myLiveCourses[i];
      if (enrollment.enrollmentData.status === 'cart') {
        const course = await OnlineLiveTraining.findById(enrollment.courseId);
        if (course) {
          const coursePrice = course.enrollment?.price || 0;  // ✅ FIXED
          
          user.myLiveCourses[i].enrollmentData.status = 'paid';
          user.myLiveCourses[i].enrollmentData.paidAmount = coursePrice;
          user.myLiveCourses[i].enrollmentData.paymentTransactionId = transactionId;
          
          paidCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: 'Online Live',
            price: coursePrice,
            startDate: course.schedule?.startDate
          });
        }
      }
    }

    // Update self-paced courses
    for (let i = 0; i < user.mySelfPacedCourses.length; i++) {
      const enrollment = user.mySelfPacedCourses[i];
      if (enrollment.enrollmentData.status === 'cart') {
        const course = await SelfPacedOnlineTraining.findById(enrollment.courseId);
        if (course) {
          const coursePrice = course.access?.price || 0;  // ✅ FIXED for self-paced
          
          user.mySelfPacedCourses[i].enrollmentData.status = 'paid';
          user.mySelfPacedCourses[i].enrollmentData.paidAmount = coursePrice;
          user.mySelfPacedCourses[i].enrollmentData.paymentTransactionId = transactionId;
          
          // Set expiry date
          if (course.access?.accessDays) {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + course.access.accessDays);
            user.mySelfPacedCourses[i].enrollmentData.expiryDate = expiryDate;
          }
          
          paidCourses.push({
            courseId: enrollment.courseId,
            title: course.basic?.title,
            courseCode: course.basic?.courseCode,
            courseType: 'Self-Paced',
            price: coursePrice,
            startDate: null
          });
        }
      }
    }

    // Create payment transaction
    const totalAmount = paidCourses.reduce((sum, course) => sum + course.price, 0);
    const transaction = {
      transactionId: transactionId,
      receiptNumber: receiptNumber,
      transactionDate: new Date(),
      paymentMethod: paymentMethod || 'Credit Card',
      paymentStatus: 'completed',
      subtotal: totalAmount,
      discountAmount: 0,
      tax: 0,
      finalAmount: amount || totalAmount,
      currency: 'USD',
      items: paidCourses.map(course => ({
        courseId: course.courseId,
        courseType: course.courseType,
        originalPrice: course.price,
        paidPrice: course.price
      }))
    };

    user.paymentTransactions.push(transaction);
    
    await user.save({ validateBeforeSave: false });

    // Send confirmation email
    try {
      await sendCourseRegistrationEmail(user, paidCourses, referenceNumber, false);
      console.log('✅ Payment confirmation email sent');
    } catch (emailError) {
      console.error('❌ Error sending payment confirmation email:', emailError);
    }

    res.json({ 
      success: true, 
      message: 'Payment processed successfully!',
      referenceNumber: referenceNumber
    });

  } catch (err) {
    console.error('❌ Error processing payment confirmation:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Helper function to send course registration email (unchanged)
async function sendCourseRegistrationEmail(user, courses, referenceNumber, isPromoCode = false) {
  const courseListHtml = courses.map(course => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${course.title}</strong><br>
        <span style="color: #666; font-size: 14px;">
          Code: ${course.courseCode} | Type: ${course.courseType}
          ${course.startDate ? `| Starts: ${new Date(course.startDate).toLocaleDateString()}` : ''}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
        ${isPromoCode ? '<span style="color: #28a745;">FREE</span>' : `$${course.price}`}
      </td>
    </tr>
  `).join('');

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
            ${isPromoCode ? '<br><em>These courses were registered using a promotional code.</em>' : ''}
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
            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/my-courses" class="button">
              View My Courses
            </a>
          </center>
          
          <p>If you have any questions, please contact our support team at ${process.env.SUPPORT_EMAIL || 'support@iaai-training.com'}</p>
          
          <p>Thank you for choosing IAAI Training Institute!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: user.email,
    subject: `Course Registration Confirmed - IAAI Training (Ref: ${referenceNumber})`,
    html: emailHtml
  });
}