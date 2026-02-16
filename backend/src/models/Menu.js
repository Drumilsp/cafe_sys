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
    // you can add imageUrl, description etc later
    imageUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true, // createdAt + updatedAt automatically handled by mongoose
  }
);

module.exports = mongoose.model('Menu', menuSchema);
