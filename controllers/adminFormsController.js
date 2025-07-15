const TrainerApplication = require('../models/trainerApplication');
const InCompanyApplication = require('../models/inCompanyApplication');
const OnDemandApplication = require('../models/onDemandApplication');
const ContactUs = require('../models/contactUsModel');

// ✅ Fetch All Applications (Admin Only)
exports.getAllApplications = async (req, res) => {
    try {
        console.log('🔍 Fetching all applications for admin...');

        // ✅ Fetch all applications from different models
        const trainerApps = await TrainerApplication.find().lean();
        const inCompanyApps = await InCompanyApplication.find().lean();
        const onDemandApps = await OnDemandApplication.find().lean();
        const contactUsApps = await ContactUs.find().lean();

        console.log(`✅ Retrieved Applications: 
            Trainers: ${trainerApps.length}, 
            In-Company: ${inCompanyApps.length}, 
            On-Demand: ${onDemandApps.length}, 
            Contact Us: ${contactUsApps.length}`);

        // ✅ Format applications to include application type
        const applications = [
            ...trainerApps.map(app => ({
                ...app, applicationType: 'Trainer Application'
            })),
            ...inCompanyApps.map(app => ({
                ...app, applicationType: 'In-Company Training'
            })),
            ...onDemandApps.map(app => ({
                ...app, applicationType: 'On-Demand Course'
            })),
            ...contactUsApps.map(app => ({
                ...app, applicationType: 'Contact Us'
            }))
        ];

        res.render('admin-view-forms', { applications });

    } catch (err) {
        console.error('❌ Error fetching applications:', err);
        res.status(500).send('Error fetching applications');
    }
};

// ✅ Delete Application
exports.deleteApplication = async (req, res) => {
    try {
        const { applicationId } = req.body;
        if (!applicationId) {
            return res.status(400).json({ success: false, message: '❌ Application ID is required' });
        }

        // ✅ Delete application from any model
        const deletedTrainer = await TrainerApplication.findByIdAndDelete(applicationId);
        const deletedInCompany = await InCompanyApplication.findByIdAndDelete(applicationId);
        const deletedOnDemand = await OnDemandApplication.findByIdAndDelete(applicationId);
        const deletedContactUs = await ContactUs.findByIdAndDelete(applicationId);

        if (!deletedTrainer && !deletedInCompany && !deletedOnDemand && !deletedContactUs) {
            return res.status(404).json({ success: false, message: '❌ Application not found' });
        }

        res.json({ success: true, message: '✅ Application deleted successfully!' });
    } catch (err) {
        console.error('❌ Error deleting application:', err);
        res.status(500).json({ success: false, message: '❌ Server error! Please try again.' });
    }
};