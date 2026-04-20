const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendOtp } = require('../services/otpService');
const { getDbState, isDbReady } = require('../config/db');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const logLoginAttempt = (type, details) => {
  console.log(`Login attempt: ${type}`, details);
};

const logLoginFailedReason = (type, reason, details = {}) => {
  console.error(`Login failed reason: ${type} - ${reason}`, details);
};

/**
 * POST /api/auth/request-otp
 * Request OTP for phone number login
 * Body: { name, phone }
 */
exports.requestOTP = async (req, res) => {
  try {
    const { name, phone } = req.body;

    logLoginAttempt('request-otp', { phone });

    if (!isDbReady()) {
      const db = getDbState();
      logLoginFailedReason('request-otp', 'database not ready', { dbState: db.state, phone });
      return res.status(503).json({
        status: 'error',
        message: 'Service is warming up. Please retry in a few seconds.',
        code: 'DB_NOT_READY',
      });
    }

    if (!name || !phone) {
      logLoginFailedReason('request-otp', 'missing name or phone', { phone });
      return res.status(400).json({
        status: 'fail',
        message: 'Name and phone number are required',
      });
    }

    // Validate phone format (10 digits)
    if (!/^[0-9]{10}$/.test(phone)) {
      logLoginFailedReason('request-otp', 'invalid phone format', { phone });
      return res.status(400).json({
        status: 'fail',
        message: 'Phone number must be exactly 10 digits',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user = await User.findOne({ phone });

    if (user) {
      // Update existing user
      user.name = name;
      user.otp = {
        code: otp,
        expiresAt,
      };
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        name,
        phone,
        role: 'customer',
        otp: {
          code: otp,
          expiresAt,
        },
      });
    }

    try {
      const result = await sendOtp({ phone, otp });

      res.status(200).json({
        status: 'success',
        message: 'OTP generated',
        ...(result.otp ? { otp: result.otp } : {}),
      });
      return;
    } catch (smsError) {
      logLoginFailedReason('request-otp', 'sms send failed', {
        phone,
        message: smsError.message,
      });
      return res.status(500).json({
        status: 'error',
        message: 'Unable to send OTP via SMS. Please try again later.',
      });
    }
  } catch (error) {
    logLoginFailedReason('request-otp', 'unexpected error', {
      phone: req.body?.phone,
      message: error.message,
    });
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Phone number already exists',
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Unable to send OTP',
    });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify OTP and return JWT token
 * Body: { phone, otp }
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    logLoginAttempt('verify-otp', { phone });

    if (!isDbReady()) {
      const db = getDbState();
      logLoginFailedReason('verify-otp', 'database not ready', { dbState: db.state, phone });
      return res.status(503).json({
        status: 'error',
        message: 'Service is warming up. Please retry in a few seconds.',
        code: 'DB_NOT_READY',
      });
    }

    if (!phone || !otp) {
      logLoginFailedReason('verify-otp', 'missing phone or otp', { phone });
      return res.status(400).json({
        status: 'fail',
        message: 'Phone number and OTP are required',
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      logLoginFailedReason('verify-otp', 'user not found', { phone });
      return res.status(404).json({
        status: 'fail',
        message: 'User not found. Please request OTP first.',
      });
    }

    // Check if OTP exists and is not expired
    if (!user.otp || !user.otp.code) {
      logLoginFailedReason('verify-otp', 'otp missing', { phone, userId: user._id });
      return res.status(400).json({
        status: 'fail',
        message: 'OTP not found. Please request a new OTP.',
      });
    }

    if (new Date() > user.otp.expiresAt) {
      logLoginFailedReason('verify-otp', 'otp expired', { phone, userId: user._id });
      return res.status(400).json({
        status: 'fail',
        message: 'OTP expired. Please request a new OTP.',
      });
    }

    // Verify OTP
    if (user.otp.code !== otp) {
      logLoginFailedReason('verify-otp', 'otp mismatch', { phone, userId: user._id });
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid OTP',
      });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logLoginFailedReason('verify-otp', 'unexpected error', {
      phone: req.body?.phone,
      message: error.message,
    });
    res.status(500).json({
      status: 'error',
      message: 'Unable to verify OTP',
    });
  }
};

/**
 * POST /api/auth/owner-login
 * Owner login with admin ID (username) and password
 * Body: { adminId, password }
 */
exports.ownerLogin = async (req, res) => {
  try {
    const { adminId, password } = req.body;

    logLoginAttempt('owner-login', { adminId });

    if (!isDbReady()) {
      const db = getDbState();
      logLoginFailedReason('owner-login', 'database not ready', {
        adminId,
        dbState: db.state,
      });
      return res.status(503).json({
        status: 'error',
        message: 'Service is warming up. Please retry in a few seconds.',
        code: 'DB_NOT_READY',
      });
    }

    if (!adminId || !password) {
      logLoginFailedReason('owner-login', 'missing adminId or password', { adminId });
      return res.status(400).json({
        status: 'fail',
        message: 'Admin ID and password are required',
      });
    }

    // Primary: login by username (admin ID)
    let user = await User.findOne({ username: adminId, role: 'owner' }).select('+password');

    // Fallback: allow phone-based login for backward compatibility
    if (!user && /^[0-9]{10}$/.test(adminId)) {
      user = await User.findOne({ phone: adminId, role: 'owner' }).select('+password');
    }

    if (!user) {
      logLoginFailedReason('owner-login', 'user not found', { adminId });
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials',
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      logLoginFailedReason('owner-login', 'password mismatch', {
        adminId,
        userId: user._id,
      });
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
      },
    });
  } catch (error) {
    logLoginFailedReason('owner-login', 'unexpected error', {
      adminId: req.body?.adminId,
      message: error.message,
    });
    res.status(500).json({
      status: 'error',
      message: 'Unable to login',
    });
  }
};

/**
 * GET /api/auth/me
 * Get current user info (protected route)
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-otp');
    res.status(200).json({
      status: 'success',
      data: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch user info',
    });
  }
};
