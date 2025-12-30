const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const {
  forgotPasswordLimiter,
  verifyOTPLimiter,
  resetPasswordLimiter,
} = require('../middleware/rateLimiter');

router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);

// Forgot password flow endpoints
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/verify-otp', verifyOTPLimiter, authController.verifyOTP);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

module.exports = router;

