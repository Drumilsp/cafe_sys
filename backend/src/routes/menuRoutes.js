const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, restrictToOwner } = require('../middleware/auth');

// Public routes
router.get('/', menuController.listMenu);
router.get('/:id', menuController.getMenuItem);

// Owner-only routes
router.post('/', authenticate, restrictToOwner, menuController.createMenuItem);
router.put('/:id', authenticate, restrictToOwner, menuController.updateMenuItem);
router.patch('/:id/availability', authenticate, restrictToOwner, menuController.toggleAvailability);

module.exports = router;
