const InCompanyApplication = require('../models/inCompanyApplication'); // ✅ Import Model

// ✅ 1️⃣ Display In-Company Training Page
exports.getInCompanyCoursesPage = (req, res) => {
    res.render('in-company-courses'); // ✅ Renders `in-company-courses.ejs`
};

// ✅ 2️⃣ Handle Application Submission
exports.submitApplication = async (req, res) => {
    try {
        const { fullName, email, phoneNumber, companyName, message } = req.body;

        // ✅ Validate Required Fields
        if (!fullName || !email || !phoneNumber || !message) {
            return res.status(400).json({ success: false, message: '⚠️ All fields are required!' });
        }

        // ✅ Save the Application to Database
        const application = new InCompanyApplication({
            fullName,
            email,
            phoneNumber,
            companyName: companyName || 'N/A', // ✅ Default to 'N/A' if not provided
            message
        });

        await application.save();
        console.log('✅ In-Company Training Application Saved:', application);

        res.json({ success: true, message: '✅ Application submitted successfully!' });

    } catch (err) {
        console.error('❌ Error saving application:', err);
        res.status(500).json({ success: false, message: '❌ Server error! Please try again later.' });
    }
};

// ✅ 3️⃣ Admin View: Retrieve All Applications
exports.getAllApplications = async (req, res) => {
    try {
        const applications = await InCompanyApplication.find().lean();
        res.render('admin-in-company-applications', { applications });
    } catch (err) {
        console.error('❌ Error fetching applications:', err);
        res.status(500).send('Error fetching applications');
    }
};