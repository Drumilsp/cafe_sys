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
    // Optional admin username for owner login
    username: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['customer', 'owner'],
      default: 'customer',
    },
    // Optional password field (used for owner ID/password login)
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
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
userSchema.index({ username: 1 }, { sparse: true });

// Hash password when it is set/changed
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare plain text password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
