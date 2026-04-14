import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ENABLE_PAYMENT } from '../config/payment';
import './OrderConfirmation.css';

const OrderConfirmation = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await axios.get(`/api/orders/${orderId}`);
      setOrder(response.data.data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status) => {
    const order = ENABLE_PAYMENT
      ? ['pending', 'verifying_payment', 'preparing', 'ready', 'delivered']
      : ['pending', 'preparing', 'ready', 'delivered'];
    if (status === 'collect_payment') {
      return order.length - 1;
    }
    return order.indexOf(status);
  };

  const getStatusLabel = (status) => {
    const map = {
      pending: 'Pending',
      preparing: 'Preparing',
      ready: 'Ready',
      delivered: 'Delivered',
      collect_payment: 'Payment Collected',
    };
    if (ENABLE_PAYMENT) {
      map.verifying_payment = 'Verifying Payment';
    }
    return map[status] || status;
  };

  const renderProgress = (status) => {
    const steps = ENABLE_PAYMENT
      ? ['Pending', 'Verifying Payment', 'Preparing', 'Ready', 'Delivered']
      : ['Pending', 'Preparing', 'Ready', 'Delivered'];
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

  if (loading && !order) {
    return (
      <div className="confirmation-container">
        <div className="loading">Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="confirmation-container">
        <div className="error">Order not found</div>
        <Link to="/menu" className="btn-primary">Back to Menu</Link>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: '#ffc107',
      verifying_payment: '#6f42c1',
      preparing: '#17a2b8',
      ready: '#28a745',
      delivered: '#6c757d',
      collect_payment: '#6c757d',
    };
    return colors[status] || '#6c757d';
  };

  const showPayAtCounter = !ENABLE_PAYMENT && order.paymentMethod === 'counter' && ['delivered', 'collect_payment'].includes(order.orderStatus);

  return (
    <div className="confirmation-container">
      <div className="container">
        <div className="confirmation-card">
          <div className="success-icon">✓</div>
          <h1>Order Confirmed</h1>
          <div className="order-id">
            <strong>Order ID:</strong> {order.orderId}
          </div>

          <div className="order-status">
            <span
              className="status-badge"
              style={{ backgroundColor: getStatusColor(order.orderStatus) }}
            >
              {getStatusLabel(order.orderStatus)}
            </span>
          </div>

          {renderProgress(order.orderStatus)}

          <div className="order-details">
            <h2>Order Details</h2>
            {order.items.map((item, index) => (
              <div key={index} className="detail-item">
                <span>
                  {item.menuItem.name} x {item.quantity}
                </span>
                <span>₹{item.priceAtTime * item.quantity}</span>
              </div>
            ))}
            <div className="detail-total">
              <span>Total Amount:</span>
              <span>₹{order.totalAmount}</span>
            </div>
            <div className="payment-info">
              <span>Payment Method:</span>
              <span>{order.paymentMethod === 'online' ? 'Online' : 'Pay at Counter'}</span>
            </div>
            {ENABLE_PAYMENT && (
              <div className="payment-info">
                <span>Payment Status:</span>
                <span>{order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}</span>
              </div>
            )}
            {showPayAtCounter && (
              <div className="payment-info">
                <span>Payment:</span>
                <span>💰 Pay at Counter</span>
              </div>
            )}
          </div>

          <div className="actions">
            <Link to="/menu" className="btn-primary">
              Order More
            </Link>
            <Link to="/my-orders" className="btn-secondary">
              View All Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;
