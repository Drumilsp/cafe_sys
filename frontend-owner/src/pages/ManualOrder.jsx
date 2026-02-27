import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const ManualOrder = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('counter');
  const [serviceType, setServiceType] = useState('counter');
  const [tableNumber, setTableNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const response = await axios.get('/api/menu?available=true');
        setMenuItems(response.data.data);
      } catch (err) {
        console.error('Failed to fetch menu:', err);
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, []);

  const handleQuantityChange = (itemId, delta) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(current + delta, 0);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const handleQuickAdd = (itemId) => {
    handleQuantityChange(itemId, 1);
  };

  const filteredMenuItems = menuItems.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      (item.category || '').toLowerCase().includes(term)
    );
  });

  const totalAmount = menuItems.reduce((sum, item) => {
    const qty = selectedItems[item._id] || 0;
    return sum + item.price * qty;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const itemsPayload = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    if (itemsPayload.length === 0) {
      setError('Please select at least one item.');
      setSubmitting(false);
      return;
    }

    if (!customerName.trim()) {
      setError('Customer name is required.');
      setSubmitting(false);
      return;
    }

    if (customerPhone.trim() && !/^[0-9]{10}$/.test(customerPhone.trim())) {
      setError('Customer phone must be exactly 10 digits when provided.');
      setSubmitting(false);
      return;
    }

    if (serviceType === 'table' && !tableNumber.trim()) {
      setError('Please enter table number for table delivery.');
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        items: itemsPayload,
        paymentMethod,
        customerName: customerName.trim(),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        serviceType,
        ...(serviceType === 'table' ? { tableNumber: tableNumber.trim() } : {}),
      };

      const response = await axios.post('/api/orders/manual', payload);
      setSuccess(`Order ${response.data.data.orderId} created successfully.`);
      setSelectedItems({});
      setCustomerName('');
      setCustomerPhone('');
      setTableNumber('');
    } catch (err) {
      console.error('Failed to create manual order:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to create manual order';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Create Manual Order</h1>
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
        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="order-summary">
            <h2>Select Items</h2>
            <div className="form-group">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or category"
              />
            </div>
            {filteredMenuItems.length === 0 ? (
              <div className="empty-state">No menu items available.</div>
            ) : (
              filteredMenuItems.map((item) => {
                const qty = selectedItems[item._id] || 0;
                return (
                  <div
                    key={item._id}
                    className="summary-item"
                    onClick={() => handleQuickAdd(item._id)}
                  >
                    <span>
                      {item.name} ({item.category}) - ₹{item.price}
                    </span>
                    <div className="quantity-controls-menu">
                      <button
                        type="button"
                        className="qty-btn-menu minus"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(item._id, -1);
                        }}
                      >
                        −
                      </button>
                      <span className="quantity-display">{qty}</span>
                      <button
                        type="button"
                        className="qty-btn-menu plus"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuantityChange(item._id, 1);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
            )}
            <div className="summary-total">
              <span>Total:</span>
              <span>₹{totalAmount}</span>
            </div>
          </div>

          <div className="payment-section">
            <h2>Customer Details</h2>
            <div className="form-group">
              <label>Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                required
              />
            </div>
            <div className="form-group">
              <label>Customer Phone (optional)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10 digit phone number (optional)"
                maxLength="10"
                pattern="[0-9]{10}"
              />
            </div>
          </div>

          <div className="payment-section">
            <h2>Payment Method</h2>
            <div className="payment-options">
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="counter"
                  checked={paymentMethod === 'counter'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <span>Pay at Counter</span>
              </label>
              <label className="payment-option">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <span>Pay Online (Mock)</span>
              </label>
            </div>
          </div>

          <div className="payment-section">
            <h2>Delivery / Service</h2>
            <div className="payment-options">
              <label className="payment-option">
                <input
                  type="radio"
                  name="serviceType"
                  value="counter"
                  checked={serviceType === 'counter'}
                  onChange={(e) => setServiceType(e.target.value)}
                />
                <span>Pick up at Counter</span>
              </label>
              <label className="payment-option">
                <input
                  type="radio"
                  name="serviceType"
                  value="table"
                  checked={serviceType === 'table'}
                  onChange={(e) => setServiceType(e.target.value)}
                />
                <span>Table Delivery</span>
              </label>
            </div>
            {serviceType === 'table' && (
              <div className="form-group">
                <label>Table Number</label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Enter table number"
                />
              </div>
            )}
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating Order...' : 'Create Order'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualOrder;

