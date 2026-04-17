const Table = require('../models/Table');
const {
  getAvailableActiveTables,
  getTablesWithOccupancy,
} = require('../utils/tableAvailability');

/**
 * GET /api/tables
 * Public - list all active tables
 */
exports.listTables = async (req, res) => {
  try {
    const tables = await getAvailableActiveTables();
    res.status(200).json({ status: 'ok', data: tables });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('List tables error:', err);
    res.status(500).json({ status: 'error', message: 'Unable to fetch tables' });
  }
};

/**
 * GET /api/tables/all
 * Owner only - list all tables including disabled ones
 */
exports.listAllTables = async (req, res) => {
  try {
    const tables = await getTablesWithOccupancy();
    res.status(200).json({ status: 'ok', data: tables });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('List all tables error:', err);
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
 * PATCH /api/tables/:id/active
 * Owner only - enable/disable a table
 * Body: { active: true|false }
 */
exports.updateTableActiveStatus = async (req, res) => {
  try {
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        status: 'fail',
        message: 'active must be boolean',
      });
    }

    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { active },
      { new: true, runValidators: true }
    );

    if (!table) {
      return res.status(404).json({ status: 'fail', message: 'Table not found' });
    }

    res.status(200).json({ status: 'ok', data: table });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Update table active status error:', err);
    res.status(500).json({ status: 'error', message: 'Unable to update table' });
  }
};

/**
 * PATCH /api/tables/:id/free
 * Owner only - manually free a table if it got stuck
 */
exports.freeTable = async (req, res) => {
  try {
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { releasedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!table) {
      return res.status(404).json({ status: 'fail', message: 'Table not found' });
    }

    res.status(200).json({ status: 'ok', data: table });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Free table error:', err);
    res.status(500).json({ status: 'error', message: 'Unable to free table' });
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
