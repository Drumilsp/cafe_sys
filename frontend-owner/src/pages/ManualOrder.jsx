import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import { ENABLE_PAYMENT } from '../config/payment';
import './ManualOrder.css';

const ALL = 'All';

const ManualOrder = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('counter');
  const [serviceType, setServiceType] = useState('counter');
  const [tableNumber, setTableNumber] = useState('');
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axios.get('/api/menu?available=true')
      .then((res) => setMenuItems(res.data.data))
      .catch(() => setError('Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    axios.get('/api/tables')
      .then((res) => setTables(res.data.data || []))
      .catch((err) => console.error('Failed to load tables for manual order:', err))
      .finally(() => setTablesLoading(false));
  }, []);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set(menuItems.map((i) => i.category || 'general')))],
    [menuItems]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchCat = activeCategory === ALL || (item.category || 'general') === activeCategory;
      const matchSearch = !term || item.name.toLowerCase().includes(term);
      return matchCat && matchSearch;
    });
  }, [menuItems, activeCategory, search]);

  const changeQty = (id, delta) => {
    setCart((prev) => {
      const next = (prev[id] || 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const cartItems = menuItems.filter((i) => cart[i._id]);
  const total = cartItems.reduce((s, i) => s + i.price * cart[i._id], 0);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cartCount === 0) { setError('Please select at least one item.'); return; }
    if (!customerName.trim()) { setError('Customer name is required.'); return; }
    if (customerPhone.trim() && !/^[0-9]{10}$/.test(customerPhone.trim())) {
      setError('Phone must be exactly 10 digits when provided.');
      return;
    }
    if (serviceType === 'table' && !tableNumber.trim()) {
      setError('Please enter a table number for table delivery.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        paymentMethod: ENABLE_PAYMENT ? paymentMethod : 'counter',
        customerName: customerName.trim(),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        serviceType,
        ...(serviceType === 'table' ? { tableNumber: tableNumber.trim() } : {}),
      };
      const res = await axios.post('/api/orders/manual', payload);
      setSuccess(`Order ${res.data.data.orderId} created successfully.`);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setTableNumber('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
      if (serviceType === 'table') {
        try {
          const res = await axios.get('/api/tables');
          setTables(res.data.data || []);
        } catch (reloadErr) {
          console.error('Failed to refresh tables after manual order error:', reloadErr);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <OwnerLayout title="New Order">
        <div className="mo-loading">Loading menu…</div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout title="New Order">
      <div className="mo-layout">
        {/* ── Left: Item picker ── */}
        <div className="mo-picker">
          <input
            className="mo-search"
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="mo-cat-pills">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`mo-cat-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="mo-empty">No items found.</div>
          ) : (
            <div className="mo-item-grid">
              {filtered.map((item) => {
                const qty = cart[item._id] || 0;
                return (
                  <div
                    key={item._id}
                    className={`mo-item-card ${qty > 0 ? 'selected' : ''}`}
                    onClick={() => changeQty(item._id, 1)}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="mo-item-img" />
                    ) : (
                      <div className="mo-item-img mo-item-img-placeholder">🍽</div>
                    )}
                    <div className="mo-item-info">
                      <div className="mo-item-name">{item.name}</div>
                      <div className="mo-item-price">₹{item.price}</div>
                    </div>
                    {qty === 0 ? (
                      <div className="mo-add-hint">Tap to add</div>
                    ) : (
                      <div className="mo-item-qty-row" onClick={(e) => e.stopPropagation()}>
                        <button className="mo-qty-btn sm" onClick={() => changeQty(item._id, -1)}>−</button>
                        <span className="mo-qty-val">{qty}</span>
                        <button className="mo-qty-btn sm" onClick={() => changeQty(item._id, 1)}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Order panel ── */}
        <form className="mo-panel" onSubmit={handleSubmit}>
          <div className="mo-panel-title">
            Order {cartCount > 0 && <span className="mo-cart-badge">{cartCount}</span>}
          </div>

          {cartItems.length === 0 ? (
            <div className="mo-panel-empty">No items selected yet.</div>
          ) : (
            <div className="mo-order-lines">
              {cartItems.map((item) => (
                <div key={item._id} className="mo-order-line">
                  <span className="mo-line-name">{item.name}</span>
                  <div className="mo-line-qty">
                    <button type="button" className="mo-qty-btn sm" onClick={() => changeQty(item._id, -1)}>−</button>
                    <span className="mo-qty-val">{cart[item._id]}</span>
                    <button type="button" className="mo-qty-btn sm" onClick={() => changeQty(item._id, 1)}>+</button>
                  </div>
                  <span className="mo-line-price">₹{item.price * cart[item._id]}</span>
                </div>
              ))}
            </div>
          )}

          {cartItems.length > 0 && (
            <div className="mo-total-row">
              <span>Total</span>
              <span>₹{total}</span>
            </div>
          )}

          <hr className="mo-divider" />

          <div className="mo-field">
            <label>Customer Name *</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter name"
            />
          </div>

          <div className="mo-field">
            <label>Phone (optional)</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="10-digit number"
              maxLength="10"
            />
          </div>

          {ENABLE_PAYMENT && (
            <div className="mo-radio-group">
              <span className="mo-radio-label">Payment</span>
              <div className="mo-radio-row">
                {[['counter', '💵 Counter'], ['online', '📱 Online']].map(([val, label]) => (
                  <label key={val} className={`mo-radio-btn ${paymentMethod === val ? 'active' : ''}`}>
                    <input type="radio" name="payment" value={val} checked={paymentMethod === val} onChange={() => setPaymentMethod(val)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mo-radio-group">
            <span className="mo-radio-label">Service</span>
            <div className="mo-radio-row">
              {[['counter', '🏪 Counter'], ['table', '🪑 Table']].map(([val, label]) => (
                <label key={val} className={`mo-radio-btn ${serviceType === val ? 'active' : ''}`}>
                  <input type="radio" name="service" value={val} checked={serviceType === val} onChange={() => setServiceType(val)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {serviceType === 'table' && (
            <div className="mo-field">
              <label>Table Number *</label>
              {tablesLoading ? (
                <input type="text" value="Loading tables..." disabled />
              ) : tables.length > 0 ? (
                <select value={tableNumber} onChange={(e) => setTableNumber(e.target.value)}>
                  <option value="">Select a free table</option>
                  {tables.map((table) => (
                    <option key={table._id} value={table.name}>
                      {table.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value="No free tables available" disabled />
              )}
            </div>
          )}

          {error && <div className="mo-error">{error}</div>}
          {success && <div className="mo-success">{success}</div>}

          <button type="submit" className="mo-submit" disabled={submitting || cartCount === 0}>
            {submitting ? 'Creating…' : `Place Order${total > 0 ? ` · ₹${total}` : ''}`}
          </button>
        </form>
      </div>
    </OwnerLayout>
  );
};

export default ManualOrder;
