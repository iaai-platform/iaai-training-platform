const ContactUs = require('../models/contactUsModel'); // Assuming you have the model for contact form

// 1. Display Contact Us page
exports.getContactPage = (req, res) => {
  res.render('contact-us', {
    successMessage: req.flash('successMessage'),  // Add flash success message if any
    errorMessage: req.flash('errorMessage')     // Add flash error message if any
  });
};

// 2. Submit Contact Us Form
exports.submitContactForm = async (req, res) => {
  const { name, email, subject, message, terms } = req.body;

  // Basic validation
  if (!name || !email || !subject || !message || !terms) {
    req.flash('errorMessage', 'All fields are required.');
    return res.redirect('/contact-us');
  }

  try {
    // Save the form data to the database (if necessary)
    const contactForm = new ContactUs({
      name,
      email,
      subject,
      message,
      terms
    });

    await contactForm.save();

    req.flash('successMessage', 'Your message has been sent successfully!');
    res.redirect('/contact-us');
  } catch (error) {
    console.error('Error submitting contact form:', error);
    req.flash('errorMessage', 'Something went wrong, please try again.');
    res.redirect('/contact-us');
  }
};