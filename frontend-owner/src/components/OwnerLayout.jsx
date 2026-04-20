import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OwnerLayout.css';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/menu', label: 'Menu' },
  { to: '/menu/add', label: '+ Add Item' },
  { to: '/tables', label: 'Tables' },
  { to: '/manual-order', label: 'New Order' },
  { to: '/history', label: 'History' },
];

const OwnerLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="owner-layout">
      <header className="owner-header">
        <div className="owner-header-inner">
          <span className="owner-brand">☕ Cafe Owner</span>
          <nav className="owner-nav">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`owner-nav-link ${pathname === n.to ? 'active' : ''}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="owner-header-right">
            <span className="owner-user">{user?.name}</span>
            <Link to="/settings" className={`owner-settings-btn ${pathname === '/settings' ? 'active' : ''}`}>
              <span aria-hidden="true">⚙</span>
              <span>Settings</span>
            </Link>
            <button className="owner-logout-btn" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>
      <main className="owner-main">
        {title && <h1 className="owner-page-title">{title}</h1>}
        {children}
      </main>
    </div>
  );
};

export default OwnerLayout;
