const Table = require('../models/Table');

/**
 * GET /api/tables
 * Public - list all active tables
 */
exports.listTables = async (req, res) => {
  try {
    const tables = await Table.find({ active: true }).sort({ name: 1 });
    res.status(200).json({ status: 'ok', data: tables });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('List tables error:', err);
    res.status(500).json({ status: 'error', message: 'Unable to fetch tables' });
  }
};

/**
 * POST /api/tables
 * Owner only - create table
 * Body: { name }
 */
exports.createTable = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Table name is required',
      });
    }

    const table = await Table.create({ name: name.trim() });
    res.status(201).json({ status: 'created', data: table });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Create table error:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        status: 'fail',
        message: 'Table with this name already exists',
      });
    }
    res.status(500).json({ status: 'error', message: 'Unable to create table' });
  }
};

/**
 * DELETE /api/tables/:id
 * Owner only - delete table
 */
exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) {
      return res.status(404).json({ status: 'fail', message: 'Table not found' });
    }
    res.status(200).json({ status: 'ok', message: 'Table deleted' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Delete table error:', err);
    res.status(500).json({ status: 'error', message: 'Unable to delete table' });
  }
};

