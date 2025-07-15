const PromoCode = require('../models/promoCode');

// ✅ Fetch and Display All Promo Codes
exports.getPromoCodes = async (req, res) => {
    try {
        const promoCodes = await PromoCode.find();
        res.render('admin-promo-codes', { promoCodes });
    } catch (err) {
        console.error('❌ Error fetching promo codes:', err);
        res.status(500).send('Server error');
    }
};

// ✅ Add a New Promo Code
exports.addPromoCode = async (req, res) => {
    try {
        const { code, discountPercentage, expiryDate } = req.body;
        const newPromo = new PromoCode({ code, discountPercentage, expiryDate });
        await newPromo.save();
        res.redirect('/admin-promo-codes');
    } catch (err) {
        console.error('❌ Error adding promo code:', err);
        res.status(500).send('Server error');
    }
};

// ✅ Delete a Promo Code
exports.deletePromoCode = async (req, res) => {
    try {
        await PromoCode.findByIdAndDelete(req.params.id);
        res.redirect('/admin-promo-codes');


        
    } catch (err) {
        console.error('❌ Error deleting promo code:', err);
        res.status(500).send('Server error');
    }
};