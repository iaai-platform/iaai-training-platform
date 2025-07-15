const express = require('express');
const router = express.Router();
const onDemandCoursesController = require('../controllers/onDemandCoursesController');

router.get('/on-demand-courses', onDemandCoursesController.getOnDemandCoursesPage);
router.post('/apply-on-demand', onDemandCoursesController.submitApplication);

module.exports = router;