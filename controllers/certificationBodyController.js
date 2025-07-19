// controllers/certificationBodyController.js - Updated with Cloudinary
const CertificationBody = require("../models/CertificationBody");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary (if not already configured globally)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// VIEW CONTROLLERS
// ============================================

// Render the certification bodies management page
exports.getCertificationBodiesPage = (req, res) => {
  if (req.user.role !== "admin") {
    req.flash("error_message", "Access denied. Admin privileges required.");
    return res.redirect("/dashboard");
  }

  res.render("admin/certificationBodies", {
    title: "Certification Bodies Management",
    user: req.user,
  });
};

// ============================================
// API CONTROLLERS
// ============================================

// Get all certification bodies
// Get all certification bodies - UPDATED TO INCLUDE ALL FIELDS
exports.getAllCertificationBodies = async (req, res) => {
  try {
    const certificationBodies = await CertificationBody.find({
      isDeleted: false,
    }).sort({ isPreferred: -1, companyName: 1 });

    // Format data for frontend - INCLUDING ALL FIELDS
    const formattedBodies = certificationBodies.map((body) => ({
      _id: body._id,
      companyName: body.companyName,
      shortName: body.shortName,
      registrationNumber: body.registrationNumber, // ADDED
      email: body.email,
      phone: body.phone,
      website: body.website,
      description: body.description, // ADDED
      establishedYear: body.establishedYear, // ADDED
      logo: body.logo || null,
      cloudinaryPublicId: body.cloudinaryPublicId, // ADDED for logo management
      address: body.address,
      fullAddress: body.fullAddress,
      displayName: body.displayName,
      specializations: body.specializations,
      accreditation: body.accreditation, // ADDED
      recognizedBy: body.recognizedBy, // ADDED
      certificationTypes: body.certificationTypes, // ADDED
      contactPersons: body.contactPersons, // ADDED
      licenses: body.licenses, // ADDED
      membershipLevel: body.membershipLevel,
      isActive: body.isActive,
      isPreferred: body.isPreferred,
      notes: body.notes, // ADDED
      statistics: body.statistics,
      createdBy: body.createdBy, // ADDED
      lastModifiedBy: body.lastModifiedBy, // ADDED
      createdAt: body.createdAt,
      updatedAt: body.updatedAt,
    }));

    console.log(
      `📋 Fetched ${formattedBodies.length} certification bodies with complete data`
    );

    res.json({
      success: true,
      certificationBodies: formattedBodies,
    });
  } catch (error) {
    console.error("Error fetching certification bodies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch certification bodies",
    });
  }
};

// Get active certification bodies (for dropdowns)
exports.getActiveCertificationBodies = async (req, res) => {
  try {
    const activeBodies = await CertificationBody.findActive();

    const formattedBodies = activeBodies.map((body) => ({
      id: body._id,
      name: body.displayName,
      companyName: body.companyName,
      shortName: body.shortName,
      logo: body.logo || null,
      membershipLevel: body.membershipLevel,
    }));

    res.json({
      success: true,
      certificationBodies: formattedBodies,
    });
  } catch (error) {
    console.error("Error fetching active certification bodies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active certification bodies",
    });
  }
};

// Create new certification body - UPDATED WITH CLOUDINARY
// Create new certification body - UPDATED WITH ALL DYNAMIC FIELDS
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
      recognizedBy,
      membershipLevel,
      isActive,
      isPreferred,
      notes,
    } = req.body;

    // Check if company already exists
    const existingBody = await CertificationBody.findOne({
      companyName: companyName,
      isDeleted: false,
    });

    if (existingBody) {
      return res.status(400).json({
        success: false,
        message: "A certification body with this name already exists",
      });
    }

    // Process specializations array
    const specializationsArray = specializations
      ? specializations
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item)
      : [];

    // Process accreditation array
    const accreditationArray = accreditation
      ? accreditation
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item)
      : [];

    // Process recognizedBy array
    const recognizedByArray = recognizedBy
      ? recognizedBy
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item)
      : [];

    // Process certification types (dynamic array)
    const certificationTypesArray = [];
    if (req.body.certificationTypes) {
      // Handle both single object and array of objects
      let certTypes = req.body.certificationTypes;
      if (!Array.isArray(certTypes)) {
        certTypes = [certTypes];
      }

      certTypes.forEach((cert, index) => {
        // Handle nested object structure from form
        if (
          cert &&
          (cert.name || req.body[`certificationTypes[${index}][name]`])
        ) {
          const certName =
            cert.name || req.body[`certificationTypes[${index}][name]`];
          const certDescription =
            cert.description ||
            req.body[`certificationTypes[${index}][description]`] ||
            "";
          const certValidityPeriod =
            cert.validityPeriod ||
            req.body[`certificationTypes[${index}][validityPeriod]`];
          const certRequirements =
            cert.requirements ||
            req.body[`certificationTypes[${index}][requirements]`];

          if (certName) {
            certificationTypesArray.push({
              name: certName,
              description: certDescription,
              validityPeriod: certValidityPeriod
                ? parseInt(certValidityPeriod)
                : undefined,
              requirements: certRequirements
                ? certRequirements
                    .split(",")
                    .map((r) => r.trim())
                    .filter((r) => r)
                : [],
            });
          }
        }
      });
    }

    // Alternative approach for certification types if the above doesn't work
    // This handles the flat structure that FormData might create
    const certTypesFromFlat = {};
    Object.keys(req.body).forEach((key) => {
      const match = key.match(/^certificationTypes\[(\d+)\]\[(\w+)\]$/);
      if (match) {
        const index = match[1];
        const field = match[2];
        if (!certTypesFromFlat[index]) {
          certTypesFromFlat[index] = {};
        }
        certTypesFromFlat[index][field] = req.body[key];
      }
    });

    // If we found flat structure, use it instead
    if (
      Object.keys(certTypesFromFlat).length > 0 &&
      certificationTypesArray.length === 0
    ) {
      Object.values(certTypesFromFlat).forEach((cert) => {
        if (cert.name) {
          certificationTypesArray.push({
            name: cert.name,
            description: cert.description || "",
            validityPeriod: cert.validityPeriod
              ? parseInt(cert.validityPeriod)
              : undefined,
            requirements: cert.requirements
              ? cert.requirements
                  .split(",")
                  .map((r) => r.trim())
                  .filter((r) => r)
              : [],
          });
        }
      });
    }

    // Process contact persons (dynamic array)
    const contactPersonsArray = [];
    if (req.body.contactPersons) {
      let contacts = req.body.contactPersons;
      if (!Array.isArray(contacts)) {
        contacts = [contacts];
      }

      contacts.forEach((contact, index) => {
        const contactName =
          contact.name || req.body[`contactPersons[${index}][name]`];
        const contactPosition =
          contact.position ||
          req.body[`contactPersons[${index}][position]`] ||
          "";
        const contactEmail =
          contact.email || req.body[`contactPersons[${index}][email]`] || "";
        const contactPhone =
          contact.phone || req.body[`contactPersons[${index}][phone]`] || "";
        const contactDepartment =
          contact.department ||
          req.body[`contactPersons[${index}][department]`] ||
          "";

        if (contactName || contactEmail) {
          contactPersonsArray.push({
            name: contactName || "",
            position: contactPosition,
            email: contactEmail,
            phone: contactPhone,
            department: contactDepartment,
          });
        }
      });
    }

    // Alternative approach for contact persons from flat structure
    const contactsFromFlat = {};
    Object.keys(req.body).forEach((key) => {
      const match = key.match(/^contactPersons\[(\d+)\]\[(\w+)\]$/);
      if (match) {
        const index = match[1];
        const field = match[2];
        if (!contactsFromFlat[index]) {
          contactsFromFlat[index] = {};
        }
        contactsFromFlat[index][field] = req.body[key];
      }
    });

    if (
      Object.keys(contactsFromFlat).length > 0 &&
      contactPersonsArray.length === 0
    ) {
      Object.values(contactsFromFlat).forEach((contact) => {
        if (contact.name || contact.email) {
          contactPersonsArray.push({
            name: contact.name || "",
            position: contact.position || "",
            email: contact.email || "",
            phone: contact.phone || "",
            department: contact.department || "",
          });
        }
      });
    }

    // Process licenses (dynamic array)
    const licensesArray = [];
    if (req.body.licenses) {
      let licenses = req.body.licenses;
      if (!Array.isArray(licenses)) {
        licenses = [licenses];
      }

      licenses.forEach((license, index) => {
        const licenseType =
          license.type || req.body[`licenses[${index}][type]`];
        const licenseNumber =
          license.number || req.body[`licenses[${index}][number]`] || "";
        const issuingAuthority =
          license.issuingAuthority ||
          req.body[`licenses[${index}][issuingAuthority]`] ||
          "";
        const issueDate =
          license.issueDate || req.body[`licenses[${index}][issueDate]`];
        const expiryDate =
          license.expiryDate || req.body[`licenses[${index}][expiryDate]`];

        if (licenseType || licenseNumber) {
          licensesArray.push({
            type: licenseType || "",
            number: licenseNumber,
            issuingAuthority: issuingAuthority,
            issueDate: issueDate ? new Date(issueDate) : undefined,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
          });
        }
      });
    }

    // Alternative approach for licenses from flat structure
    const licensesFromFlat = {};
    Object.keys(req.body).forEach((key) => {
      const match = key.match(/^licenses\[(\d+)\]\[(\w+)\]$/);
      if (match) {
        const index = match[1];
        const field = match[2];
        if (!licensesFromFlat[index]) {
          licensesFromFlat[index] = {};
        }
        licensesFromFlat[index][field] = req.body[key];
      }
    });

    if (
      Object.keys(licensesFromFlat).length > 0 &&
      licensesArray.length === 0
    ) {
      Object.values(licensesFromFlat).forEach((license) => {
        if (license.type || license.number) {
          licensesArray.push({
            type: license.type || "",
            number: license.number || "",
            issuingAuthority: license.issuingAuthority || "",
            issueDate: license.issueDate
              ? new Date(license.issueDate)
              : undefined,
            expiryDate: license.expiryDate
              ? new Date(license.expiryDate)
              : undefined,
          });
        }
      });
    }

    // Create certification body data object with ALL fields
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
        zipCode,
      },
      specializations: specializationsArray,
      accreditation: accreditationArray,
      recognizedBy: recognizedByArray,
      certificationTypes: certificationTypesArray,
      contactPersons: contactPersonsArray,
      licenses: licensesArray,
      membershipLevel: membershipLevel || "Standard",
      isActive: isActive === "true" || isActive === true,
      isPreferred: isPreferred === "true" || isPreferred === true,
      notes,
      createdBy: req.user.email,
    };

    // Add Cloudinary logo URL if uploaded
    if (req.file && req.file.path) {
      certificationBodyData.logo = req.file.path; // Cloudinary URL
      certificationBodyData.cloudinaryPublicId = req.file.public_id; // Store for future deletion
      console.log("📸 Logo uploaded to Cloudinary:", req.file.path);
    }

    // Debug logging to see what data is being saved
    console.log("🔍 Certification Body Data to be saved:");
    console.log("Basic Info:", {
      companyName: certificationBodyData.companyName,
      email: certificationBodyData.email,
      membershipLevel: certificationBodyData.membershipLevel,
    });
    console.log("Specializations:", certificationBodyData.specializations);
    console.log("Accreditation:", certificationBodyData.accreditation);
    console.log("Recognized By:", certificationBodyData.recognizedBy);
    console.log(
      "Certification Types:",
      certificationBodyData.certificationTypes
    );
    console.log("Contact Persons:", certificationBodyData.contactPersons);
    console.log("Licenses:", certificationBodyData.licenses);

    const newCertificationBody = new CertificationBody(certificationBodyData);
    await newCertificationBody.save();

    console.log(
      "✅ Certification body created successfully with ID:",
      newCertificationBody._id
    );

    res.json({
      success: true,
      message: "Certification body created successfully",
      certificationBody: {
        _id: newCertificationBody._id,
        companyName: newCertificationBody.companyName,
        displayName: newCertificationBody.displayName,
        logo: newCertificationBody.logo,
      },
    });
  } catch (error) {
    console.error("❌ Error creating certification body:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create certification body",
    });
  }
};

// Update certification body - UPDATED WITH CLOUDINARY
exports.updateCertificationBody = async (req, res) => {
  try {
    const certificationBodyId = req.params.id;
    const certificationBody = await CertificationBody.findById(
      certificationBodyId
    );

    if (!certificationBody) {
      return res.status(404).json({
        success: false,
        message: "Certification body not found",
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
      notes,
    } = req.body;

    // Check if another certification body has the same name
    if (companyName !== certificationBody.companyName) {
      const existingBody = await CertificationBody.findOne({
        companyName: companyName,
        _id: { $ne: certificationBodyId },
        isDeleted: false,
      });

      if (existingBody) {
        return res.status(400).json({
          success: false,
          message: "Another certification body with this name already exists",
        });
      }
    }

    // Process arrays
    const specializationsArray = specializations
      ? specializations
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item)
      : [];

    const accreditationArray = accreditation
      ? accreditation
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item)
      : [];

    // Update fields
    certificationBody.companyName = companyName;
    certificationBody.shortName = shortName;
    certificationBody.registrationNumber = registrationNumber;
    certificationBody.email = email;
    certificationBody.phone = phone;
    certificationBody.website = website;
    certificationBody.description = description;
    certificationBody.establishedYear = establishedYear
      ? parseInt(establishedYear)
      : undefined;
    certificationBody.address = {
      street,
      city,
      state,
      country,
      zipCode,
    };
    certificationBody.specializations = specializationsArray;
    certificationBody.accreditation = accreditationArray;
    certificationBody.membershipLevel = membershipLevel || "Standard";
    certificationBody.isActive = isActive === "true" || isActive === true;
    certificationBody.isPreferred =
      isPreferred === "true" || isPreferred === true;
    certificationBody.notes = notes;
    certificationBody.lastModifiedBy = req.user.email;

    // Handle logo update with Cloudinary
    if (req.file && req.file.path) {
      // Delete old logo from Cloudinary if it exists
      if (certificationBody.logo && certificationBody.cloudinaryPublicId) {
        try {
          const result = await cloudinary.uploader.destroy(
            certificationBody.cloudinaryPublicId
          );
          if (result.result !== "ok") {
            console.warn(
              "Warning: Could not delete old logo from Cloudinary:",
              result
            );
          }
        } catch (error) {
          console.error("Error deleting old logo from Cloudinary:", error);
          // Continue with upload despite deletion error
        }
      }

      certificationBody.logo = req.file.path; // Cloudinary URL
      certificationBody.cloudinaryPublicId = req.file.public_id; // Store for future deletion
      console.log("📸 New logo uploaded to Cloudinary:", req.file.path);
    }

    await certificationBody.save();

    res.json({
      success: true,
      message: "Certification body updated successfully",
    });
  } catch (error) {
    console.error("Error updating certification body:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update certification body",
    });
  }
};

// Delete certification body (soft delete) - UPDATED TO HANDLE CLOUDINARY
exports.deleteCertificationBody = async (req, res) => {
  try {
    const certificationBodyId = req.params.id;

    const certificationBody = await CertificationBody.findById(
      certificationBodyId
    );
    if (!certificationBody) {
      return res.status(404).json({
        success: false,
        message: "Certification body not found",
      });
    }

    // Delete logo from Cloudinary if it exists
    if (certificationBody.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(certificationBody.cloudinaryPublicId);
        console.log("🗑️ Deleted logo from Cloudinary during deletion");
      } catch (error) {
        console.error("Error deleting logo from Cloudinary:", error);
      }
    }

    // Soft delete
    certificationBody.isDeleted = true;
    certificationBody.lastModifiedBy = req.user.email;
    await certificationBody.save();

    res.json({
      success: true,
      message: "Certification body deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting certification body:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete certification body",
    });
  }
};

// Serve logo image - REMOVED (not needed with Cloudinary)
exports.serveLogo = async (req, res) => {
  try {
    const certificationBody = await CertificationBody.findById(req.params.id);

    if (!certificationBody || !certificationBody.logo) {
      return res.status(404).send("Logo not found");
    }

    // Redirect to Cloudinary URL
    res.redirect(certificationBody.logo);
  } catch (error) {
    console.error("Error serving logo:", error);
    res.status(500).send("Error serving logo");
  }
};

// Search certification bodies
exports.searchCertificationBodies = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.json({
        success: true,
        certificationBodies: [],
      });
    }

    const certificationBodies = await CertificationBody.searchBodies(q);

    const formattedBodies = certificationBodies.map((body) => ({
      _id: body._id,
      companyName: body.companyName,
      shortName: body.shortName,
      displayName: body.displayName,
      specializations: body.specializations,
      membershipLevel: body.membershipLevel,
      logo: body.logo || null,
    }));

    res.json({
      success: true,
      certificationBodies: formattedBodies,
    });
  } catch (error) {
    console.error("Error searching certification bodies:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search certification bodies",
    });
  }
};
