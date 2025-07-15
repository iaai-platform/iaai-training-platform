// routes/customerSupportRoutes.js
const express = require('express');
const router = express.Router();
const customerSupportController = require('../controllers/customerSupportController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// ✅ Help Center (Public access)
router.get('/support/help', customerSupportController.getHelpCenter);

// ✅ Contact Support (Public access)
router.get('/support/contact', customerSupportController.getContactPage);
router.post('/support/contact', customerSupportController.submitContactForm);

// ✅ Support Tickets (Requires login)
router.get('/support/tickets', isAuthenticated, customerSupportController.getTicketsPage);
router.get('/support/tickets/:id', isAuthenticated, customerSupportController.getTicketDetails);

// ✅ Community Forum (Public access)
router.get('/support/community', customerSupportController.getCommunityPage);

// ✅ Feedback (Requires login)
router.get('/support/feedback', isAuthenticated, customerSupportController.getFeedbackPage);
router.post('/support/feedback/course', isAuthenticated, customerSupportController.submitCourseFeedback);
router.post('/support/feedback/feature', isAuthenticated, customerSupportController.submitFeatureFeedback);

// ✅ Live Chat (Requires login)
router.get('/support/chat', isAuthenticated, customerSupportController.getChatPage);
router.post('/support/chat/start', isAuthenticated, customerSupportController.startChat);

module.exports = router;