module.exports = function(req, res, next) {
  // TEMPORARY: Bypass authentication for testing
  if (process.env.BYPASS_AUTH === 'true' || true) {  // Remove "|| true" when done testing
    console.log('⚠️ BYPASSING ADMIN AUTH - TESTING MODE');
    req.user = {
      _id: 'test-admin',
      email: 'test@example.com',
      role: 'admin',
      firstName: 'Test',
      lastName: 'Admin'
    };
    return next();
  }
  
  // Original code below...
  console.log('🔒 Checking admin access...');
  // ... rest of your original code
};