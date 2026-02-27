const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendSms } = require('../services/smsService');

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/request-otp
 * Request OTP for phone number login
 * Body: { name, phone }
 */
exports.requestOTP = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name and phone number are required',
      });
    }

    // Validate phone format (10 digits)
    if (!/^[0-9]{10}$/.test(phone)) {
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
      await sendSms(
        phone,
        `Your OTP for Cafe login is ${otp}. Valid for 10 minutes.`
      );
    } catch (smsError) {
      console.error('SMS send error:', smsError);
      return res.status(500).json({
        status: 'error',
        message: 'Unable to send OTP via SMS. Please try again later.',
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
      // In development, return OTP for testing
      ...(process.env.NODE_ENV !== 'production' && { otp }),
    });
  } catch (error) {
    console.error('Request OTP error:', error);
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

    if (!phone || !otp) {
      return res.status(400).json({
        status: 'fail',
        message: 'Phone number and OTP are required',
      });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found. Please request OTP first.',
      });
    }

    // Check if OTP exists and is not expired
    if (!user.otp || !user.otp.code) {
      return res.status(400).json({
        status: 'fail',
        message: 'OTP not found. Please request a new OTP.',
      });
    }

    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({
        status: 'fail',
        message: 'OTP expired. Please request a new OTP.',
      });
    }

    // Verify OTP
    if (user.otp.code !== otp) {
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
    console.error('Verify OTP error:', error);
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

    if (!adminId || !password) {
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
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials',
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
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
    console.error('Owner login error:', error);
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
