import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import './Checkout.css';

const Checkout = () => {
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('counter');
  const [serviceType, setServiceType] = useState('counter'); // 'counter' | 'table'
  const [tableNumber, setTableNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState('');

  useEffect(() => {
    const fetchTables = async () => {
      setTablesLoading(true);
      setTablesError('');
      try {
        const res = await axios.get('/api/tables');
        setTables(res.data.data || []);
      } catch (err) {
        console.error('Failed to load tables:', err);
        setTablesError('Unable to load tables. You can tell staff your table.');
      } finally {
        setTablesLoading(false);
      }
    };

    fetchTables();
  }, []);

  const handleCheckout = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate cart is not empty
    if (!cartItems || cartItems.length === 0) {
      setError('Your cart is empty. Please add items before checkout.');
      setLoading(false);
      return;
    }

    if (serviceType === 'table' && !tableNumber.trim()) {
      setError('Please enter your table number for table delivery.');
      setLoading(false);
      return;
    }

    try {
      const orderData = {
        items: cartItems.map((item) => {
          if (!item.menuItemId) {
            throw new Error(`Invalid cart item: missing menuItemId`);
          }
          return {
            menuItemId: item.menuItemId,
            quantity: item.quantity,
          };
        }),
        paymentMethod,
        serviceType,
        ...(serviceType === 'table' ? { tableNumber: tableNumber.trim() } : {}),
      };

      console.log('Submitting order:', orderData);
      const response = await axios.post('/api/orders', orderData);
      clearCart();
      const created = response.data.data;
      if (paymentMethod === 'online') {
        navigate(`/pay-online/${created.orderId}`);
      } else {
        navigate(`/order-confirmation/${created.orderId}`);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to place order';
      setError(errorMessage);
      
      // If it's a validation error, show more details
      if (err.response?.data?.errors) {
        setError(errorMessage + ': ' + err.response.data.errors.join(', '));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <div className="container">
        <h1>Checkout</h1>
        <form onSubmit={handleCheckout} className="checkout-form">
          <div className="order-summary">
            <h2>Order Summary</h2>
            {cartItems.map((item) => (
              <div key={item.menuItemId} className="summary-item">
                <span>
                  {item.menuItem.name} x {item.quantity}
                </span>
                <span>₹{item.menuItem.price * item.quantity}</span>
              </div>
            ))}
            <div className="summary-total">
              <span>Total:</span>
              <span>₹{getTotalPrice()}</span>
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
                {tablesLoading ? (
                  <p className="section-hint">Loading tables...</p>
                ) : tables.length > 0 ? (
                  <select
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                  >
                    <option value="">Select your table</option>
                    {tables.map((table) => (
                      <option key={table._id} value={table.name}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Enter your table number (e.g. 5 or A2)"
                  />
                )}
                {tablesError && <p className="section-hint">{tablesError}</p>}
              </div>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Placing Order...' : 'Place Order'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
