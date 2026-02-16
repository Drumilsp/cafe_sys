const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, restrictToCustomer, restrictToOwner } = require('../middleware/auth');

// Customer routes
router.post('/', authenticate, restrictToCustomer, orderController.createOrder);
router.get('/my', authenticate, restrictToCustomer, orderController.getMyOrders);

// Owner routes
router.get('/', authenticate, restrictToOwner, orderController.getAllOrders);
router.patch('/:id/status', authenticate, restrictToOwner, orderController.updateOrderStatus);
router.patch('/:id/payment', authenticate, restrictToOwner, orderController.updateOrderPayment);

// Shared route (must come after specific routes)
router.get('/:id', authenticate, orderController.getOrderById);

module.exports = router;
