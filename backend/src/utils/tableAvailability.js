const Order = require('../models/Order');
const Table = require('../models/Table');

const TERMINAL_TABLE_ORDER_STATUSES = new Set(['delivered', 'collect_payment']);

const isOrderOccupyingTable = (order) => {
  return !(order.paymentStatus === 'paid' && TERMINAL_TABLE_ORDER_STATUSES.has(order.orderStatus));
};

const buildOccupancyMap = async (tables) => {
  const tableNames = tables.map((table) => table.name).filter(Boolean);

  if (tableNames.length === 0) {
    return new Map();
  }

  const orders = await Order.find({
    serviceType: 'table',
    tableNumber: { $in: tableNames },
  })
    .select('orderId orderStatus paymentStatus tableNumber createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const tableByName = new Map(tables.map((table) => [table.name, table]));
  const occupancyMap = new Map();

  for (const order of orders) {
    if (!isOrderOccupyingTable(order)) {
      continue;
    }

    const table = tableByName.get(order.tableNumber);
    if (!table) {
      continue;
    }

    if (table.releasedAt && new Date(order.createdAt) <= new Date(table.releasedAt)) {
      continue;
    }

    if (!occupancyMap.has(order.tableNumber)) {
      occupancyMap.set(order.tableNumber, order);
    }
  }

  return occupancyMap;
};

const getAvailableActiveTables = async () => {
  const tables = await Table.find({ active: true }).sort({ name: 1 }).lean();
  const occupancyMap = await buildOccupancyMap(tables);

  return tables
    .filter((table) => !occupancyMap.has(table.name))
    .map((table) => ({
      ...table,
      occupied: false,
    }));
};

const getTablesWithOccupancy = async () => {
  const tables = await Table.find().sort({ name: 1 }).lean();
  const occupancyMap = await buildOccupancyMap(tables);

  return tables.map((table) => {
    const occupiedOrder = occupancyMap.get(table.name);
    return {
      ...table,
      occupied: Boolean(occupiedOrder),
      occupiedOrder: occupiedOrder
        ? {
            orderId: occupiedOrder.orderId,
            orderStatus: occupiedOrder.orderStatus,
            paymentStatus: occupiedOrder.paymentStatus,
          }
        : null,
    };
  });
};

const assertTableAvailable = async (tableName) => {
  const normalizedName = tableName.trim();
  const table = await Table.findOne({ name: normalizedName }).lean();

  if (!table) {
    const error = new Error('Selected table does not exist');
    error.statusCode = 404;
    throw error;
  }

  if (!table.active) {
    const error = new Error(`Table ${normalizedName} is currently disabled`);
    error.statusCode = 409;
    throw error;
  }

  const occupancyMap = await buildOccupancyMap([table]);
  if (occupancyMap.has(normalizedName)) {
    const error = new Error(`Table ${normalizedName} is currently occupied`);
    error.statusCode = 409;
    throw error;
  }

  return table;
};

module.exports = {
  isOrderOccupyingTable,
  getAvailableActiveTables,
  getTablesWithOccupancy,
  assertTableAvailable,
};
