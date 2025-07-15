const TrainerApplication = require('../models/trainerApplication');

/* ======================================================
   ✅ 1️⃣ Render New Trainers Page with Application Form
====================================================== */
exports.getTrainerApplicationPage = (req, res) => {
    res.render('new-trainers-required');
};

/* ======================================================
   ✅ 2️⃣ Handle Trainer Application Submission
====================================================== */
exports.submitTrainerApplication = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, experience, expertise, cvUrl } = req.body;

        if (!fullName || !email || !phoneNumber || !experience || !expertise || !cvUrl) {
            return res.status(400).json({ success: false, message: '⚠️ All fields are required!' });
        }

        // ✅ Save application to database
        const newApplication = new TrainerApplication({
            fullName, email, phoneNumber, experience, expertise, cvUrl
        });

        await newApplication.save();

        res.json({ success: true, message: '✅ Application submitted successfully!' });
    } catch (err) {
        console.error('❌ Error submitting application:', err);
        res.status(500).json({ success: false, message: '❌ Server error' });
    }
};

/* ======================================================
   ✅ 3️⃣ Admin View: Get All Applications
====================================================== */
exports.getAllTrainerApplications = async (req, res) => {
    try {
        const applications = await TrainerApplication.find().sort({ appliedAt: -1 });
        res.render('admin-trainer-applications', { applications });
    } catch (err) {
        console.error('❌ Error fetching applications:', err);
        res.status(500).send('Error fetching applications.');
    }
};