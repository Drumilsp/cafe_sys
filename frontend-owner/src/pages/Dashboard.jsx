import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [payAtCounterOrders, setPayAtCounterOrders] = useState([]);
  const [eodOrders, setEodOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'eod'
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    // Initial load
    fetchAllData(true);
    
    // Set up polling - refresh every 10 seconds
    const interval = setInterval(() => {
      fetchAllData(false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [activeTab, statusFilter, paymentFilter, sortBy, sortOrder]);

  const fetchAllData = async (isInitial = false) => {
    // Only show loading spinner on initial load
    if (isInitial) {
      setLoading(true);
      setIsInitialLoad(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const counterRes = await axios.get('/api/orders?paymentMethod=counter&paymentStatus=pending&sortBy=time&sortOrder=desc');
      setPayAtCounterOrders(counterRes.data.data);

      if (activeTab === 'active') {
        const params = new URLSearchParams();
        params.append('excludeCounterUnpaid', '1');
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (paymentFilter !== 'all') params.append('paymentMethod', paymentFilter);
        params.append('sortBy', sortBy);
        params.append('sortOrder', sortOrder);
        const res = await axios.get(`/api/orders?${params.toString()}`);
        setOrders(res.data.data);
      }

      if (activeTab === 'eod') {
        const eodRes = await axios.get('/api/orders?status=completed&paymentStatus=paid&sortBy=time&sortOrder=desc');
        setEodOrders(eodRes.data.data);
      }
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

  const fetchOrders = () => fetchAllData();

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
      preparing: '#17a2b8',
      ready: '#28a745',
      completed: '#6c757d',
    };
    return colors[status] || '#6c757d';
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'completed',
    };
    return statusFlow[currentStatus];
  };

  if (loading && isInitialLoad) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Owner Dashboard {isRefreshing && <span className="refresh-indicator">⟳</span>}</h1>
          <div className="header-actions">
            <button onClick={() => fetchAllData(false)} className="refresh-btn" title="Refresh">
              ⟳ Refresh
            </button>
            <Link to="/menu" className="nav-link">Manage Menu</Link>
            <span className="user-name">Welcome, {user?.name}</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <div className="container">
        <div className="main-tabs">
          <button
            onClick={() => setActiveTab('active')}
            className={activeTab === 'active' ? 'active' : ''}
          >
            Active Orders
          </button>
          <button
            onClick={() => setActiveTab('eod')}
            className={activeTab === 'eod' ? 'active' : ''}
          >
            Paid & Completed (EOD)
          </button>
        </div>

        {activeTab === 'active' && payAtCounterOrders.length > 0 && (
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
                      <p className="customer-info">
                        {order.customer.name} — {order.customer.phone}
                      </p>
                      <p className="order-time">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
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
                      <button
                        onClick={() => markAsPaid(order)}
                        disabled={markingPaidId === order._id}
                        className="mark-paid-btn"
                      >
                        {markingPaidId === order._id ? '…' : '✓ Mark as Paid'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'active' && (
          <h2 className="section-title main-list-title">Main Orders</h2>
        )}

        {activeTab === 'active' && (
        <div className="filters-section">
          <div className="filter-group">
            <label className="filter-label">Status:</label>
            <div className="filter-tabs">
              <button
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? 'active' : ''}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={statusFilter === 'pending' ? 'active' : ''}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('preparing')}
                className={statusFilter === 'preparing' ? 'active' : ''}
              >
                Preparing
              </button>
              <button
                onClick={() => setStatusFilter('ready')}
                className={statusFilter === 'ready' ? 'active' : ''}
              >
                Ready
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={statusFilter === 'completed' ? 'active' : ''}
              >
                Completed
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Payment:</label>
            <div className="filter-tabs">
              <button
                onClick={() => setPaymentFilter('all')}
                className={paymentFilter === 'all' ? 'active' : ''}
              >
                All
              </button>
              <button
                onClick={() => setPaymentFilter('counter')}
                className={paymentFilter === 'counter' ? 'active' : ''}
              >
                Pay at Counter
              </button>
              <button
                onClick={() => setPaymentFilter('online')}
                className={paymentFilter === 'online' ? 'active' : ''}
              >
                Online Paid
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Sort By:</label>
            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="time">Time</option>
                <option value="price">Price</option>
                <option value="volume">Order Volume</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="sort-order-btn"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'active' && (
        <div className="orders-list">
          {orders.length === 0 ? (
            <div className="empty-state">No orders in main list. Pay-at-counter orders appear above after you mark them paid.</div>
          ) : (
            orders.map((order) => (
              <div key={order._id} className="order-card">
                <div className="order-header">
                  <div>
                    <h3>Order #{order.orderId}</h3>
                    <p className="customer-info">
                      {order.customer.name} - {order.customer.phone}
                    </p>
                    <p className="order-time">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(order.orderStatus) }}
                  >
                    {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                  </span>
                </div>

                <div className="order-items">
                  {order.items.map((item, index) => (
                    <div key={index} className="order-item">
                      <span>
                        {item.menuItem.name} x {item.quantity}
                      </span>
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
                      {order.paymentMethod === 'online' ? 'Online' : 'Counter'} -{' '}
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                    {order.paymentMethod === 'counter' && order.paymentStatus === 'pending' && (
                      <span className="counter-badge">💰 Collect Payment</span>
                    )}
                  </div>
                </div>

                {order.orderStatus !== 'completed' && (
                  <div className="order-actions">
                    <button
                      onClick={() => updateOrderStatus(order._id, getNextStatus(order.orderStatus))}
                      className="status-btn"
                    >
                      Mark as {getNextStatus(order.orderStatus)?.charAt(0).toUpperCase() + getNextStatus(order.orderStatus)?.slice(1)}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        )}

        {activeTab === 'eod' && (
          <section className="eod-section">
            <h2 className="section-title">Paid & Completed — End of Day</h2>
            <p className="section-hint">All orders that are paid and completed. Use this for EOD reconciliation.</p>
            <div className="orders-list">
              {eodOrders.length === 0 ? (
                <div className="empty-state">No paid & completed orders yet.</div>
              ) : (
                eodOrders.map((order) => (
                  <div key={order._id} className="order-card eod-card">
                    <div className="order-header">
                      <div>
                        <h3>Order #{order.orderId}</h3>
                        <p className="customer-info">
                          {order.customer.name} — {order.customer.phone}
                        </p>
                        <p className="order-time">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
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
                        <span>Total:</span>
                        <span>₹{order.totalAmount}</span>
                      </div>
                      <div className="payment-info">
                        <span>{order.paymentMethod === 'online' ? 'Online' : 'Counter'} — Paid</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
