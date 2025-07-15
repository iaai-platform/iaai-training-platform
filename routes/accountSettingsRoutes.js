// routes/accountSettingsRoutes.js
const express = require('express');
const router = express.Router();
const accountSettingsController = require('../controllers/accountSettingsController');
const isAuthenticated = require('../middlewares/isAuthenticated');

// ✅ Security Settings
router.get('/account/security', isAuthenticated, accountSettingsController.getSecurityPage);
router.post('/account/security/password', isAuthenticated, accountSettingsController.updatePassword);
router.post('/account/security/2fa', isAuthenticated, accountSettingsController.toggle2FA);
router.get('/account/security/activity', isAuthenticated, accountSettingsController.getLoginActivity);

// ✅ Notification Settings
router.get('/account/notifications', isAuthenticated, accountSettingsController.getNotificationsPage);
router.post('/account/notifications', isAuthenticated, accountSettingsController.updateNotifications);

// ✅ Privacy Settings
router.get('/account/privacy', isAuthenticated, accountSettingsController.getPrivacyPage);
router.post('/account/privacy', isAuthenticated, accountSettingsController.updatePrivacy);
router.post('/account/privacy/delete', isAuthenticated, accountSettingsController.requestAccountDeletion);

// ✅ Billing Settings
router.get('/account/billing', isAuthenticated, accountSettingsController.getBillingPage);
router.post('/account/billing/payment-method', isAuthenticated, accountSettingsController.addPaymentMethod);
router.delete('/account/billing/payment-method/:id', isAuthenticated, accountSettingsController.removePaymentMethod);
router.get('/account/billing/history', isAuthenticated, accountSettingsController.getBillingHistory);

// ✅ Learning Preferences
router.get('/account/preferences', isAuthenticated, accountSettingsController.getPreferencesPage);
router.post('/account/preferences', isAuthenticated, accountSettingsController.updatePreferences);

// ✅ Professional Profile
router.get('/account/professional', isAuthenticated, accountSettingsController.getProfessionalPage);
router.post('/account/professional', isAuthenticated, accountSettingsController.updateProfessional);



// Add these routes:
router.get('/account/billing/transaction/:transactionId', isAuthenticated, accountSettingsController.getTransactionDetails);
router.get('/account/billing/receipt/:transactionId', isAuthenticated, accountSettingsController.downloadReceipt);

module.exports = router;