const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { getDbState, isDbReady } = require('./config/db');

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

app.use((req, res, next) => {
  req.requestStartedAt = Date.now();
  next();
});

/* ===================== HEALTH CHECK ===================== */
app.get('/health', (req, res) => {
  const db = getDbState();
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: db,
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

app.use('/api', (req, res, next) => {
  if (isDbReady()) {
    return next();
  }

  const db = getDbState();
  console.error(
    `Rejecting ${req.method} ${req.originalUrl} because database is ${db.state}`
  );

  return res.status(503).json({
    status: 'error',
    message: 'Service is warming up. Please retry in a few seconds.',
    code: 'DB_NOT_READY',
  });
});

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
  const durationMs = req.requestStartedAt ? Date.now() - req.requestStartedAt : null;

  console.error('Unhandled error:', {
    method: req.method,
    path: req.originalUrl,
    durationMs,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  res.status(err.status || 500).json({
    status: 'error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message,
  });
});

module.exports = app;
