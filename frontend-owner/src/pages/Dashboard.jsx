import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import './Dashboard.css';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [payAtCounterOrders, setPayAtCounterOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'prep' | 'completed'
  const [viewMode, setViewMode] = useState('normal'); // 'normal' | 'kitchen'
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');

  useEffect(() => {
    fetchAllData(true);
    const interval = setInterval(() => fetchAllData(false), 10000);
    return () => clearInterval(interval);
  }, [activeTab, statusFilter, paymentFilter, sortBy, sortOrder]);

  const fetchAllData = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setIsInitialLoad(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      // Pay-at-counter unpaid orders
      const counterRes = await axios.get('/api/orders?paymentMethod=counter&paymentStatus=pending&sortBy=time&sortOrder=desc');
      setPayAtCounterOrders(counterRes.data.data);

      // Active orders (exclude counter-unpaid AND online-pending)
      const params = new URLSearchParams();
      params.append('excludeCounterUnpaid', '1');
      params.append('excludeOnlinePending', '1');
      params.append('todayOnly', '1');
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentFilter !== 'all') params.append('paymentMethod', paymentFilter);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      const res = await axios.get(`/api/orders?${params.toString()}`);
      // Filter out delivered from active list
      setOrders((res.data.data || []).filter(o => o.orderStatus !== 'delivered'));

      // Completed (delivered) orders — most recent first
      const completedRes = await axios.get('/api/orders?status=delivered&sortBy=time&sortOrder=desc');
      setCompletedOrders(completedRes.data.data || []);

    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      if (isInitial) {
        setLoading(false);
        setIsInitialLoad(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  const markAsPaid = async (order) => {
    setMarkingPaidId(order._id);
    try {
      await axios.patch(`/api/orders/${order._id}/payment`, { paymentStatus: 'paid' });
      fetchAllData();
    } catch (error) {
      console.error('Failed to mark as paid:', error);
      alert('Failed to mark as paid');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(`/api/orders/${orderId}/status`, { orderStatus: newStatus });
      fetchAllData();
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      verifying_payment: '#6f42c1',
      preparing: '#17a2b8',
      ready: '#28a745',
      delivered: '#6c757d',
    };
    return colors[status] || '#6c757d';
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      pending: 'preparing',
      verifying_payment: 'preparing',
      preparing: 'ready',
      ready: 'delivered',
    };
    return statusFlow[currentStatus];
  };

  const toggleItemPrepared = async (orderId, itemId, prepared) => {
    try {
      await axios.patch(`/api/orders/${orderId}/items/${itemId}/prepared`, { prepared });
      fetchAllData();
    } catch (error) {
      console.error('Failed to update item prepared state:', error);
      alert('Failed to update item prepared state');
    }
  };

  const getItemPrepared = (item) => typeof item.prepared === 'boolean' ? item.prepared : false;

  const toggleGroupPrepared = async (group, prepared) => {
    try {
      await Promise.all(
        group.rows.map((row) =>
          axios.patch(`/api/orders/${row.orderId}/items/${row.itemId}/prepared`, { prepared })
        )
      );
      fetchAllData();
    } catch (error) {
      console.error('Failed to update group prepared state:', error);
      alert('Failed to update prepared state for this item group');
    }
  };

  const buildPrepItems = (sourceOrders = orders) => {
    const map = new Map();
    sourceOrders
      .filter((order) => order.orderStatus !== 'delivered')
      .forEach((order) => {
        order.items.forEach((item) => {
          if (!item.menuItem) return;
          const key = item.menuItem._id || String(item.menuItem);
          if (!map.has(key)) {
            map.set(key, { menuItemId: key, name: item.menuItem.name, totalQuantity: 0, rows: [] });
          }
          const entry = map.get(key);
          entry.totalQuantity += item.quantity;
          entry.rows.push({
            orderId: order._id,
            orderDisplayId: order.orderId,
            customerName: order.customer?.name,
            quantity: item.quantity,
            itemId: item._id,
            prepared: getItemPrepared(item),
          });
        });
      });
    return Array.from(map.values());
  };

  // Search filtering — partial match on orderId (suffix match)
  const filterBySearch = (list, term) => {
    if (!term.trim()) return list;
    const t = term.trim().toLowerCase();
    return list.filter((o) => {
      const id = (o.orderId || '').toLowerCase();
      // Match suffix: "1" matches "0001", "01" matches "0001"
      const numericPart = id.split('-').pop() || id;
      return numericPart.endsWith(t) || id.includes(t) ||
        o.customer?.name?.toLowerCase().includes(t) ||
        o.customer?.phone?.includes(t);
    });
  };

  const filteredOrders = useMemo(() => filterBySearch(orders, orderSearch), [orders, orderSearch]);
  const filteredCompleted = useMemo(() => filterBySearch(completedOrders, completedSearch), [completedOrders, completedSearch]);

  const kitchenOrders = orders.filter(
    (o) => o.orderStatus === 'pending' || o.orderStatus === 'verifying_payment' || o.orderStatus === 'preparing'
  );

  if (loading && isInitialLoad) {
    return (
      <OwnerLayout title="Dashboard">
        <div className="loading">Loading orders...</div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout title={<>Dashboard {isRefreshing && <span className="refresh-indicator">⟳</span>}</>}>
      <div className="db-toolbar">
        <button onClick={() => fetchAllData(false)} className="refresh-btn" title="Refresh">
          ⟳ Refresh
        </button>
      </div>
      <div>
        <div className="view-toggle">
          <button className={viewMode === 'normal' ? 'active' : ''} onClick={() => setViewMode('normal')}>
            Normal View
          </button>
          <button className={viewMode === 'kitchen' ? 'active' : ''} onClick={() => setViewMode('kitchen')}>
            Kitchen Mode
          </button>
        </div>

        {viewMode === 'normal' && (
          <div className="main-tabs">
            <button onClick={() => setActiveTab('active')} className={activeTab === 'active' ? 'active' : ''}>
              Active Orders
            </button>
            <button onClick={() => setActiveTab('prep')} className={activeTab === 'prep' ? 'active' : ''}>
              Items to Prepare
            </button>
            <button onClick={() => setActiveTab('completed')} className={activeTab === 'completed' ? 'active' : ''}>
              Completed Orders {completedOrders.length > 0 && <span className="tab-count">{completedOrders.length}</span>}
            </button>
          </div>
        )}

        {/* ── PAY AT COUNTER SECTION ── */}
        {viewMode === 'normal' && activeTab === 'active' && payAtCounterOrders.length > 0 && (
          <section className="pay-at-counter-section">
            <h2 className="section-title">
              <span className="section-icon">💰</span> Pay at Counter — Collect Payment First
            </h2>
            <p className="section-hint">Mark as paid when you receive payment; the order will move to the main list.</p>
            <div className="orders-list pay-at-counter-list">
              {payAtCounterOrders.map((order) => (
                <div key={order._id} className="order-card counter-card">
                  <div className="order-header">
                    <div>
                      <h3>Order #{order.orderId}</h3>
                      <p className="customer-info">{order.customer.name} — {order.customer.phone}</p>
                      <p className="order-time">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                    </span>
                  </div>
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="order-item">
                        <span>{item.menuItem.name} x {item.quantity}</span>
                        <span>₹{item.priceAtTime * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="order-footer">
                    <div className="order-total">
                      <span>Total to collect:</span>
                      <span>₹{order.totalAmount}</span>
                    </div>
                    <div className="order-actions">
                      <button onClick={() => markAsPaid(order)} disabled={markingPaidId === order._id} className="mark-paid-btn">
                        {markingPaidId === order._id ? '…' : '✓ Mark as Paid'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── ACTIVE ORDERS HEADER + SEARCH ── */}
        {viewMode === 'normal' && activeTab === 'active' && (
          <>
            <div className="main-list-header">
              <h2 className="section-title main-list-title">Main Orders</h2>
              <button type="button" className="filters-toggle-btn" onClick={() => setShowFilters((prev) => !prev)}>
                {showFilters ? 'Hide Filters & Sort' : 'Show Filters & Sort'}
              </button>
            </div>
            <input
              className="order-search-input"
              type="text"
              placeholder="Search by order ID, name or phone…"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
          </>
        )}

        {/* ── FILTERS ── */}
        {viewMode === 'normal' && activeTab === 'active' && showFilters && (
          <div className="filters-section">
            <div className="filter-group">
              <label className="filter-label">Status:</label>
              <div className="filter-tabs">
                {['all', 'pending', 'preparing', 'ready', 'verifying_payment'].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'active' : ''}>
                    {s === 'all' ? 'All' : s === 'verifying_payment' ? 'Verifying Payment' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Payment:</label>
              <div className="filter-tabs">
                {[['all', 'All'], ['counter', 'Pay at Counter'], ['online', 'Online Paid']].map(([val, label]) => (
                  <button key={val} onClick={() => setPaymentFilter(val)} className={paymentFilter === val ? 'active' : ''}>{label}</button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Sort By:</label>
              <div className="sort-controls">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                  <option value="time">Time</option>
                  <option value="price">Price</option>
                  <option value="volume">Order Volume</option>
                </select>
                <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="sort-order-btn" title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVE ORDERS LIST ── */}
        {viewMode === 'normal' && activeTab === 'active' && (
          <div className="orders-list">
            {filteredOrders.length === 0 ? (
              <div className="empty-state">
                {orderSearch ? 'No orders match your search.' : 'No active orders. Pay-at-counter orders appear above after marking paid.'}
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div key={order._id} className="order-card">
                  <div className="order-header">
                    <div>
                      <h3>Order #{order.orderId}</h3>
                      <p className="customer-info">{order.customer.name} - {order.customer.phone}</p>
                      <p className="order-time">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                    </span>
                  </div>
                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="order-item">
                        <label className="order-item-label">
                          <input type="checkbox" checked={getItemPrepared(item)} onChange={(e) => toggleItemPrepared(order._id, item._id, e.target.checked)} />
                          <span>{item.menuItem.name} x {item.quantity}</span>
                        </label>
                        <span>₹{item.priceAtTime * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="order-footer">
                    <div className="order-total">
                      <span>Total:</span>
                      <span>₹{order.totalAmount}</span>
                    </div>
                    <div className="payment-info">
                      <span>Payment:</span>
                      <span className={order.paymentMethod === 'counter' && order.paymentStatus === 'pending' ? 'payment-warning' : ''}>
                        {order.paymentMethod === 'online' ? 'Online' : 'Counter'} — {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                      {order.paymentMethod === 'counter' && order.paymentStatus === 'pending' && (
                        <span className="counter-badge">💰 Collect Payment</span>
                      )}
                    </div>
                  </div>
                  {order.orderStatus === 'verifying_payment' && (
                    <div className="order-actions">
                      <button onClick={() => updateOrderStatus(order._id, 'preparing')} className="status-btn">Verify Payment</button>
                    </div>
                  )}
                  {order.orderStatus !== 'delivered' && order.orderStatus !== 'verifying_payment' && (
                    <div className="order-actions">
                      <button onClick={() => updateOrderStatus(order._id, getNextStatus(order.orderStatus))} className="status-btn">
                        Mark as {getNextStatus(order.orderStatus)?.charAt(0).toUpperCase() + getNextStatus(order.orderStatus)?.slice(1)}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ITEMS TO PREPARE ── */}
        {viewMode === 'normal' && activeTab === 'prep' && (
          <section className="prep-section">
            <h2 className="section-title">Items to Prepare</h2>
            <p className="section-hint">Combined view of all active orders grouped by item.</p>
            <div className="orders-list">
              {orders.length === 0 ? (
                <div className="empty-state">No active orders to prepare.</div>
              ) : (
                buildPrepItems().map((group) => (
                  <div key={group.menuItemId} className="order-card prep-card">
                    <div className="order-header">
                      <div>
                        <h3>
                          <label className="order-item-label">
                            <input type="checkbox" checked={group.rows.every((row) => row.prepared)} onChange={(e) => toggleGroupPrepared(group, e.target.checked)} />
                            <span>{group.name}</span>
                          </label>
                        </h3>
                        <p className="order-time">Total to prepare: {group.totalQuantity}</p>
                      </div>
                    </div>
                    <div className="order-items">
                      {group.rows.map((row) => (
                        <div key={row.itemId} className="order-item">
                          <label className="order-item-label">
                            <input type="checkbox" checked={row.prepared} onChange={(e) => toggleItemPrepared(row.orderId, row.itemId, e.target.checked)} />
                            <span>{row.quantity} for {row.customerName || 'Customer'} (Order {row.orderDisplayId})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ── COMPLETED ORDERS ── */}
        {viewMode === 'normal' && activeTab === 'completed' && (
          <section className="completed-section">
            <h2 className="section-title">Completed Orders</h2>
            <input
              className="order-search-input"
              type="text"
              placeholder="Search by order ID, name or phone…"
              value={completedSearch}
              onChange={(e) => setCompletedSearch(e.target.value)}
            />
            {filteredCompleted.length === 0 ? (
              <div className="empty-state">{completedSearch ? 'No orders match your search.' : 'No completed orders yet.'}</div>
            ) : (
              <div className="orders-list">
                {filteredCompleted.map((order) => (
                  <div key={order._id} className="order-card completed-card">
                    <div className="order-header">
                      <div>
                        <h3>Order #{order.orderId}</h3>
                        <p className="customer-info">{order.customer.name} — {order.customer.phone}</p>
                        <p className="order-time">{new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                        Delivered
                      </span>
                    </div>
                    <div className="order-items">
                      {order.items.map((item, index) => (
                        <div key={index} className="order-item">
                          <span>{item.menuItem?.name} x {item.quantity}</span>
                          <span>₹{item.priceAtTime * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="order-footer">
                      <div className="order-total">
                        <span>Total:</span>
                        <span>₹{order.totalAmount}</span>
                      </div>
                      <div className="payment-info">
                        <span>{order.paymentMethod === 'online' ? 'Online' : 'Counter'} — Paid</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── KITCHEN MODE ── */}
        {viewMode === 'kitchen' && (
          <section className="kitchen-section">
            <h2 className="section-title">Kitchen Mode</h2>
            <p className="section-hint">Pending and preparing orders only.</p>
            <div className="kitchen-orders">
              {kitchenOrders.length === 0 ? (
                <div className="empty-state">No pending or preparing orders.</div>
              ) : (
                kitchenOrders.map((order) => (
                  <div key={order._id} className="kitchen-card">
                    <div className="kitchen-header">
                      <div>
                        <h3>Order #{order.orderId}</h3>
                        {order.tableNumber && <p className="kitchen-table">Table: {order.tableNumber}</p>}
                      </div>
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(order.orderStatus) }}>
                        {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                      </span>
                    </div>
                    <div className="kitchen-items">
                      {order.items.map((item, index) => (
                        <div key={index} className="kitchen-item">
                          <label className="order-item-label">
                            <input type="checkbox" checked={getItemPrepared(item)} onChange={(e) => toggleItemPrepared(order._id, item._id, e.target.checked)} />
                            <span className="kitchen-item-name">{item.menuItem.name}</span>
                          </label>
                          <span className="kitchen-item-qty">x {item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="kitchen-actions">
                      {order.orderStatus === 'verifying_payment' && (
                        <button className="kitchen-btn start" onClick={() => updateOrderStatus(order._id, 'preparing')}>Verify Payment</button>
                      )}
                      {order.orderStatus === 'pending' && (
                        <button className="kitchen-btn start" onClick={() => updateOrderStatus(order._id, 'preparing')}>Start Preparing</button>
                      )}
                      {order.orderStatus === 'preparing' && (
                        <button className="kitchen-btn ready" onClick={() => updateOrderStatus(order._id, 'ready')}>Mark as Ready</button>
                      )}
                      {order.orderStatus === 'ready' && (
                        <button className="kitchen-btn ready" onClick={() => updateOrderStatus(order._id, 'delivered')}>Mark as Delivered</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {kitchenOrders.length > 0 && (
              <section className="prep-section">
                <h2 className="section-title">Items to Prepare (Kitchen View)</h2>
                <div className="orders-list">
                  {buildPrepItems(kitchenOrders).map((group) => (
                    <div key={group.menuItemId} className="order-card prep-card">
                      <div className="order-header">
                        <div>
                          <h3>
                            <label className="order-item-label">
                              <input type="checkbox" checked={group.rows.every((r) => r.prepared)} onChange={(e) => toggleGroupPrepared(group, e.target.checked)} />
                              <span>{group.name}</span>
                            </label>
                          </h3>
                          <p className="order-time">Total to prepare: {group.totalQuantity}</p>
                        </div>
                      </div>
                      <div className="order-items">
                        {group.rows.map((row) => (
                          <div key={row.itemId} className="order-item">
                            <label className="order-item-label">
                              <input type="checkbox" checked={row.prepared} onChange={(e) => toggleItemPrepared(row.orderId, row.itemId, e.target.checked)} />
                              <span>{row.quantity} for {row.customerName || 'Customer'} (Order {row.orderDisplayId})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        )}
      </div>
    </OwnerLayout>
  );
};

export default Dashboard;
