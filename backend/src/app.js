const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

/* ===================== SECURITY HEADERS ===================== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

/* ===================== BODY PARSER ===================== */
app.use(express.json({ limit: '10kb' }));

/* ===================== CORS ===================== */
const allowedOrigins = [];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

if (process.env.CORS_ORIGINS) {
  allowedOrigins.push(
    ...process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  );
}

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : undefined,
    credentials: true,
  })
);

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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Try again later.',
});

app.use('/api/auth', authLimiter);

/* ===================== API ROUTES ===================== */
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const tableRoutes = require('./routes/tableRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);

/* ===================== 404 ===================== */
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

/* ===================== ERROR HANDLING ===================== */
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(err.status || 500).json({
    status: 'error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message,
  });
});

module.exports = app;
