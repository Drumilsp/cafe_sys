import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get('/api/orders?sortBy=time&sortOrder=desc');
        setOrders(res.data.data || []);
      } catch (err) {
        console.error('Failed to fetch order history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const groupByDay = (list) => {
    const map = new Map();
    list.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey).push(order);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
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

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading history...</div>
      </div>
    );
  }

  const grouped = groupByDay(orders);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Order History</h1>
          <div className="header-actions">
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
            <Link to="/menu" className="nav-link">
              Manage Menu
            </Link>
            <span className="user-name">Welcome, {user?.name}</span>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        {grouped.length === 0 ? (
          <div className="empty-state">No orders found in history.</div>
        ) : (
          grouped.map(([dateKey, dayOrders]) => (
            <section key={dateKey} className="eod-section">
              <h2 className="section-title">
                {new Date(dateKey).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </h2>
              <div className="orders-list">
                {dayOrders.map((order) => (
                  <div key={order._id} className="order-card eod-card">
                    <div className="order-header">
                      <div>
                        <h3>Order #{order.orderId}</h3>
                        {order.customer && (
                          <p className="customer-info">
                            {order.customer.name} — {order.customer.phone}
                          </p>
                        )}
                        <p className="order-time">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(order.orderStatus) }}
                      >
                        {order.orderStatus.charAt(0).toUpperCase() +
                          order.orderStatus.slice(1)}
                      </span>
                    </div>
                    <div className="order-items">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="order-item">
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
                        <span>
                          {order.paymentMethod === 'online' ? 'Online' : 'Counter'} —{' '}
                          {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default OrderHistory;

