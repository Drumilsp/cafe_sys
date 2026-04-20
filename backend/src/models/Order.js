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
  prepared: {
    type: Boolean,
    default: false,
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
      enum: ['pending', 'verifying_payment', 'preparing', 'ready', 'delivered', 'collect_payment'],
      default: 'pending',
    },
    serviceType: {
      type: String,
      enum: ['counter', 'table'],
      default: 'counter',
    },
    customerComment: {
      type: String,
      trim: true,
      maxlength: [300, 'Comment must be 300 characters or less'],
      default: '',
    },
    tableNumber: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
orderSchema.index({ customer: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderStatus: 1 });

module.exports = mongoose.model('Order', orderSchema);
