// config/passportConfig.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/user');

// Local Strategy for email/password authentication
passport.use(new LocalStrategy({
  usernameField: 'email', // Use email as username
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    // Find user by email (now using flat structure)
    const user = await User.findOne({ email: email });
    
    if (!user) {
      return done(null, false, { message: 'No user found with that email' });
    }

    // Check if account is confirmed
    if (!user.isConfirmed) {
      return done(null, false, { message: 'Account not confirmed yet' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (isMatch) {
      return done(null, user);
    } else {
      return done(null, false, { message: 'Incorrect password' });
    }
  } catch (error) {
    return done(error);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;