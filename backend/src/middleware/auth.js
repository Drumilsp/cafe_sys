const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT token and attach user to request
 */
exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Authentication required. Please login.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-otp');

    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found. Please login again.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Please login again.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Token expired. Please login again.',
      });
    }
    res.status(500).json({
      status: 'error',
      message: 'Authentication error',
    });
  }
};

/**
 * Restrict route to owner role only
 */
exports.restrictToOwner = (req, res, next) => {
  if (req.user.role !== 'owner') {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied. Owner privileges required.',
    });
  }
  next();
};

/**
 * Restrict route to customer role only
 */
exports.restrictToCustomer = (req, res, next) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied. Customer privileges required.',
    });
  }
  next();
};
