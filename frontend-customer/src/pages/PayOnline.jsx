import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import './PayOnline.css';

const UPI_APPS = [
  { id: 'gpay',    name: 'Google Pay', emoji: '🟢', scheme: (p) => `tez://upi/pay?${p}` },
  { id: 'phonepe', name: 'PhonePe',    emoji: '🟣', scheme: (p) => `phonepe://pay?${p}` },
  { id: 'paytm',   name: 'Paytm',      emoji: '🔵', scheme: (p) => `paytmmp://pay?${p}` },
  { id: 'bhim',    name: 'BHIM',       emoji: '🟠', scheme: (p) => `bhim://pay?${p}` },
];

const PayOnline = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const upiTapped = useRef(false);

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

  // When user returns from UPI app, auto-submit and navigate to order confirmation
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && upiTapped.current) {
        upiTapped.current = false;
        try {
          await axios.patch(`/api/orders/${orderId}/customer-paid`);
          navigate(`/order-confirmation/${orderId}`);
        } catch (e) {
          setError(e.response?.data?.message || 'Unable to submit payment for verification');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [orderId, navigate]);

  const handleUpiAppClick = (e) => {
    if (!upiId) {
      e.preventDefault();
      setError('UPI is not configured. Please contact staff.');
      return;
    }
    upiTapped.current = true;
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
          <p className="payonline-subtitle">Tap a UPI app to pay. You'll be redirected automatically after payment.</p>

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
                  onClick={handleUpiAppClick}
                >
                  <span className="upi-app-emoji">{app.emoji}</span>
                  <span className="upi-app-name">{app.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* QR Code */}
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
