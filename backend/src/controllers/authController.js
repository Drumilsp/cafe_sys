const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

    // Mock OTP: For MVP, use a simple 4-digit code (1234)
    // In production, integrate with SMS service like Twilio
    const mockOTP = '1234';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user = await User.findOne({ phone });

    if (user) {
      // Update existing user
      user.name = name;
      user.otp = {
        code: mockOTP,
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
          code: mockOTP,
          expiresAt,
        },
      });
    }

    // In production, send OTP via SMS here
    console.log(`OTP for ${phone}: ${mockOTP}`);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
      // In development, return OTP for testing
      ...(process.env.NODE_ENV !== 'production' && { otp: mockOTP }),
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
