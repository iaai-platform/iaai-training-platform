// controllers/profileController.js
const User = require('../models/user');
const bcrypt = require('bcrypt');

// ✅ 1️⃣ Fetch User Profile - FIXED
exports.getProfilePage = async (req, res) => {
    try {
        console.log('🔍 Fetching user profile...');
        const user = await User.findById(req.user._id).lean();

        if (!user) {
            console.error('❌ User not found');
            return res.status(404).send('User not found');
        }

        console.log('👤 User found:', user.email);
        console.log('📋 User object keys:', Object.keys(user));

        // ✅ FIXED: Pass the user object directly (not user.myAccount)
        res.render('profile', { 
            user: user,
            title: 'My Profile'
        });
    } catch (err) {
        console.error('❌ Error fetching profile:', err);
        res.status(500).send('Error fetching profile');
    }
};

// ✅ 2️⃣ Update User Profile (Except Email) - FIXED
exports.updateProfile = async (req, res) => {
    try {
        console.log('🔧 Updating user profile...');
        const { firstName, lastName, phoneNumber, country, profession, address } = req.body;

        console.log('📝 Update data:', { firstName, lastName, phoneNumber, country, profession, address });

        // ✅ FIXED: Update fields directly on user object (not nested in myAccount)
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id, 
            {
                firstName: firstName,
                lastName: lastName,
                phoneNumber: phoneNumber,
                country: country,
                profession: profession,
                address: address // Note: Check if this field exists in your schema
            },
            { new: true } // Return updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('✅ Profile updated successfully for:', updatedUser.email);
        res.json({ success: true, message: '✅ Profile updated successfully!' });
    } catch (err) {
        console.error('❌ Error updating profile:', err);
        res.status(500).json({ success: false, message: '❌ Error updating profile' });
    }
};

// ✅ 3️⃣ Update User Password - FIXED
exports.updatePassword = async (req, res) => {
    try {
        console.log('🔐 Updating user password...');
        const { currentPassword, newPassword } = req.body;

        // ✅ Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ 
                success: false, 
                message: '⚠️ Password must be at least 8 characters long' 
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // ✅ FIXED: Check current password directly on user object (not user.myAccount.password)
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            console.log('❌ Current password mismatch for user:', user.email);
            return res.status(400).json({ success: false, message: '⚠️ Incorrect current password' });
        }

        // ✅ Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // ✅ FIXED: Update password directly on user object (not nested in myAccount)
        await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

        console.log('✅ Password updated successfully for:', user.email);
        res.json({ success: true, message: '✅ Password updated successfully!' });
    } catch (err) {
        console.error('❌ Error updating password:', err);
        res.status(500).json({ success: false, message: '❌ Error updating password' });
    }
};