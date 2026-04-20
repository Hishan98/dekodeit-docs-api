const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const {
  forgotPasswordLimiter,
  verifyOTPLimiter,
  resetPasswordLimiter,
} = require('../middleware/rateLimiter');

// ── Multer config for avatar uploads ────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads', 'avatars'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    // user-{id}-{timestamp}{ext}  →  unique, deterministic per user
    cb(null, `user-${req.user.id}-${Date.now()}${ext}`);
  },
});

const avatarFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'), false);
  }
};

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: avatarFilter,
});

// ── Routes ───────────────────────────────────────────────────────────────────
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/change-password', authenticate, authController.changePassword);

// Profile picture upload
router.post(
  '/avatar',
  authenticate,
  uploadAvatar.single('avatar'),
  authController.uploadAvatar
);

// Forgot password flow endpoints
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/verify-otp', verifyOTPLimiter, authController.verifyOTP);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);

module.exports = router;

