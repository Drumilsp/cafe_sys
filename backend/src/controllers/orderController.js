const Order = require('../models/Order');
const Menu = require('../models/Menu');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { assertTableAvailable } = require('../utils/tableAvailability');

const isPaymentEnabled = () => String(process.env.ENABLE_PAYMENT ?? 'true').toLowerCase() === 'true';

const normalizeStatusValue = (status) => {
  if (status === 'completed') return 'delivered';
  return status;
};

const normalizeOrderForResponse = (order) => {
  if (!order) return order;
  const current = order.orderStatus;
  const next = normalizeStatusValue(current);
  if (next !== current) {
    order.orderStatus = next;
  }
  return order;
};

const ORDER_ITEM_POPULATE_FIELDS = 'name price imageUrl available isVeg';

const findOrderByIdentifier = async (id) => {
  let order = await Order.findOne({ orderId: id });
  if (!order) {
    order = await Order.findById(id);
  }
  return order;
};

const isOrderEditable = (order) => !['delivered', 'collect_payment'].includes(order.orderStatus);

/**
 * Generate unique order ID with daily reset counter (e.g., ORD-20240216-0001)
 */
const generateOrderId = async (attemptOffset = 0) => {
  try {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

    // Since the numeric part is zero-padded, sorting by orderId descending
    // gives us the highest sequence for the day without relying on createdAt.
    const latestOrder = await Order.findOne({
      orderId: { $regex: `^ORD-${dateStr}-\\d{4}$` },
    })
      .sort({ orderId: -1 })
      .select('orderId');

    let nextNumber = 1;
    if (latestOrder?.orderId) {
      const lastOrderId = latestOrder.orderId;
      const match = lastOrderId.match(/-(\d{4})$/);
      if (match) {
        const lastNumber = parseInt(match[1], 10);
        nextNumber = lastNumber + 1;
      }
    }

    nextNumber += attemptOffset;

    // Ensure we don't exceed 9999 orders per day
    if (nextNumber > 9999) {
      throw new Error('Maximum orders per day (9999) exceeded');
    }
    
    // Format with leading zeros (4 digits)
    const orderNumber = nextNumber.toString().padStart(4, '0');
    return `ORD-${dateStr}-${orderNumber}`;
  } catch (error) {
    console.error('Error generating order ID:', error);
    throw error;
  }
};

/**
 * Helper to validate items and compute totals
 */
const buildOrderItems = async (items) => {
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    if (!item.menuItemId || !item.quantity || item.quantity < 1) {
      const error = new Error('Each item must have menuItemId and quantity (min 1)');
      error.statusCode = 400;
      throw error;
    }

    const menuItem = await Menu.findById(item.menuItemId);
    if (!menuItem) {
      const error = new Error(`Menu item ${item.menuItemId} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (!menuItem.available) {
      const error = new Error(`Item "${menuItem.name}" is currently unavailable`);
      error.statusCode = 400;
      throw error;
    }

    const itemTotal = menuItem.price * item.quantity;
    totalAmount += itemTotal;

    orderItems.push({
      menuItem: menuItem._id,
      quantity: item.quantity,
      priceAtTime: menuItem.price,
    });
  }

  return { totalAmount, orderItems };
};

/**
 * Normalize and validate service type / table info
 */
const normalizeServiceDetails = (body) => {
  const { serviceType, tableNumber } = body;
  const allowed = ['counter', 'table'];
  const finalServiceType = serviceType && allowed.includes(serviceType) ? serviceType : 'counter';

  if (finalServiceType === 'table') {
    if (!tableNumber || typeof tableNumber !== 'string' || !tableNumber.trim()) {
      const error = new Error('Table number is required for table delivery');
      error.statusCode = 400;
      throw error;
    }
    return { serviceType: 'table', tableNumber: tableNumber.trim() };
  }

  return { serviceType: 'counter', tableNumber: null };
};

const ensureTableCanBeAssigned = async (serviceDetails) => {
  if (serviceDetails.serviceType !== 'table' || !serviceDetails.tableNumber) {
    return;
  }

  await assertTableAvailable(serviceDetails.tableNumber);
};

const normalizeCustomerComment = (value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    const error = new Error('Comment must be text');
    error.statusCode = 400;
    throw error;
  }

  const comment = value.trim();

  if (comment.length > 300) {
    const error = new Error('Comment must be 300 characters or less');
    error.statusCode = 400;
    throw error;
  }

  return comment;
};

/**
 * POST /api/orders
 * Create a new order (Customer only)
 * Body: { items: [{ menuItemId, quantity }], paymentMethod, serviceType?, tableNumber? }
 */
exports.createOrder = async (req, res) => {
  try {
    const { items } = req.body;
    const paymentEnabled = isPaymentEnabled();
    const paymentMethod = paymentEnabled ? req.body.paymentMethod : 'counter';
    let customerComment = '';

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Order must contain at least one item',
      });
    }

    if (!paymentMethod || !['online', 'counter'].includes(paymentMethod)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment method must be "online" or "counter"',
      });
    }

    // Service / table info
    let serviceDetails;
    try {
      serviceDetails = normalizeServiceDetails(req.body);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    try {
      await ensureTableCanBeAssigned(serviceDetails);
    } catch (err) {
      const statusCode = err.statusCode || 409;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    try {
      customerComment = normalizeCustomerComment(req.body.customerComment);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    // Validate items and calculate total
    let totalAmount = 0;
    let orderItems = [];

    try {
      const result = await buildOrderItems(items);
      totalAmount = result.totalAmount;
      orderItems = result.orderItems;
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    // Generate unique order ID with daily reset counter (retry on conflict)
    let attempts = 0;
    const maxAttempts = 10;
    
    // Try to create order with retry logic
    while (attempts < maxAttempts) {
      try {
        const orderId = await generateOrderId(attempts);
        
        // Try to create the order
        const order = await Order.create({
          orderId,
          customer: req.user._id,
          items: orderItems,
          totalAmount,
          paymentMethod,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          serviceType: serviceDetails.serviceType,
          customerComment,
          tableNumber: serviceDetails.tableNumber,
        });
        
        // Success - populate and return
        await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
        
        res.status(201).json({
          status: 'success',
          message: 'Order created successfully',
          data: order,
        });
        return; // Exit function on success
        
      } catch (error) {
        // Check if it's a duplicate key error (MongoDB error code 11000)
        const isDuplicateError = error.code === 11000 || 
                                 (error.name === 'MongoServerError' && error.code === 11000) ||
                                 (error.message && error.message.includes('duplicate'));
        
        if (isDuplicateError) {
          attempts++;
          if (attempts >= maxAttempts) {
            console.error('Failed to generate unique order ID after', maxAttempts, 'attempts. Last error:', error.message);
            return res.status(500).json({
              status: 'error',
              message: 'Unable to generate unique order ID after multiple attempts. Please try again.',
            });
          }
          // Wait a bit longer on each retry (exponential backoff)
          const delay = Math.min(100 * Math.pow(2, attempts), 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry with next number
        }
        
        // If it's not a duplicate key error, throw it to be caught by outer catch
        throw error;
      }
    }
    
    // Should never reach here, but just in case
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create order after multiple attempts',
    });

  } catch (error) {
    console.error('Create order error:', error);
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', '),
      });
    }
    
    if (error.name === 'MongoServerError' && error.code === 11000) {
      return res.status(409).json({
        status: 'error',
        message: 'Order ID conflict. Please try again.',
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: error.message || 'Unable to create order',
      ...(process.env.NODE_ENV !== 'production' && { error: error.toString() }),
    });
  }
};

/**
 * POST /api/orders/manual
 * Create a new order manually (Owner only)
 * Body: {
 *   items: [{ menuItemId, quantity }],
 *   paymentMethod,
 *   customerName,
 *   customerPhone,
 *   serviceType?,
 *   tableNumber?
 * }
 */
exports.createManualOrder = async (req, res) => {
  try {
    const { items, customerName, customerPhone } = req.body;
    const paymentEnabled = isPaymentEnabled();
    const paymentMethod = paymentEnabled ? req.body.paymentMethod : 'counter';

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Order must contain at least one item',
      });
    }

    if (!paymentMethod || !['online', 'counter'].includes(paymentMethod)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Payment method must be "online" or "counter"',
      });
    }

    if (!customerName) {
      return res.status(400).json({
        status: 'fail',
        message: 'Customer name is required for manual orders',
      });
    }

    if (customerPhone && !/^[0-9]{10}$/.test(customerPhone)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Customer phone must be exactly 10 digits when provided',
      });
    }

    // Service / table info
    let serviceDetails;
    try {
      serviceDetails = normalizeServiceDetails(req.body);
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    try {
      await ensureTableCanBeAssigned(serviceDetails);
    } catch (err) {
      const statusCode = err.statusCode || 409;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    // Find or create customer user
    let customer;
    if (customerPhone) {
      customer = await User.findOne({ phone: customerPhone });
      if (!customer) {
        customer = await User.create({
          name: customerName,
          phone: customerPhone,
          role: 'customer',
        });
      } else if (customer.name !== customerName) {
        customer.name = customerName;
        await customer.save();
      }
    } else {
      // Use a shared "walk-in" customer account when phone is not provided
      const WALKIN_PHONE = '0000000000';
      customer = await User.findOne({ phone: WALKIN_PHONE });
      if (!customer) {
        customer = await User.create({
          name: 'Walk-in Customer',
          phone: WALKIN_PHONE,
          role: 'customer',
        });
      }
    }

    // Validate items and calculate total
    let totalAmount = 0;
    let orderItems = [];

    try {
      const result = await buildOrderItems(items);
      totalAmount = result.totalAmount;
      orderItems = result.orderItems;
    } catch (err) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({
        status: 'fail',
        message: err.message,
      });
    }

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
        const orderId = await generateOrderId(attempts);

        const order = await Order.create({
          orderId,
          customer: customer._id,
          items: orderItems,
          totalAmount,
          paymentMethod,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          serviceType: serviceDetails.serviceType,
          tableNumber: serviceDetails.tableNumber,
        });

        await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
        await order.populate('customer', 'name phone');

        return res.status(201).json({
          status: 'success',
          message: 'Manual order created successfully',
          data: order,
        });
      } catch (error) {
        const isDuplicateError =
          error.code === 11000 ||
          (error.name === 'MongoServerError' && error.code === 11000) ||
          (error.message && error.message.includes('duplicate'));

        if (isDuplicateError) {
          attempts++;
          if (attempts >= maxAttempts) {
            console.error(
              'Failed to generate unique order ID for manual order after',
              maxAttempts,
              'attempts. Last error:',
              error.message
            );
            return res.status(500).json({
              status: 'error',
              message: 'Unable to generate unique order ID after multiple attempts. Please try again.',
            });
          }
          const delay = Math.min(100 * Math.pow(2, attempts), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to create manual order after multiple attempts',
    });
  } catch (error) {
    console.error('Create manual order error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Unable to create manual order',
      ...(process.env.NODE_ENV !== 'production' && { error: error.toString() }),
    });
  }
};

/**
 * GET /api/orders/my
 * Get current customer's orders (Customer only)
 */
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS)
      .sort({ createdAt: -1 });
    orders.forEach(normalizeOrderForResponse);

    res.status(200).json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch orders',
    });
  }
};

/**
 * GET /api/orders
 * Get all orders (Owner only)
 * Query params: 
 *   ?status=pending|verifying_payment|preparing|ready|delivered|collect_payment
 *   ?paymentMethod=online|counter
 *   ?paymentStatus=pending|paid
 *   ?sortBy=time|price|volume (default: time)
 *   ?sortOrder=asc|desc (default: desc)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const filter = {};
    
    // Filter by status
    if (req.query.status) {
      filter.orderStatus = normalizeStatusValue(req.query.status);
    }
    
    // Filter by payment method
    if (req.query.paymentMethod) {
      filter.paymentMethod = req.query.paymentMethod;
    }

    // Filter by payment status
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }

    // Exclude pay-at-counter orders that are still pending payment (for main "active" list)
    if (req.query.excludeCounterUnpaid === '1' || req.query.excludeCounterUnpaid === 'true') {
      filter.$or = [
        { paymentMethod: { $ne: 'counter' } },
        { paymentStatus: 'paid' },
      ];
    }

    // Exclude online orders that are still in 'pending' status (customer hasn't confirmed payment yet)
    if (req.query.excludeOnlinePending === '1' || req.query.excludeOnlinePending === 'true') {
      const existingOr = filter.$or;
      const onlinePendingCondition = {
        $or: [
          { paymentMethod: { $ne: 'online' } },
          { orderStatus: { $ne: 'pending' } },
        ],
      };
      if (existingOr) {
        filter.$and = [{ $or: existingOr }, onlinePendingCondition];
        delete filter.$or;
      } else {
        filter.$or = onlinePendingCondition.$or;
      }
    }

    // Optional: limit to today's orders
    if (req.query.todayOnly === '1' || req.query.todayOnly === 'true') {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    // Build sort object
    const sortBy = req.query.sortBy || 'time';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    let sortObject = {};
    let needsInMemorySort = false;
    
    switch (sortBy) {
      case 'price':
        sortObject = { totalAmount: sortOrder };
        break;
      case 'volume':
        // Sort by number of items - need to calculate in memory
        sortObject = { createdAt: -1 }; // Initial sort, will re-sort in memory
        needsInMemorySort = true;
        break;
      case 'time':
      default:
        sortObject = { createdAt: sortOrder };
        break;
    }

    let orders = await Order.find(filter)
      .populate('customer', 'name phone')
      .populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS)
      .sort(sortObject)
      .lean(); // Use lean() for better performance
    orders = orders.map(normalizeOrderForResponse);

    // If sorting by volume, calculate item count and sort in memory
    if (needsInMemorySort) {
      orders = orders.map(order => ({
        ...order,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      }));
      orders.sort((a, b) => {
        return sortOrder === 1 
          ? a.itemCount - b.itemCount 
          : b.itemCount - a.itemCount;
      });
    }

    res.status(200).json({
      status: 'success',
      data: orders,
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch orders',
    });
  }
};

/**
 * PATCH /api/orders/:id/status
 * Update order status (Owner only)
 * Body: { orderStatus: 'pending'|'verifying_payment'|'preparing'|'ready'|'delivered'|'collect_payment' }
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ['pending', 'verifying_payment', 'preparing', 'ready', 'delivered', 'collect_payment'];
    const normalizedRequested = normalizeStatusValue(orderStatus);
    if (!orderStatus || !validStatuses.includes(normalizedRequested)) {
      return res.status(400).json({
        status: 'fail',
        message: `orderStatus must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Try to find by orderId first, then by MongoDB _id
    const order = await findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }

    if (!isPaymentEnabled() && normalizedRequested === 'verifying_payment') {
      return res.status(400).json({
        status: 'fail',
        message: 'verifying_payment is not available when payment is disabled',
      });
    }

    // Update order status
    order.orderStatus = normalizedRequested;
    if (normalizedRequested === 'collect_payment') {
      order.paymentStatus = 'paid';
    }
    await order.save();

    // Populate and return
    await order.populate('customer', 'name phone');
    await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);

    normalizeOrderForResponse(order);
    res.status(200).json({
      status: 'success',
      message: 'Order status updated',
      data: order,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to update order status',
    });
  }
};

/**
 * PATCH /api/orders/:id/payment
 * Mark order as paid (Owner only). For pay-at-counter orders.
 */
exports.updateOrderPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (paymentStatus !== 'paid') {
      return res.status(400).json({
        status: 'fail',
        message: 'Only paymentStatus "paid" is allowed',
      });
    }

    const order = await findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }

    order.paymentStatus = 'paid';
    // When owner marks Paid, order should move to Preparing immediately
    if (order.orderStatus === 'pending') {
      order.orderStatus = 'preparing';
    } else if (order.orderStatus === 'delivered') {
      order.orderStatus = 'collect_payment';
    }
    await order.save();

    await order.populate('customer', 'name phone');
    await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);

    normalizeOrderForResponse(order);
    res.status(200).json({
      status: 'success',
      message: 'Payment marked as received',
      data: order,
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to update payment status',
    });
  }
};

/**
 * PATCH /api/orders/:id/items
 * Edit an order by removing items before delivery
 * Body: { removedItemIds: [orderItemId] }
 */
exports.updateOrderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { removedItemIds = [] } = req.body;

    if (!Array.isArray(removedItemIds)) {
      return res.status(400).json({
        status: 'fail',
        message: 'removedItemIds must be an array',
      });
    }

    if (removedItemIds.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Provide at least one item to remove',
      });
    }

    const order = await findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }

    if (!isOrderEditable(order)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Delivered orders cannot be edited',
      });
    }

    const removedSet = new Set(removedItemIds.map(String));
    const nextItems = order.items.filter((item) => !removedSet.has(String(item._id)));

    if (nextItems.length === order.items.length) {
      return res.status(400).json({
        status: 'fail',
        message: 'No matching order items were selected for removal',
      });
    }

    if (nextItems.length === 0) {
      await Order.findByIdAndDelete(order._id);
      return res.status(200).json({
        status: 'success',
        message: 'Order removed because no items were left',
        data: null,
      });
    }

    order.items = nextItems;
    order.totalAmount = nextItems.reduce(
      (sum, item) => sum + Number(item.priceAtTime) * Number(item.quantity),
      0
    );
    await order.save();

    await order.populate('customer', 'name phone');
    await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
    normalizeOrderForResponse(order);

    return res.status(200).json({
      status: 'success',
      message: 'Order updated successfully',
      data: order,
    });
  } catch (error) {
    console.error('Update order items error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Unable to update order items',
    });
  }
};

/**
 * PATCH /api/orders/:id/items/:itemId/prepared
 * Update prepared state for a specific order item (Owner only)
 * Body: { prepared: true/false }
 */
exports.updateOrderItemPrepared = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { prepared } = req.body;

    if (typeof prepared !== 'boolean') {
      return res.status(400).json({
        status: 'fail',
        message: 'prepared must be boolean',
      });
    }

    // Try to find by orderId first, then by MongoDB _id
    const order = await findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order item not found',
      });
    }

    item.prepared = prepared;
    await order.save();

    await order.populate('customer', 'name phone');
    await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
    normalizeOrderForResponse(order);

    res.status(200).json({
      status: 'success',
      message: 'Order item updated',
      data: order,
    });
  } catch (error) {
    console.error('Update order item prepared error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to update order item prepared state',
    });
  }
};

/**
 * PATCH /api/orders/:id/customer-paid
 * Customer indicates they have paid via UPI (online payment).
 * Sets orderStatus to verifying_payment and paymentStatus to paid.
 */
exports.customerMarkedPaid = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by orderId first, then by MongoDB _id
    const order = await findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }

    // Customer can only mark their own order as paid
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied',
      });
    }

    if (order.paymentMethod !== 'online') {
      return res.status(400).json({
        status: 'fail',
        message: 'This order is not an online payment order',
      });
    }

    if (!isPaymentEnabled()) {
      return res.status(400).json({
        status: 'fail',
        message: 'Online payment is disabled',
      });
    }

    order.paymentStatus = 'paid';
    order.orderStatus = 'verifying_payment';
    await order.save();

    await order.populate('customer', 'name phone');
    await order.populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
    normalizeOrderForResponse(order);

    return res.status(200).json({
      status: 'success',
      message: 'Payment submitted for verification',
      data: order,
    });
  } catch (error) {
    console.error('Customer marked paid error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Unable to update payment status',
    });
  }
};

/**
 * GET /api/orders/:id
 * Get single order by ID (supports both MongoDB _id and orderId)
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by orderId first (readable ID), then by MongoDB _id
    let order = await Order.findOne({ orderId: id })
      .populate('customer', 'name phone')
      .populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
    
    if (!order) {
      // Try MongoDB _id if orderId didn't match
      order = await Order.findById(id)
        .populate('customer', 'name phone')
        .populate('items.menuItem', ORDER_ITEM_POPULATE_FIELDS);
    }

    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found',
      });
    }

    // Check if user has access (customer can only see their own orders, owner can see all)
    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied',
      });
    }

    normalizeOrderForResponse(order);
    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Unable to fetch order',
    });
  }
};
