const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { authenticate, restrictToOwner } = require('../middleware/auth');

// Public route to list tables
router.get('/', tableController.listTables);

// Owner-only routes to manage tables
router.get('/all', authenticate, restrictToOwner, tableController.listAllTables);
router.post('/', authenticate, restrictToOwner, tableController.createTable);
router.patch('/:id/active', authenticate, restrictToOwner, tableController.updateTableActiveStatus);
router.patch('/:id/free', authenticate, restrictToOwner, tableController.freeTable);
router.delete('/:id', authenticate, restrictToOwner, tableController.deleteTable);

module.exports = router;
