const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./models/user');

// Passport configuration for local login strategy
passport.use(new LocalStrategy(
  { usernameField: 'email', passwordField: 'password' },
  (email, password, done) => {
    User.findOne({ email: email }, (err, user) => {
      if (err) return done(err);
      if (!user) return done(null, false, { message: 'Invalid credentials' });

      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return done(err);
        if (!isMatch) return done(null, false, { message: 'Invalid credentials' });

        return done(null, user);  // Successfully authenticated
      });
    });
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);  // Store user ID in the session
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);  // Retrieve the user from the database by ID
  });
});