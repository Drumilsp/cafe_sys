const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/request-otp', authController.requestOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/owner-login', authController.ownerLogin);

// Protected routes
router.get('/me', authenticate, authController.getMe);

module.exports = router;
