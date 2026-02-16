const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

/* ===================== SECURITY HEADERS ===================== */
app.use(helmet());

/* ===================== BODY PARSER ===================== */
app.use(express.json({ limit: '10kb' }));

/* ===================== CORS ===================== */
app.use(cors());

/* ===================== LOGGING ===================== */
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

/* ===================== HEALTH CHECK ===================== */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ===================== RATE LIMIT (API ONLY) ===================== */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

app.use('/api', apiLimiter);

/* ===================== API ROUTES ===================== */
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);

/* ===================== ROOT ===================== */
app.get('/', (req, res) => {
  res.json({ message: 'Cafe Ordering Backend Running' });
});

/* ===================== ERROR HANDLING ===================== */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
  });
});

/* ===================== 404 ===================== */
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;
