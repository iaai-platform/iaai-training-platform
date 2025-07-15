// controllers/certificationBodyController.js
const CertificationBody = require('../models/CertificationBody');
const fs = require('fs');
const path = require('path');

// ============================================
// VIEW CONTROLLERS
// ============================================

// Render the certification bodies management page
exports.getCertificationBodiesPage = (req, res) => {
    if (req.user.role !== 'admin') {
        req.flash('error_message', 'Access denied. Admin privileges required.');
        return res.redirect('/dashboard');
    }
    
    res.render('admin/certificationBodies', {
        title: 'Certification Bodies Management',
        user: req.user
    });
};

// ============================================
// API CONTROLLERS
// ============================================

// Get all certification bodies
exports.getAllCertificationBodies = async (req, res) => {
    try {
        const certificationBodies = await CertificationBody.find({ isDeleted: false })
            .sort({ isPreferred: -1, companyName: 1 });
        
        // Format data for frontend
        const formattedBodies = certificationBodies.map(body => ({
            _id: body._id,
            companyName: body.companyName,
            shortName: body.shortName,
            email: body.email,
            phone: body.phone,
            website: body.website,
            logo: body.logo ? `/certification-bodies/logo/${body._id}` : null,
            address: body.address,
            fullAddress: body.fullAddress,
            displayName: body.displayName,
            specializations: body.specializations,
            membershipLevel: body.membershipLevel,
            isActive: body.isActive,
            isPreferred: body.isPreferred,
            statistics: body.statistics,
            createdAt: body.createdAt,
            updatedAt: body.updatedAt
        }));
        
        res.json({
            success: true,
            certificationBodies: formattedBodies
        });
    } catch (error) {
        console.error('Error fetching certification bodies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch certification bodies'
        });
    }
};

// Get active certification bodies (for dropdowns)
exports.getActiveCertificationBodies = async (req, res) => {
    try {
        const activeBodies = await CertificationBody.findActive();
        
        const formattedBodies = activeBodies.map(body => ({
            id: body._id,
            name: body.displayName,
            companyName: body.companyName,
            shortName: body.shortName,
            logo: body.logo ? `/certification-bodies/logo/${body._id}` : null,
            membershipLevel: body.membershipLevel
        }));
        
        res.json({
            success: true,
            certificationBodies: formattedBodies
        });
    } catch (error) {
        console.error('Error fetching active certification bodies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active certification bodies'
        });
    }
};

// Create new certification body
exports.createCertificationBody = async (req, res) => {
    try {
        const {
            companyName,
            shortName,
            registrationNumber,
            email,
            phone,
            website,
            description,
            establishedYear,
            street,
            city,
            state,
            country,
            zipCode,
            specializations,
            accreditation,
            membershipLevel,
            isActive,
            isPreferred,
            notes
        } = req.body;
        
        // Check if company already exists
        const existingBody = await CertificationBody.findOne({
            companyName: companyName,
            isDeleted: false
        });
        
        if (existingBody) {
            // Delete uploaded file if exists
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting uploaded file:', err);
                });
            }
            
            return res.status(400).json({
                success: false,
                message: 'A certification body with this name already exists'
            });
        }
        
        // Process specializations (convert comma-separated string to array)
        const specializationsArray = specializations 
            ? specializations.split(',').map(item => item.trim()).filter(item => item)
            : [];
        
        // Process accreditation
        const accreditationArray = accreditation 
            ? accreditation.split(',').map(item => item.trim()).filter(item => item)
            : [];
        
        // Create certification body data
        const certificationBodyData = {
            companyName,
            shortName,
            registrationNumber,
            email,
            phone,
            website,
            description,
            establishedYear: establishedYear ? parseInt(establishedYear) : undefined,
            address: {
                street,
                city,
                state,
                country,
                zipCode
            },
            specializations: specializationsArray,
            accreditation: accreditationArray,
            membershipLevel: membershipLevel || 'Standard',
            isActive: isActive === 'true' || isActive === true,
            isPreferred: isPreferred === 'true' || isPreferred === true,
            notes,
            createdBy: req.user.email
        };
        
        // Add logo path if uploaded
        if (req.file) {
            certificationBodyData.logo = `/uploads/certification-bodies/${req.file.filename}`;
        }
        
        const newCertificationBody = new CertificationBody(certificationBodyData);
        await newCertificationBody.save();
        
        res.json({
            success: true,
            message: 'Certification body created successfully',
            certificationBody: {
                _id: newCertificationBody._id,
                companyName: newCertificationBody.companyName,
                displayName: newCertificationBody.displayName
            }
        });
    } catch (error) {
        console.error('Error creating certification body:', error);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create certification body'
        });
    }
};

// Update certification body
exports.updateCertificationBody = async (req, res) => {
    try {
        const certificationBodyId = req.params.id;
        const certificationBody = await CertificationBody.findById(certificationBodyId);
        
        if (!certificationBody) {
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting uploaded file:', err);
                });
            }
            
            return res.status(404).json({
                success: false,
                message: 'Certification body not found'
            });
        }
        
        const {
            companyName,
            shortName,
            registrationNumber,
            email,
            phone,
            website,
            description,
            establishedYear,
            street,
            city,
            state,
            country,
            zipCode,
            specializations,
            accreditation,
            membershipLevel,
            isActive,
            isPreferred,
            notes
        } = req.body;
        
        // Check if another certification body has the same name
        if (companyName !== certificationBody.companyName) {
            const existingBody = await CertificationBody.findOne({
                companyName: companyName,
                _id: { $ne: certificationBodyId },
                isDeleted: false
            });
            
            if (existingBody) {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error('Error deleting uploaded file:', err);
                    });
                }
                
                return res.status(400).json({
                    success: false,
                    message: 'Another certification body with this name already exists'
                });
            }
        }
        
        // Process arrays
        const specializationsArray = specializations 
            ? specializations.split(',').map(item => item.trim()).filter(item => item)
            : [];
        
        const accreditationArray = accreditation 
            ? accreditation.split(',').map(item => item.trim()).filter(item => item)
            : [];
        
        // Update fields
        certificationBody.companyName = companyName;
        certificationBody.shortName = shortName;
        certificationBody.registrationNumber = registrationNumber;
        certificationBody.email = email;
        certificationBody.phone = phone;
        certificationBody.website = website;
        certificationBody.description = description;
        certificationBody.establishedYear = establishedYear ? parseInt(establishedYear) : undefined;
        certificationBody.address = {
            street,
            city,
            state,
            country,
            zipCode
        };
        certificationBody.specializations = specializationsArray;
        certificationBody.accreditation = accreditationArray;
        certificationBody.membershipLevel = membershipLevel || 'Standard';
        certificationBody.isActive = isActive === 'true' || isActive === true;
        certificationBody.isPreferred = isPreferred === 'true' || isPreferred === true;
        certificationBody.notes = notes;
        certificationBody.lastModifiedBy = req.user.email;
        
        // Handle logo update
        if (req.file) {
            // Delete old logo if it exists
            if (certificationBody.logo) {
                const oldLogoPath = path.join(__dirname, '..', certificationBody.logo);
                fs.unlink(oldLogoPath, (err) => {
                    if (err) console.error('Error deleting old logo:', err);
                });
            }
            
            certificationBody.logo = `/uploads/certification-bodies/${req.file.filename}`;
        }
        
        await certificationBody.save();
        
        res.json({
            success: true,
            message: 'Certification body updated successfully'
        });
    } catch (error) {
        console.error('Error updating certification body:', error);
        
        // Delete uploaded file if there was an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update certification body'
        });
    }
};

// Delete certification body (soft delete)
exports.deleteCertificationBody = async (req, res) => {
    try {
        const certificationBodyId = req.params.id;
        
        const certificationBody = await CertificationBody.findById(certificationBodyId);
        if (!certificationBody) {
            return res.status(404).json({
                success: false,
                message: 'Certification body not found'
            });
        }
        
        // Soft delete
        certificationBody.isDeleted = true;
        certificationBody.lastModifiedBy = req.user.email;
        await certificationBody.save();
        
        res.json({
            success: true,
            message: 'Certification body deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting certification body:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete certification body'
        });
    }
};

// Serve logo image
exports.serveLogo = async (req, res) => {
    try {
        const certificationBody = await CertificationBody.findById(req.params.id);
        
        if (!certificationBody || !certificationBody.logo) {
            return res.status(404).send('Logo not found');
        }
        
        const logoPath = path.join(__dirname, '..', certificationBody.logo);
        
        // Check if file exists
        if (!fs.existsSync(logoPath)) {
            return res.status(404).send('Logo file not found');
        }
        
        res.sendFile(logoPath);
    } catch (error) {
        console.error('Error serving logo:', error);
        res.status(500).send('Error serving logo');
    }
};

// Search certification bodies
exports.searchCertificationBodies = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.json({
                success: true,
                certificationBodies: []
            });
        }
        
        const certificationBodies = await CertificationBody.searchBodies(q);
        
        const formattedBodies = certificationBodies.map(body => ({
            _id: body._id,
            companyName: body.companyName,
            shortName: body.shortName,
            displayName: body.displayName,
            specializations: body.specializations,
            membershipLevel: body.membershipLevel,
            logo: body.logo ? `/certification-bodies/logo/${body._id}` : null
        }));
        
        res.json({
            success: true,
            certificationBodies: formattedBodies
        });
    } catch (error) {
        console.error('Error searching certification bodies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search certification bodies'
        });
    }
};