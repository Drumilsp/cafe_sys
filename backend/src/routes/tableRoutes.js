const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { authenticate, restrictToOwner } = require('../middleware/auth');

// Public route to list tables
router.get('/', tableController.listTables);

// Owner-only routes to manage tables
router.post('/', authenticate, restrictToOwner, tableController.createTable);
router.delete('/:id', authenticate, restrictToOwner, tableController.deleteTable);

module.exports = router;

