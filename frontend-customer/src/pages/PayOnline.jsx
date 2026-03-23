import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import './PayOnline.css';

const UPI_APPS = [
  {
    id: 'gpay',
    name: 'Google Pay',
    emoji: '🟢',
    scheme: (params) => `tez://upi/pay?${params}`,
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    emoji: '🟣',
    scheme: (params) => `phonepe://pay?${params}`,
  },
  {
    id: 'paytm',
    name: 'Paytm',
    emoji: '🔵',
    scheme: (params) => `paytmmp://pay?${params}`,
  },
  {
    id: 'bhim',
    name: 'BHIM',
    emoji: '🟠',
    scheme: (params) => `bhim://pay?${params}`,
  },
];

const PayOnline = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const upiId = import.meta.env.VITE_UPI_ID;
  const cafeName = import.meta.env.VITE_CAFE_NAME || 'Cafe';

  const upiParams = useMemo(() => {
    if (!order) return '';
    const amount = Number(order.totalAmount || 0).toFixed(0);
    return new URLSearchParams({
      pa: upiId || '',
      pn: cafeName,
      am: amount,
      cu: 'INR',
      tn: order.orderId,
    }).toString();
  }, [order, upiId, cafeName]);

  const genericUpiLink = useMemo(() => (upiParams ? `upi://pay?${upiParams}` : ''), [upiParams]);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`/api/orders/${orderId}`);
        setOrder(res.data.data);
      } catch (e) {
        setError(e.response?.data?.message || 'Unable to load order');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    const run = async () => {
      if (!genericUpiLink) return;
      try {
        const url = await QRCode.toDataURL(genericUpiLink, { margin: 1, width: 220 });
        setQrDataUrl(url);
      } catch {
        setQrDataUrl('');
      }
    };
    run();
  }, [genericUpiLink]);

  const handlePaid = async () => {
    try {
      await axios.patch(`/api/orders/${orderId}/customer-paid`);
      navigate(`/order-confirmation/${orderId}`);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to submit payment for verification');
    }
  };

  const handleUpiAppClick = (e, app) => {
    if (!upiId) {
      e.preventDefault();
      setError('UPI is not configured. Please contact staff.');
      return;
    }
    // Let the deep link open; if app not installed, browser handles gracefully
  };

  if (loading) {
    return (
      <div className="payonline-container">
        <div className="container">
          <div className="loading">Loading payment page...</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="payonline-container">
        <div className="container">
          <div className="error">{error || 'Order not found'}</div>
          <Link to="/menu" className="btn-primary">Back to Menu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="payonline-container">
      <div className="container">
        <div className="payonline-card">
          <h1>Pay Online</h1>
          <p className="payonline-subtitle">Tap a UPI app below to pay instantly.</p>

          {error && <div className="error">{error}</div>}

          {/* Order Summary */}
          <div className="payonline-details">
            <div className="detail-row">
              <span className="label">Order ID</span>
              <span className="value">{order.orderId}</span>
            </div>
            <div className="detail-row">
              <span className="label">Table</span>
              <span className="value">{order.tableNumber || 'Counter'}</span>
            </div>
            <div className="detail-row total">
              <span className="label">Total</span>
              <span className="value">₹{order.totalAmount}</span>
            </div>
          </div>

          <div className="payonline-items">
            <h2>Items</h2>
            {order.items.map((it) => (
              <div key={it._id} className="item-row">
                <span>{it.menuItem?.name} x {it.quantity}</span>
                <span>₹{it.priceAtTime * it.quantity}</span>
              </div>
            ))}
          </div>

          {/* UPI App Buttons */}
          <div className="upi-apps-section">
            <h2>Pay with UPI App</h2>
            <div className="upi-apps-grid">
              {UPI_APPS.map((app) => (
                <a
                  key={app.id}
                  className="upi-app-btn"
                  href={app.scheme(upiParams)}
                  onClick={(e) => handleUpiAppClick(e, app)}
                >
                  <span className="upi-app-emoji">{app.emoji}</span>
                  <span className="upi-app-name">{app.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* I Have Paid */}
          <div className="payonline-paid-section">
            <p className="paid-hint">After completing payment in your UPI app, tap below:</p>
            <button type="button" className="btn-paid" onClick={handlePaid}>
              ✓ I HAVE PAID
            </button>
          </div>

          {/* QR Code (existing, preserved) */}
          <div className="payonline-qr">
            <h2>Or Scan QR Code</h2>
            {qrDataUrl ? (
              <img className="qr-img" src={qrDataUrl} alt="UPI QR Code" />
            ) : (
              <p className="text-muted">QR unavailable</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayOnline;
