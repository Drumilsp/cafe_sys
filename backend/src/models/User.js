const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      match: [/^[0-9]{10}$/, 'Phone number must be 10 digits'],
    },
    role: {
      type: String,
      enum: ['customer', 'owner'],
      default: 'customer',
    },
    otp: {
      code: String,
      expiresAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster phone lookups
userSchema.index({ phone: 1 });

// Index for role-based queries
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
