const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  priceAtTime: {
    type: Number,
    required: true,
    min: [0, 'Price must be positive'],
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount must be positive'],
    },
    paymentMethod: {
      type: String,
      enum: ['online', 'counter'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'completed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
orderSchema.index({ orderId: 1 });
orderSchema.index({ customer: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);
