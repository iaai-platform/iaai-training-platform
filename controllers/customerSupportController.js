// controllers/customerSupportController.js

// ✅ 1. HELP CENTER
exports.getHelpCenter = async (req, res) => {
    try {
      console.log('📚 Loading help center...');
      
      res.render('support/help-center', {
        user: req.user || null,
        title: 'Help Center'
      });
    } catch (err) {
      console.error('❌ Error loading help center:', err);
      res.status(500).send('Server error');
    }
  };
  
  // ✅ 2. CONTACT SUPPORT
  exports.getContactPage = async (req, res) => {
    try {
      console.log('📞 Loading contact support page...');
      
      res.render('support/contact', {
        user: req.user || null,
        title: 'Contact Support'
      });
    } catch (err) {
      console.error('❌ Error loading contact page:', err);
      res.status(500).send('Server error');
    }
  };
  
  exports.submitContactForm = async (req, res) => {
    try {
      const { name, email, subject, category, message } = req.body;
      
      console.log('📩 Contact form submitted:', { name, email, subject, category });
  
      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({
          success: false,
          message: 'Please fill in all required fields'
        });
      }
  
      // Generate ticket number
      const ticketNumber = `IAAI-${Date.now()}`;
  
      // Here you would typically:
      // 1. Save to database
      // 2. Send confirmation email
      // 3. Notify support team
  
      console.log('✅ Ticket created:', ticketNumber);
  
      res.json({
        success: true,
        message: `Thank you for contacting us! Your support ticket #${ticketNumber} has been created. We'll respond within 24 hours.`,
        ticketNumber
      });
    } catch (err) {
      console.error('❌ Error submitting contact form:', err);
      res.status(500).json({ success: false, message: 'Error submitting form' });
    }
  };
  
  // ✅ 3. SUPPORT TICKETS
  exports.getTicketsPage = async (req, res) => {
    try {
      console.log('🎫 Loading support tickets for user:', req.user.email);
      
      // Mock tickets data (replace with actual database query)
      const tickets = [
        {
          id: 'IAAI-123456',
          subject: 'Video not loading in course',
          status: 'Open',
          priority: 'Medium',
          created: new Date('2025-06-25'),
          lastReply: new Date('2025-06-26'),
          category: 'Technical',
          assignedAgent: 'Sarah Johnson'
        },
        {
          id: 'IAAI-123455',
          subject: 'Question about certification requirements',
          status: 'Resolved',
          priority: 'Low',
          created: new Date('2025-06-20'),
          lastReply: new Date('2025-06-21'),
          category: 'General',
          assignedAgent: 'Mike Davis'
        },
        {
          id: 'IAAI-123454',
          subject: 'Payment not processing',
          status: 'In Progress',
          priority: 'High',
          created: new Date('2025-06-28'),
          lastReply: new Date('2025-06-28'),
          category: 'Billing',
          assignedAgent: 'Lisa Chen'
        }
      ];
  
      res.render('support/tickets', {
        tickets,
        user: req.user,
        title: 'My Support Tickets'
      });
    } catch (err) {
      console.error('❌ Error loading tickets:', err);
      res.status(500).send('Server error');
    }
  };
  
  exports.getTicketDetails = async (req, res) => {
    try {
      const { id } = req.params;
      console.log('🎫 Loading ticket details:', id);
      
      // Mock ticket details (replace with actual database query)
      const ticket = {
        id: id,
        subject: 'Video not loading in course',
        status: 'Open',
        priority: 'Medium',
        created: new Date('2025-06-25'),
        category: 'Technical',
        assignedAgent: 'Sarah Johnson',
        messages: [
          {
            from: 'user',
            fromName: req.user.firstName + ' ' + req.user.lastName,
            message: 'Hi, I\'m having trouble loading videos in my course "Botox Fundamentals 101". The player shows a loading icon but never starts.',
            timestamp: new Date('2025-06-25T10:00:00'),
            attachments: []
          },
          {
            from: 'support',
            fromName: 'Sarah Johnson',
            message: 'Thank you for contacting us. Can you please try clearing your browser cache and let me know which browser you\'re using?',
            timestamp: new Date('2025-06-26T09:30:00'),
            attachments: []
          }
        ]
      };
  
      res.render('support/ticket-details', {
        ticket,
        user: req.user,
        title: `Ticket ${id}`
      });
    } catch (err) {
      console.error('❌ Error loading ticket details:', err);
      res.status(500).send('Server error');
    }
  };
  
  // ✅ 4. COMMUNITY FORUM
  exports.getCommunityPage = async (req, res) => {
    try {
      console.log('👥 Loading community forum...');
      
      // Mock community data
      const topics = [
        {
          id: '1',
          title: 'Best practices for Botox injections',
          author: 'Dr. Smith',
          replies: 23,
          views: 456,
          lastActivity: new Date('2025-06-27'),
          category: 'Injectables'
        },
        {
          id: '2',
          title: 'Setting up your first aesthetic practice',
          author: 'PracticeOwner22',
          replies: 15,
          views: 234,
          lastActivity: new Date('2025-06-26'),
          category: 'Business'
        },
        {
          id: '3',
          title: 'New laser technology discussion',
          author: 'TechExpert',
          replies: 8,
          views: 167,
          lastActivity: new Date('2025-06-28'),
          category: 'Technology'
        },
        {
          id: '4',
          title: 'Course completion certificate question',
          author: 'StudentUser',
          replies: 3,
          views: 45,
          lastActivity: new Date('2025-06-27'),
          category: 'Student Support'
        }
      ];
  
      const categories = [
        { name: 'Injectables', count: 45, description: 'Botox, fillers, and injection techniques' },
        { name: 'Business & Practice', count: 32, description: 'Practice management and business growth' },
        { name: 'Technology & Equipment', count: 18, description: 'Latest equipment and technology discussions' },
        { name: 'Student Support', count: 67, description: 'Help and support for current students' }
      ];
  
      res.render('support/community', {
        topics,
        categories,
        user: req.user || null,
        title: 'Community Forum'
      });
    } catch (err) {
      console.error('❌ Error loading community:', err);
      res.status(500).send('Server error');
    }
  };
  
  // ✅ 5. FEEDBACK
  exports.getFeedbackPage = async (req, res) => {
    try {
      console.log('⭐ Loading feedback page for user:', req.user.email);
      
      res.render('support/feedback', {
        user: req.user,
        title: 'Feedback & Suggestions'
      });
    } catch (err) {
      console.error('❌ Error loading feedback page:', err);
      res.status(500).send('Server error');
    }
  };
  
  exports.submitCourseFeedback = async (req, res) => {
    try {
      const { courseId, rating, review, recommend } = req.body;
      
      console.log('⭐ Course feedback submitted for course:', courseId);
  
      // Validate input
      if (!courseId || !rating || !review) {
        return res.status(400).json({
          success: false,
          message: 'Please fill in all required fields'
        });
      }
  
      // Here you would save feedback to database
      const feedback = {
        type: 'course',
        courseId,
        rating: parseInt(rating),
        review,
        recommend: recommend === 'true',
        userId: req.user._id,
        userEmail: req.user.email,
        submitted: new Date()
      };
  
      console.log('💾 Course feedback saved:', feedback);
  
      res.json({
        success: true,
        message: 'Thank you for your feedback! It helps us improve our courses.'
      });
    } catch (err) {
      console.error('❌ Error submitting course feedback:', err);
      res.status(500).json({ success: false, message: 'Error submitting feedback' });
    }
  };
  
  exports.submitFeatureFeedback = async (req, res) => {
    try {
      const { featureTitle, description, priority } = req.body;
      
      console.log('💡 Feature request submitted:', featureTitle);
  
      // Validate input
      if (!featureTitle || !description || !priority) {
        return res.status(400).json({
          success: false,
          message: 'Please fill in all required fields'
        });
      }
  
      // Here you would save to database
      const featureRequest = {
        type: 'feature',
        title: featureTitle,
        description,
        priority,
        userId: req.user._id,
        userEmail: req.user.email,
        status: 'submitted',
        submitted: new Date()
      };
  
      console.log('💾 Feature request saved:', featureRequest);
  
      res.json({
        success: true,
        message: 'Thank you for your suggestion! We\'ll review it for future updates.'
      });
    } catch (err) {
      console.error('❌ Error submitting feature request:', err);
      res.status(500).json({ success: false, message: 'Error submitting request' });
    }
  };
  
  // ✅ 6. LIVE CHAT
  exports.getChatPage = async (req, res) => {
    try {
      console.log('💬 Loading live chat for user:', req.user.email);
      
      res.render('support/live-chat', {
        user: req.user,
        title: 'Live Chat Support'
      });
    } catch (err) {
      console.error('❌ Error loading chat page:', err);
      res.status(500).send('Server error');
    }
  };
  
  exports.startChat = async (req, res) => {
    try {
      const { message, name, email } = req.body;
      
      console.log('💬 Starting chat session for user:', req.user.email);
  
      // Validate input
      if (!name || !email || !message) {
        return res.status(400).json({
          success: false,
          message: 'Please fill in all required fields'
        });
      }
  
      // Here you would integrate with your chat system
      const chatSession = {
        sessionId: `chat-${Date.now()}`,
        status: 'connected',
        agent: 'Sarah from IAAI Support',
        startTime: new Date(),
        initialMessage: message,
        userName: name,
        userEmail: email
      };
  
      console.log('🔗 Chat session created:', chatSession);
  
      res.json({
        success: true,
        chatSession,
        message: 'Connected to support chat! An agent will be with you shortly.'
      });
    } catch (err) {
      console.error('❌ Error starting chat:', err);
      res.status(500).json({ success: false, message: 'Error starting chat' });
    }
  };