const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price must be a positive number'],
    },
    available: {
      type: Boolean,
      default: true,
    },
    category: {
      type: String,
      default: 'general',
      trim: true,
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // createdAt + updatedAt automatically handled by mongoose
  }
);

menuSchema.index({ displayOrder: 1 });

module.exports = mongoose.model('Menu', menuSchema);
