// middlewares/isAuthenticated.js
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
      return next(); // Proceed if user is authenticated
  }
  
  // Check if this is an AJAX request
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      // For AJAX requests, send JSON response
      return res.status(401).json({ 
          success: false, 
          message: 'Please log in to proceed' 
      });
  } else {
      // For regular page requests, redirect to login
      req.flash('error_message', 'Please log in to access this page');
      return res.redirect('/login');
  }
}

module.exports = isAuthenticated;