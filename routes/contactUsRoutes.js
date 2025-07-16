//routes/contactUsRoutes.js
const express = require("express");
const router = express.Router();
const contactUsController = require("../controllers/contactUsController");

// Define route to render contact us page
router.get("/contact-us", contactUsController.getContactPage);

// Define route to handle contact form submission
router.post("/contact-us", contactUsController.submitContactForm);

// Export the router to use in server.js
module.exports = router;
