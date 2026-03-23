import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Menu.css';
import logo from "../assets/logo.png";

const Menu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [addedItems, setAddedItems] = useState(new Set());
  const [animatingItem, setAnimatingItem] = useState(null);
  const { addToCart, updateQuantity, getTotalItems, cartItems, clearCart } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearCart();
    logout();
    navigate('/login');
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredItems(menuItems.filter((item) => item.available));
    } else {
      setFilteredItems(
        menuItems.filter((item) => item.available && item.category === selectedCategory)
      );
    }
  }, [selectedCategory, menuItems]);

  const fetchMenu = async () => {
    try {
      const response = await axios.get('/api/menu?available=true');
      const items = response.data.data;
      setMenuItems(items);
      const uniqueCategories = ['all', ...new Set(items.map((item) => item.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item) => {
    addToCart(item);
    setAddedItems((prev) => new Set(prev).add(item._id));
    setAnimatingItem(item._id);
    
    // Reset animation after 600ms
    setTimeout(() => {
      setAnimatingItem(null);
    }, 600);
  };

  const handleIncreaseQuantity = (item) => {
    const currentQty = getCartQuantity(item._id);
    updateQuantity(item._id, currentQty + 1);
    setAnimatingItem(item._id);
    setTimeout(() => {
      setAnimatingItem(null);
    }, 300);
  };

  const handleDecreaseQuantity = (item) => {
    const currentQty = getCartQuantity(item._id);
    if (currentQty > 1) {
      updateQuantity(item._id, currentQty - 1);
    } else {
      updateQuantity(item._id, 0); // This will remove from cart
    }
    setAnimatingItem(item._id);
    setTimeout(() => {
      setAnimatingItem(null);
    }, 300);
  };

  const isInCart = (itemId) => {
    return cartItems.some((item) => item.menuItemId === itemId);
  };

  const getCartQuantity = (itemId) => {
    const cartItem = cartItems.find((item) => item.menuItemId === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  if (loading) {
    return (
      <div className="menu-container">
        <div className="loading">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="menu-container">
      <header className="menu-header">
        <div className="header-content">
          <div className="header-left">
            <div className="brand-text">
              <span className="brand-name">Cafe Saarchi</span>
            </div>
            <div className="header-actions">
              {user && (
                <Link to="/my-orders" className="orders-link">
                  My Orders
                </Link>
              )}
              <Link to="/cart" className={`cart-link ${getTotalItems() > 0 ? 'has-items' : ''}`}>
                <span className="cart-icon">🛒</span>
                <span className="cart-text">Cart</span>
                {getTotalItems() > 0 && (
                  <span className="cart-badge animate-bounce">{getTotalItems()}</span>
                )}
              </Link>
              {!user ? (
                <button onClick={() => navigate('/login')} className="login-btn">
                  Login
                </button>
              ) : (
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              )}
            </div>
          </div>
          <div className="header-logo">
            <div className="logo-mark" aria-hidden="true">
              <img className="logo" src={logo} alt="logo"/>
            </div>
          </div>
        </div>
        
      </header>
      {user && <p className="welcome-text">Welcome, {user.name}!</p>}
      <div className="container">
        <div className="category-filter">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            >
              {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {filteredItems.length === 0 ? (
            <div className="empty-state">No items available in this category</div>
          ) : (
            filteredItems.map((item, index) => (
              <div 
                key={item._id} 
                className={`menu-item ${animatingItem === item._id ? 'item-added' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="item-image" />
                )}
                <div className="item-info">
                  <h3>{item.name}</h3>
                  <p className="item-category">{item.category}</p>
                  <p className="item-price">₹{item.price}</p>
                  {isInCart(item._id) ? (
                    <div className="quantity-controls-menu">
                      <button
                        onClick={() => handleDecreaseQuantity(item)}
                        className="qty-btn-menu minus"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="quantity-display">
                        {getCartQuantity(item._id)}
                      </span>
                      <button
                        onClick={() => handleIncreaseQuantity(item)}
                        className="qty-btn-menu plus"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(item)}
                      className={`add-to-cart-btn ${animatingItem === item._id ? 'adding' : ''}`}
                    >
                      {animatingItem === item._id ? 'Adding...' : 'Add to Cart'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Menu;
