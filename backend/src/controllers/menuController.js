const Menu = require('../models/Menu');

/**
 * GET /api/menu
 * Public - list all menu items (optionally only available ones)
 * Query params: ?available=true
 */
exports.listMenu = async (req, res) => {
  try {
    const filter = {};
    if (req.query.available === 'true') filter.available = true;
    const items = await Menu.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ status: 'ok', data: items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Unable to fetch menu' });
  }
};

/**
 * GET /api/menu/:id
 */
exports.getMenuItem = async (req, res) => {
  try {
    const item = await Menu.findById(req.params.id);
    if (!item) return res.status(404).json({ status: 'fail', message: 'Item not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Unable to fetch item' });
  }
};

/**
 * POST /api/menu
 * Owner usage (for now unprotected)
 * Body: { name, price, available?, category?, imageUrl? }
 */
exports.createMenuItem = async (req, res) => {
  try {
    const { name, price, available, category, imageUrl } = req.body;
    const item = await Menu.create({ name, price, available, category, imageUrl });
    res.status(201).json({ status: 'created', data: item });
  } catch (err) {
    console.error(err);
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ status: 'fail', errors: messages });
    }
    res.status(500).json({ status: 'error', message: 'Unable to create item' });
  }
};

/**
 * PATCH /api/menu/:id/availability
 * Body: { available: true/false }
 * Owner-only (for now no auth)
 */
exports.toggleAvailability = async (req, res) => {
  try {
    const { available } = req.body;
    if (typeof available !== 'boolean') {
      return res.status(400).json({ status: 'fail', message: 'available must be boolean' });
    }
    const item = await Menu.findByIdAndUpdate(
      req.params.id,
      { available, updatedAt: Date.now() },
      { new: true }
    );
    if (!item) return res.status(404).json({ status: 'fail', message: 'Item not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Unable to update availability' });
  }
};

/**
 * PUT /api/menu/:id
 * Update (owner)
 */
exports.updateMenuItem = async (req, res) => {
  try {
    const updates = req.body;
    // Prevent accidental ID change
    delete updates._id;
    const item = await Menu.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ status: 'fail', message: 'Item not found' });
    res.json({ status: 'ok', data: item });
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ status: 'fail', errors: messages });
    }
    res.status(500).json({ status: 'error', message: 'Unable to update item' });
  }
};
