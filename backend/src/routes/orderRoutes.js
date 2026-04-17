const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, restrictToCustomer, restrictToOwner } = require('../middleware/auth');

// Customer routes
router.post('/', authenticate, restrictToCustomer, orderController.createOrder);
router.get('/my', authenticate, restrictToCustomer, orderController.getMyOrders);
router.patch('/:id/customer-paid', authenticate, restrictToCustomer, orderController.customerMarkedPaid);

// Owner routes
router.post('/manual', authenticate, restrictToOwner, orderController.createManualOrder);
router.get('/', authenticate, restrictToOwner, orderController.getAllOrders);
router.patch('/:id/status', authenticate, restrictToOwner, orderController.updateOrderStatus);
router.patch('/:id/payment', authenticate, restrictToOwner, orderController.updateOrderPayment);
router.patch('/:id/items', authenticate, restrictToOwner, orderController.updateOrderItems);
router.patch('/:id/items/:itemId/prepared', authenticate, restrictToOwner, orderController.updateOrderItemPrepared);

// Shared route (must come after specific routes)
router.get('/:id', authenticate, orderController.getOrderById);

module.exports = router;
