import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Cart.css';

const Cart = () => {
  const { cartItems, updateQuantity, removeFromCart, getTotalPrice } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!user) {
      navigate('/login?redirect=/checkout');
      return;
    }
    navigate('/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className="cart-container">
        <div className="container">
          <h1>Your Cart</h1>
          <div className="empty-cart">
            <p>Your cart is empty</p>
            <Link to="/menu" className="btn-primary">
              Browse Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-container">
      <div className="container">
        <h1>Your Cart</h1>
        <div className="cart-items">
          {cartItems.map((item) => (
            <div key={item.menuItemId} className="cart-item">
              <div className="item-details">
                <h3>{item.menuItem.name}</h3>
                <p className="item-price">₹{item.menuItem.price} each</p>
              </div>
              <div className="quantity-controls">
                <button
                  onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                  className="qty-btn"
                >
                  -
                </button>
                <span className="quantity">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                  className="qty-btn"
                >
                  +
                </button>
              </div>
              <div className="item-total">
                ₹{item.menuItem.price * item.quantity}
              </div>
              <button
                onClick={() => removeFromCart(item.menuItemId)}
                className="remove-btn"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="cart-summary">
          <div className="summary-row">
            <span>Total:</span>
            <span className="total-amount">₹{getTotalPrice()}</span>
          </div>
          <button onClick={handleCheckout} className="btn-primary checkout-btn">
            {user ? 'Proceed to Checkout' : 'Login to Checkout'}
          </button>
          {!user && (
            <p className="login-prompt">
              Please login to proceed with checkout
            </p>
          )}
          <Link to="/menu" className="btn-secondary">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Cart;
