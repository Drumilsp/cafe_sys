import { useEffect, useState } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import { ENABLE_PAYMENT } from '../config/payment';
import './OrderHistory.css';

const STATUS_COLORS = {
  pending: '#f59e0b',
  verifying_payment: '#8b5cf6',
  preparing: '#0ea5e9',
  ready: '#22c55e',
  delivered: '#6b7280',
  collect_payment: '#6b7280',
};

const fmt = (d) =>
  new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    axios.get('/api/orders?sortBy=time&sortOrder=desc')
      .then((res) => setOrders(res.data.data || []))
      .catch((err) => console.error('Failed to fetch order history:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter((o) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      o.orderId?.toLowerCase().includes(term) ||
      o.customer?.name?.toLowerCase().includes(term) ||
      o.customer?.phone?.includes(term)
    );
  });

  const grouped = filtered.reduce((acc, order) => {
    const key = new Date(order.createdAt).toISOString().split('T')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  if (loading) {
    return (
      <OwnerLayout title="Order History">
        <div className="oh-empty">Loading history…</div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout title="Order History">
      <input
        className="oh-search"
        type="text"
        placeholder="Search by order ID, customer name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {sortedDays.length === 0 ? (
        <div className="oh-empty">{search ? 'No orders match your search.' : 'No orders found.'}</div>
      ) : (
        sortedDays.map((dateKey) => {
          const dayOrders = grouped[dateKey];
          const dayTotal = dayOrders.reduce((s, o) => s + o.totalAmount, 0);
          return (
            <section key={dateKey} className="oh-day-section">
              <div className="oh-day-header">
                <span className="oh-day-label">
                  {new Date(dateKey).toLocaleDateString(undefined, {
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </span>
                <span className="oh-day-summary">
                  {dayOrders.length} order{dayOrders.length !== 1 ? 's' : ''} · ₹{dayTotal}
                </span>
              </div>

              <div className="oh-cards">
                {dayOrders.map((order) => (
                  <div key={order._id} className="oh-card">
                    <div className="oh-card-header">
                      <div>
                        <div className="oh-order-id">#{order.orderId}</div>
                        {order.customer && (
                          <div className="oh-customer">
                            {order.customer.name}
                            {order.customer.phone && order.customer.phone !== '0000000000'
                              ? ` · ${order.customer.phone}` : ''}
                          </div>
                        )}
                        <div className="oh-time">{fmt(order.createdAt)}</div>
                      </div>
                      <span
                        className="oh-status-badge"
                        style={{ background: STATUS_COLORS[order.orderStatus] || '#6b7280' }}
                      >
                        {formatStatus(order.orderStatus)}
                      </span>
                    </div>

                    <div className="oh-items">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="oh-item-row">
                          <span>{item.menuItem?.name || 'Item'} × {item.quantity}</span>
                          <span>₹{item.priceAtTime * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    <div className="oh-card-footer">
                      <span className="oh-total">₹{order.totalAmount}</span>
                      <span className="oh-pay-info">
                        {order.paymentMethod === 'online' ? 'Online' : 'Counter'} ·{' '}
                        {!ENABLE_PAYMENT && order.orderStatus === 'delivered'
                          ? 'Collect Payment Pending'
                          : order.paymentStatus === 'paid'
                            ? 'Paid'
                            : 'Pending'}
                        {order.serviceType === 'table' && order.tableNumber
                          ? ` · Table ${order.tableNumber}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </OwnerLayout>
  );
};

export default OrderHistory;
const formatStatus = (status) => {
  if (status === 'verifying_payment') return 'Verifying Payment';
  if (status === 'collect_payment') return 'Collect Payment';
  return status.replace('_', ' ');
};
