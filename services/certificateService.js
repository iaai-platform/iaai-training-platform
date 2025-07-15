// services/certificateService.js - Professional Certificate Management System
const crypto = require('crypto');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class CertificateService {
  constructor() {
    this.certificateTemplates = {
      professional_v1: {
        name: 'Professional Certificate',
        width: 842, // A4 landscape
        height: 595,
        colors: {
          primary: '#1a365d',
          secondary: '#3182ce',
          accent: '#ed8936',
          text: '#2d3748',
          light: '#f7fafc'
        }
      },
      modern_v1: {
        name: 'Modern Design',
        width: 842,
        height: 595,
        colors: {
          primary: '#2d3748',
          secondary: '#4299e1',
          accent: '#38b2ac',
          text: '#1a202c',
          light: '#edf2f7'
        }
      },
      elegant_v1: {
        name: 'Elegant Style',
        width: 842,
        height: 595,
        colors: {
          primary: '#553c9a',
          secondary: '#9f7aea',
          accent: '#d69e2e',
          text: '#2d3748',
          light: '#faf5ff'
        }
      }
    };
  }

  /**
   * Generate a unique certificate ID
   */
  generateCertificateId() {
    const timestamp = Date.now().toString(36);
    const randomStr = crypto.randomBytes(8).toString('hex');
    return `CERT-${timestamp}-${randomStr}`.toUpperCase();
  }

  /**
   * Generate a verification code
   */
  generateVerificationCode() {
    return crypto.randomBytes(16).toString('hex').toUpperCase();
  }

  /**
   * Generate digital signature for certificate authenticity
   */
  generateDigitalSignature(certificateData) {
    const dataString = JSON.stringify({
      certificateId: certificateData.certificateId,
      recipientName: certificateData.recipientName,
      courseTitle: certificateData.title,
      completionDate: certificateData.completionDate,
      verificationCode: certificateData.verificationCode
    });
    
    return crypto
      .createHmac('sha256', process.env.CERTIFICATE_SECRET || 'default-secret')
      .update(dataString)
      .digest('hex');
  }

  /**
   * Calculate achievement level based on certificates and performance
   */
  calculateAchievementLevel(certificates, totalLearningHours) {
    const activeCerts = certificates.filter(c => c.certificateStatus.status === 'active').length;
    const avgScore = certificates.reduce((sum, cert) => 
      sum + (cert.certificateDetails.courseStats.averageScore || 0), 0) / certificates.length || 0;

    if (activeCerts >= 10 && avgScore >= 95 && totalLearningHours >= 500) return 'Master';
    if (activeCerts >= 7 && avgScore >= 90 && totalLearningHours >= 300) return 'Expert';
    if (activeCerts >= 5 && avgScore >= 85 && totalLearningHours >= 200) return 'Advanced';
    if (activeCerts >= 3 && avgScore >= 80 && totalLearningHours >= 100) return 'Intermediate';
    return 'Beginner';
  }

  /**
   * Create certificate data structure
   */
  async createCertificateData(user, course, courseStats, courseType = 'SelfPacedOnlineTraining') {
    const certificateId = this.generateCertificateId();
    const verificationCode = this.generateVerificationCode();
    const completionDate = new Date();
    
    // Calculate completion duration
    const startDate = courseStats.startDate || new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // Default to 7 days ago
    const completionDuration = Math.ceil((completionDate - startDate) / (1000 * 60 * 60 * 24));

    const certificateData = {
      certificateId,
      courseId: course._id,
      courseType,
      certificateDetails: {
        title: course.title,
        courseCode: course.courseCode,
        recipientName: `${user.firstName} ${user.lastName}`,
        instructorName: course.instructor || 'IAAI Training Institute',
        institutionName: 'IAAI Training Institute',
        completionDate,
        issueDate: new Date(),
        expiryDate: null, // No expiry for most certificates
        courseStats: {
          ...courseStats,
          startDate,
          completionDuration
        },
        verificationCode,
        digitalSignature: '', // Will be set after creation
        certificateDesign: {
          templateId: 'professional_v1',
          backgroundColor: '#1a365d',
          accentColor: '#3182ce',
          logoUrl: '/assets/images/iaai-logo.png',
          backgroundPattern: 'geometric'
        }
      },
      certificateStatus: {
        status: 'active',
        downloadCount: 0,
        sharedCount: 0,
        publiclyVisible: false,
        linkedInShared: false
      },
      certificateFiles: {
        pdfUrl: '',
        imageUrl: '',
        digitalBadgeUrl: '',
        qrCodeUrl: ''
      },
      metadata: {
        ipAddress: '', // Will be set by controller
        userAgent: '', // Will be set by controller
        location: user.country || 'Unknown',
        deviceInfo: 'Web Application'
      },
      socialSharing: {
        shareableUrl: `${process.env.BASE_URL || 'https://iaai-training.com'}/verify-certificate/${verificationCode}`
      }
    };

    // Generate digital signature
    certificateData.certificateDetails.digitalSignature = this.generateDigitalSignature(certificateData.certificateDetails);

    return certificateData;
  }

  /**
   * Generate QR Code for certificate verification
   */
  async generateQRCode(verificationCode) {
    const verificationUrl = `${process.env.BASE_URL || 'https://iaai-training.com'}/verify-certificate/${verificationCode}`;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#1a365d',
          light: '#ffffff'
        }
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  }

  /**
   * Generate Professional PDF Certificate
   */
  async generatePDFCertificate(certificateData, outputPath) {
    const template = this.certificateTemplates[certificateData.certificateDetails.certificateDesign.templateId];
    const doc = new PDFDocument({
      size: [template.width, template.height],
      margin: 0
    });

    // Create write stream
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    try {
      // Background
      doc.rect(0, 0, template.width, template.height)
         .fill(template.colors.light);

      // Header background with gradient effect
      doc.rect(0, 0, template.width, 150)
         .fill(template.colors.primary);

      // Decorative border
      doc.rect(30, 30, template.width - 60, template.height - 60)
         .stroke(template.colors.secondary)
         .lineWidth(3);

      // Inner decorative border
      doc.rect(50, 50, template.width - 100, template.height - 100)
         .stroke(template.colors.accent)
         .lineWidth(1);

      // Institution name
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fill(template.colors.light)
         .text('IAAI TRAINING INSTITUTE', 0, 70, {
           align: 'center',
           width: template.width
         });

      // Certificate title
      doc.fontSize(36)
         .font('Helvetica-Bold')
         .fill(template.colors.primary)
         .text('CERTIFICATE OF COMPLETION', 0, 180, {
           align: 'center',
           width: template.width
         });

      // Decorative line
      doc.moveTo(template.width * 0.25, 230)
         .lineTo(template.width * 0.75, 230)
         .stroke(template.colors.accent)
         .lineWidth(2);

      // This certifies that text
      doc.fontSize(16)
         .font('Helvetica')
         .fill(template.colors.text)
         .text('This is to certify that', 0, 260, {
           align: 'center',
           width: template.width
         });

      // Recipient name
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fill(template.colors.primary)
         .text(certificateData.certificateDetails.recipientName.toUpperCase(), 0, 290, {
           align: 'center',
           width: template.width
         });

      // Course completion text
      doc.fontSize(16)
         .font('Helvetica')
         .fill(template.colors.text)
         .text('has successfully completed the course', 0, 340, {
           align: 'center',
           width: template.width
         });

      // Course title
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fill(template.colors.secondary)
         .text(certificateData.certificateDetails.title, 0, 370, {
           align: 'center',
           width: template.width
         });

      // Course code
      doc.fontSize(14)
         .font('Helvetica')
         .fill(template.colors.text)
         .text(`Course Code: ${certificateData.certificateDetails.courseCode}`, 0, 410, {
           align: 'center',
           width: template.width
         });

      // Statistics section
      const stats = certificateData.certificateDetails.courseStats;
      const statsY = 450;
      
      doc.fontSize(12)
         .font('Helvetica')
         .fill(template.colors.text)
         .text(`Videos Completed: ${stats.completedVideos}/${stats.totalVideos}`, 100, statsY)
         .text(`Exams Passed: ${stats.completedExams}/${stats.totalExams}`, 300, statsY)
         .text(`Average Score: ${stats.averageScore || 0}%`, 500, statsY);

      // Date and verification info
      const completionDate = new Date(certificateData.certificateDetails.completionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.fontSize(14)
         .font('Helvetica')
         .fill(template.colors.text)
         .text(`Completion Date: ${completionDate}`, 100, 500)
         .text(`Certificate ID: ${certificateData.certificateId}`, 100, 520)
         .text(`Verification Code: ${certificateData.certificateDetails.verificationCode}`, 400, 520);

      // QR Code for verification (if available)
      if (certificateData.qrCodeData) {
        // In a real implementation, you'd embed the QR code image here
        doc.fontSize(10)
           .text('Scan QR code to verify', template.width - 150, 480);
      }

      // Footer
      doc.fontSize(10)
         .font('Helvetica')
         .fill(template.colors.text)
         .text('This certificate is digitally signed and verifiable online.', 0, template.height - 40, {
           align: 'center',
           width: template.width
         });

      // Instructor signature area
      doc.fontSize(12)
         .font('Helvetica')
         .fill(template.colors.text)
         .text('_________________________', 150, template.height - 100)
         .text(certificateData.certificateDetails.instructorName || 'Director', 150, template.height - 80)
         .text('IAAI Training Institute', 150, template.height - 65);

      // Seal/Logo area (placeholder)
      doc.circle(template.width - 150, template.height - 80, 40)
         .stroke(template.colors.primary)
         .lineWidth(2);
      
      doc.fontSize(8)
         .text('OFFICIAL', template.width - 170, template.height - 85)
         .text('SEAL', template.width - 160, template.height - 75);

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating PDF certificate:', error);
      throw error;
    }
  }

  /**
   * Verify certificate authenticity
   */
  verifyDigitalSignature(certificateData) {
    const expectedSignature = this.generateDigitalSignature(certificateData);
    return certificateData.digitalSignature === expectedSignature;
  }

  /**
   * Get certificate by verification code
   */
  async getCertificateByVerificationCode(verificationCode) {
    // This would be implemented in your controller
    // Return certificate data for public verification
    return null;
  }

  /**
   * Update achievement summary
   */
  updateAchievementSummary(user) {
    const certificates = user.myCertificates || [];
    const activeCertificates = certificates.filter(c => c.certificateStatus.status === 'active');
    
    const totalLearningHours = certificates.reduce((sum, cert) => 
      sum + (cert.certificateDetails.courseStats.timeSpent || 0), 0) / 60; // Convert minutes to hours

    const specializations = [...new Set(certificates.map(cert => 
      this.extractSpecialization(cert.certificateDetails.title)
    ))].filter(Boolean);

    const averageCompletionTime = certificates.reduce((sum, cert) => 
      sum + (cert.certificateDetails.courseStats.completionDuration || 0), 0) / certificates.length || 0;

    const achievementLevel = this.calculateAchievementLevel(certificates, totalLearningHours);

    return {
      totalCertificates: certificates.length,
      activeCertificates: activeCertificates.length,
      specializations,
      totalLearningHours: Math.round(totalLearningHours),
      averageCompletionTime: Math.round(averageCompletionTime),
      achievementLevel,
      publicProfileUrl: `${process.env.BASE_URL || 'https://iaai-training.com'}/profile/${user._id}`,
      digitalWallet: user.achievementSummary?.digitalWallet || {
        enabled: false,
        walletAddress: '',
        nftCertificates: []
      }
    };
  }

  /**
   * Extract specialization from course title
   */
  extractSpecialization(courseTitle) {
    const specializations = {
      'botox': 'Botox Administration',
      'filler': 'Dermal Fillers',
      'laser': 'Laser Therapy',
      'skincare': 'Advanced Skincare',
      'aesthetic': 'Aesthetic Medicine',
      'injectable': 'Injectable Treatments'
    };

    const title = courseTitle.toLowerCase();
    for (const [key, value] of Object.entries(specializations)) {
      if (title.includes(key)) return value;
    }
    return 'General Aesthetics';
  }
}

module.exports = new CertificateService();