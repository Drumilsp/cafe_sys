# QR-Based Cafe Ordering System

A production-ready, scalable QR-based cafe ordering system with separate customer and owner interfaces.

## 🏗️ Project Structure

```
.
├── backend/                 # Node.js + Express backend
│   ├── src/
│   │   ├── config/         # Database configuration
│   │   ├── models/         # Mongoose models (User, Menu, Order)
│   │   ├── controllers/   # Route controllers
│   │   ├── routes/         # API routes
│   │   ├── middleware/    # Auth middleware
│   │   ├── app.js         # Express app setup
│   │   └── server.js      # Server entry point
│   ├── .env               # Environment variables
│   └── package.json
├── frontend-customer/      # Customer-facing React app
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── context/       # React contexts (Auth, Cart)
│   │   └── App.jsx
│   └── package.json
└── frontend-owner/         # Owner dashboard React app
    ├── src/
    │   ├── pages/         # Dashboard & Menu Management
    │   ├── components/    # Reusable components
    │   ├── context/       # Auth context
    │   └── App.jsx
    └── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

4. Update `.env` with your MongoDB connection string and JWT secret:
```env
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key-min-32-chars
PORT=4000
```

5. Start the backend server:
```bash
npm run dev
```

Backend will run on `http://localhost:4000`

### Customer Frontend Setup

1. Navigate to customer frontend:
```bash
cd frontend-customer
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Customer app will run on `http://localhost:3000`

### Owner Frontend Setup

1. Navigate to owner frontend:
```bash
cd frontend-owner
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

Owner app will run on `http://localhost:3001`

## 🔐 Authentication

### OTP System (Mock)

For MVP, the system uses a mock OTP system:
- **OTP Code**: Always use `1234` for testing
- OTP expires in 10 minutes
- In production, integrate with SMS service (Twilio, AWS SNS, etc.)

### User Roles

- **Customer**: Can browse menu, place orders, view order status
- **Owner**: Can manage menu, view all orders, update order status

**Note**: To create an owner account, you need to manually update the user role in MongoDB:
```javascript
db.users.updateOne(
  { phone: "1234567890" },
  { $set: { role: "owner" } }
)
```

## 📡 API Endpoints

### Public Endpoints

- `GET /api/menu` - Get all menu items
- `GET /api/menu?available=true` - Get only available items
- `POST /api/auth/request-otp` - Request OTP
- `POST /api/auth/verify-otp` - Verify OTP and login

### Customer Endpoints (Protected)

- `POST /api/orders` - Create new order
- `GET /api/orders/my` - Get customer's orders
- `GET /api/orders/:id` - Get order details

### Owner Endpoints (Protected)

- `GET /api/orders` - Get all orders
- `GET /api/orders?status=pending` - Filter orders by status
- `PATCH /api/orders/:id/status` - Update order status
- `POST /api/menu` - Add menu item
- `PUT /api/menu/:id` - Update menu item
- `PATCH /api/menu/:id/availability` - Toggle item availability

## 🗄️ Database Models

### User
- `name` (String, required)
- `phone` (String, required, unique)
- `role` (Enum: 'customer' | 'owner')
- `otp` (Object: code, expiresAt)

### Menu
- `name` (String, required)
- `price` (Number, required, min: 0)
- `available` (Boolean, default: true)
- `category` (String)
- `imageUrl` (String)

### Order
- `orderId` (String, unique, indexed)
- `customer` (Reference to User)
- `items` (Array of { menuItem, quantity, priceAtTime })
- `totalAmount` (Number)
- `paymentMethod` (Enum: 'online' | 'counter')
- `paymentStatus` (Enum: 'pending' | 'paid')
- `orderStatus` (Enum: 'pending' | 'preparing' | 'ready' | 'completed')

## 🎨 Features

### Customer Features
- ✅ Phone-based login with OTP
- ✅ Browse menu with category filters
- ✅ Add items to cart
- ✅ Checkout with payment method selection
- ✅ Real-time order status tracking (polling)
- ✅ View order history

### Owner Features
- ✅ Owner dashboard with order management
- ✅ Filter orders by status
- ✅ Update order status (pending → preparing → ready → completed)
- ✅ Menu management (add, edit, toggle availability)
- ✅ View customer information for each order

## 🔒 Security Features

- ✅ Helmet.js for security headers
- ✅ CORS configuration
- ✅ Rate limiting (300 requests per 15 minutes)
- ✅ JWT-based authentication
- ✅ Role-based access control
- ✅ Input validation
- ✅ MongoDB injection protection (Mongoose)

## ☁️ Deployment

### Backend (Render)

1. Connect your GitHub repository
2. Set build command: `cd backend && npm install`
3. Set start command: `cd backend && node src/server.js`
4. Add environment variables in Render dashboard

### Frontend (Vercel/Netlify)

1. Connect repository
2. Set build directory: `frontend-customer` or `frontend-owner`
3. Set build command: `npm run build`
4. Set output directory: `dist`
5. Add environment variable: `VITE_API_URL=https://your-backend-url.com`

### MongoDB Atlas

1. Create free cluster
2. Get connection string
3. Add to backend `.env` file
4. Whitelist IP addresses (0.0.0.0/0 for Render)

## 🧪 Testing

### Test OTP Flow

1. Use any 10-digit phone number
2. Enter name and phone
3. Use OTP: `1234`
4. Login successfully

### Test Order Flow

1. Login as customer
2. Add items to cart
3. Proceed to checkout
4. Select payment method
5. Place order
6. View order confirmation with Order ID

### Test Owner Flow

1. Create owner account (update MongoDB)
2. Login as owner
3. View dashboard with orders
4. Update order status
5. Manage menu items

## 📝 Environment Variables

### Backend (.env)

```env
MONGO_URI=mongodb+srv://...
PORT=4000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
NODE_ENV=production
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Frontend (Vite)

Create `.env` files in frontend directories:
```env
VITE_API_URL=http://localhost:4000
```

## 🚧 Future Enhancements

- [ ] Real SMS OTP integration
- [ ] WebSocket for real-time updates
- [ ] Payment gateway integration (Razorpay/Stripe)
- [ ] Image upload via Cloudinary
- [ ] Multi-cafe support
- [ ] Table number assignment
- [ ] Analytics dashboard
- [ ] Push notifications
- [ ] Admin panel

## 📄 License

ISC

## 👥 Support

For issues or questions, please open an issue on GitHub.
