import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import './MyOrders.css';

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reorderError, setReorderError] = useState('');
  const navigate = useNavigate();
  const { addToCart, updateQuantity, clearCart } = useCart();

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/orders/my');
      setOrders(response.data.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
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

  const getStatusIndex = (status) => {
    const order = ['pending', 'verifying_payment', 'preparing', 'ready', 'delivered'];
    return order.indexOf(status);
  };

  const getStatusLabel = (status) => {
    const map = {
      pending: 'Pending',
      verifying_payment: 'Verifying Payment',
      preparing: 'Preparing',
      ready: 'Ready',
      delivered: 'Delivered',
    };
    return map[status] || status;
  };

  const renderProgress = (status) => {
    const steps = ['Pending', 'Verifying Payment', 'Preparing', 'Ready', 'Delivered'];
    const currentIndex = getStatusIndex(status);

    return (
      <div className="status-progress">
        {steps.map((label, index) => {
          const stepKey = label.toLowerCase();
          const isCompleted = index < currentIndex;
          const isActive = index === currentIndex;
          return (
            <div key={stepKey} className={`status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
              <div className="status-circle" />
              <span className="status-label">{label}</span>
              {index < steps.length - 1 && <div className="status-line" />}
            </div>
          );
        })}
      </div>
    );
  };

  const handleReorder = async (order) => {
    try {
      setReorderError('');
      // Fetch current available menu
      const res = await axios.get('/api/menu?available=true');
      const available = res.data.data || [];
      const menuMap = new Map(available.map((item) => [item._id, item]));

      const unavailableNames = [];

      clearCart();

      order.items.forEach((orderItem) => {
        const menuItemId = orderItem.menuItem._id || orderItem.menuItem;
        const menuItem = menuMap.get(menuItemId);
        if (!menuItem) {
          unavailableNames.push(orderItem.menuItem.name);
          return;
        }
        addToCart(menuItem);
        updateQuantity(menuItem._id, orderItem.quantity);
      });

      if (unavailableNames.length > 0) {
        setReorderError(
          `Some items are no longer available and were skipped: ${unavailableNames.join(', ')}`
        );
      }

      navigate('/cart');
    } catch (error) {
      console.error('Failed to reorder:', error);
      setReorderError('Unable to reorder this order right now. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="orders-container">
        <div className="loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <div className="container">
        <div className="orders-header">
          <h1>My Orders</h1>
          <Link to="/menu" className="btn-secondary">Back to Menu</Link>
        </div>

        {reorderError && <div className="error">{reorderError}</div>}

        {orders.length === 0 ? (
          <div className="empty-orders">
            <p>You haven't placed any orders yet</p>
            <Link to="/menu" className="btn-primary">Browse Menu</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order._id} className="order-card">
                <div className="order-header">
                  <div>
                    <h3>Order #{order.orderId}</h3>
                    <p className="order-date">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(order.orderStatus) }}
                  >
                    {getStatusLabel(order.orderStatus)}
                  </span>
                </div>

                {renderProgress(order.orderStatus)}

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
                  <div className="payment-method">
                    {order.paymentMethod === 'online' ? 'Paid Online' : 'Pay at Counter'}
                  </div>
                  <button
                    type="button"
                    className="btn-primary reorder-btn"
                    onClick={() => handleReorder(order)}
                  >
                    Reorder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
