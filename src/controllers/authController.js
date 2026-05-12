const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const Joi = require("joi");
const path = require("path");
const fs = require("fs");
const { sendOTPEmail } = require("../services/emailService");

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    const [users] = await pool.execute(
      "SELECT id, email, password, name, role FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 */
const getMe = async (req, res) => {
  try {
    const [users] = await pool.execute(
      "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
const updateProfile = async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, email } = value;

    // Check if email is already taken by another user
    const [existingUsers] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, req.user.id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Update user
    await pool.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", [
      name,
      email,
      req.user.id,
    ]);

    const [users] = await pool.execute(
      "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    res.json({ user: users[0], message: "Profile updated successfully" });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
const changePassword = async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;

    // Get current user with password
    const [users] = await pool.execute(
      "SELECT id, password FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.execute("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      req.user.id,
    ]);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send OTP to email for password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid email
 *       404:
 *         description: Email not found
 *       500:
 *         description: Failed to send OTP
 */
const forgotPassword = async (req, res) => {
  try {
    const forgotPasswordSchema = Joi.object({
      email: Joi.string().email().required(),
    });

    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email } = value;

    // Check if user exists
    const [users] = await pool.execute(
      "SELECT id, email, name FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        message: "If the email exists, an OTP has been sent",
        success: true,
      });
    }

    const user = users[0];

    // Generate 6-digit OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Purge expired records to prevent unbounded table growth
    await pool.execute(
      "DELETE FROM password_reset_otps WHERE expires_at < NOW()",
      []
    );

    // Invalidate any existing OTPs for this email
    await pool.execute(
      "UPDATE password_reset_otps SET verified = TRUE WHERE email = ? AND verified = FALSE",
      [email]
    );

    // Store OTP in database
    await pool.execute(
      "INSERT INTO password_reset_otps (email, otp, expires_at, attempts, max_attempts, verified) VALUES (?, ?, ?, 0, 5, FALSE)",
      [email, otp, expiresAt]
    );

    // Send OTP via email
    try {
      await sendOTPEmail(user.email, user.name, otp);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // Delete the OTP record if email fails
      await pool.execute(
        "DELETE FROM password_reset_otps WHERE email = ? AND otp = ?",
        [email, otp]
      );
      return res.status(500).json({ error: "Failed to send OTP" });
    }

    res.json({
      message: "OTP sent successfully",
      success: true,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid or expired OTP
 */
const verifyOTP = async (req, res) => {
  try {
    const verifyOTPSchema = Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).pattern(/^\d+$/).required(),
    });

    const { error, value } = verifyOTPSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, otp } = value;

    // Find valid OTP
    const [otps] = await pool.execute(
      "SELECT id, email, otp, attempts, max_attempts, expires_at, verified FROM password_reset_otps WHERE email = ? AND verified = FALSE ORDER BY created_at DESC LIMIT 1",
      [email]
    );

    if (otps.length === 0) {
      return res.status(401).json({ error: "Invalid OTP" });
    }

    let otpRecord = otps[0];

    // Check expiration - mysql2 returns TIMESTAMP columns as JS Date objects
    // when using the promise pool, so a direct comparison is safe.
    const expiresAt = otpRecord.expires_at instanceof Date
      ? otpRecord.expires_at
      : new Date(String(otpRecord.expires_at).replace(' ', 'T') + 'Z');
    const now = new Date();

    if (now.getTime() > expiresAt.getTime()) {
      await pool.execute(
        "UPDATE password_reset_otps SET verified = TRUE WHERE id = ?",
        [otpRecord.id]
      );
      return res.status(401).json({ error: "OTP expired" });
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await pool.execute(
        "UPDATE password_reset_otps SET verified = TRUE WHERE id = ?",
        [otpRecord.id]
      );
      return res
        .status(401)
        .json({ error: "Maximum attempts exceeded. Please request a new OTP" });
    }

    // Verify OTP - atomically increment attempts only when OTP is wrong,
    // and invalidate in the same statement if max is reached.
    if (otpRecord.otp !== otp) {
      // Single atomic UPDATE: increment attempts and invalidate if at limit
      await pool.execute(
        `UPDATE password_reset_otps
         SET attempts = attempts + 1,
             verified = IF(attempts + 1 >= max_attempts, TRUE, verified)
         WHERE id = ?`,
        [otpRecord.id]
      );

      // Refetch to get the authoritative post-increment state
      const [[updated]] = await pool.execute(
        "SELECT attempts, max_attempts FROM password_reset_otps WHERE id = ?",
        [otpRecord.id]
      );

      if (updated && updated.attempts >= updated.max_attempts) {
        return res.status(401).json({
          error: "Maximum attempts exceeded. Please request a new OTP",
        });
      }

      return res.status(401).json({ error: "Invalid OTP" });
    }

    // Generate temporary verification token (optional, for additional security)
    const verificationToken = jwt.sign(
      { email, otpId: otpRecord.id, type: "password_reset" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Mark OTP as verified (but don't delete yet, will be used in reset-password)
    await pool.execute(
      "UPDATE password_reset_otps SET verified = TRUE WHERE id = ?",
      [otpRecord.id]
    );

    res.json({
      message: "OTP verified successfully",
      success: true,
      token: verificationToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP or verification token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *                 description: OTP code (required if token not provided)
 *               token:
 *                 type: string
 *                 description: Verification token from verify-otp endpoint (required if otp not provided)
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Invalid or expired OTP/token
 */
const resetPassword = async (req, res) => {
  try {
    const resetPasswordSchema = Joi.object({
      email: Joi.string().email().required(),
      otp: Joi.string().length(6).pattern(/^\d+$/).optional(),
      token: Joi.string().optional(),
      newPassword: Joi.string().min(6).required(),
    }).xor("otp", "token"); // Exactly one of otp or token must be provided

    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, otp, token, newPassword } = value;

    let otpRecord = null;
    let otpId = null;

    // Method 1: Use verification token (preferred, more secure)
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET
        );

        // Verify token is for password reset
        if (decoded.type !== "password_reset") {
          return res.status(401).json({ error: "Invalid token type" });
        }

        // Verify email matches
        if (decoded.email !== email) {
          return res.status(401).json({ error: "Token email mismatch" });
        }

        otpId = decoded.otpId;

        // Find the OTP record by ID
        const [otps] = await pool.execute(
          "SELECT id, email, otp, expires_at, verified, attempts, max_attempts FROM password_reset_otps WHERE id = ? AND email = ?",
          [otpId, email]
        );

        if (otps.length === 0) {
          return res
            .status(401)
            .json({ error: "Invalid token - OTP not found" });
        }

        otpRecord = otps[0];

        // For token-based reset, OTP should be verified
        if (!otpRecord.verified) {
          return res
            .status(401)
            .json({ error: "OTP not verified. Please verify OTP first" });
        }
      } catch (tokenError) {
        if (tokenError.name === "JsonWebTokenError") {
          return res.status(401).json({ error: "Invalid token" });
        }
        if (tokenError.name === "TokenExpiredError") {
          return res.status(401).json({ error: "Token expired" });
        }
        throw tokenError;
      }
    }
    // Method 2: Use OTP directly (fallback)
    else if (otp) {
      // Find the OTP record (check both verified and unverified)
      const [otps] = await pool.execute(
        "SELECT id, email, otp, expires_at, verified, attempts, max_attempts FROM password_reset_otps WHERE email = ? AND otp = ? ORDER BY created_at DESC LIMIT 1",
        [email, otp]
      );

      if (otps.length === 0) {
        return res.status(401).json({ error: "Invalid OTP" });
      }

      otpRecord = otps[0];

      // Check if max attempts exceeded (only for unverified OTPs)
      if (!otpRecord.verified && otpRecord.attempts >= otpRecord.max_attempts) {
        return res.status(401).json({
          error: "Maximum attempts exceeded. Please request a new OTP",
        });
      }

      // Verify the OTP matches
      if (otpRecord.otp !== otp) {
        // Increment attempts for unverified OTPs
        if (!otpRecord.verified) {
          await pool.execute(
            "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?",
            [otpRecord.id]
          );
        }
        return res.status(401).json({ error: "Invalid OTP" });
      }
    } else {
      return res
        .status(400)
        .json({ error: "Either OTP or token must be provided" });
    }

    // Check if OTP has expired
    // For token-based reset, token expiration is checked by JWT, but we still verify OTP hasn't expired
    const expiresAt = new Date(otpRecord.expires_at);
    const now = new Date();

    const expirationBuffer = 30 * 1000; // 30-second clock-skew tolerance
    if (now.getTime() > expiresAt.getTime() + expirationBuffer) {
      // Delete expired OTP
      await pool.execute("DELETE FROM password_reset_otps WHERE id = ?", [
        otpRecord.id,
      ]);
      return res.status(401).json({ error: "OTP expired" });
    }

    // Check if user exists
    const [users] = await pool.execute("SELECT id FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await pool.execute("UPDATE users SET password = ? WHERE email = ?", [
      hashedPassword,
      email,
    ]);

    // Delete/invalidate the OTP
    await pool.execute("DELETE FROM password_reset_otps WHERE id = ?", [
      otpRecord.id,
    ]);

    res.json({
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Password reset failed" });
  }
};

/**
 * POST /api/auth/avatar
 * Upload or update the current user's profile picture.
 * Expects multipart/form-data with field name "avatar".
 * Returns the updated user object including the new avatar_url.
 */
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user.id;
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete previous avatar file if it exists
    const [existing] = await pool.execute(
      "SELECT avatar_url FROM users WHERE id = ?",
      [userId]
    );

    if (existing.length > 0 && existing[0].avatar_url) {
      const oldPath = path.join(
        __dirname,
        "..",
        "..",
        existing[0].avatar_url.replace(/^\//, "")
      );
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Persist new avatar path
    await pool.execute("UPDATE users SET avatar_url = ? WHERE id = ?", [
      avatarUrl,
      userId,
    ]);

    const [users] = await pool.execute(
      "SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = ?",
      [userId]
    );

    res.json({ user: users[0], message: "Avatar updated successfully" });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  login,
  getMe,
  updateProfile,
  changePassword,
  uploadAvatar,
  forgotPassword,
  verifyOTP,
  resetPassword,
};
