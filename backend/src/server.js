require('dotenv').config();
const { connectDB, getDbState } = require('./config/db');
const ensureDefaultOwner = require('./utils/ensureDefaultOwner');
const app = require('./app');

// Use port 3000 for Fly.io
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    console.log('Starting server...');

    // Connect to database
    await connectDB();

    // Ensure default data
    await ensureDefaultOwner();
    console.log('Default owner ensured');

    // Start server (important: 0.0.0.0)
    app.listen(PORT, '0.0.0.0', () => {
      const db = getDbState();
      console.log(`Server started on port ${PORT}`);
      console.log(`Startup status: db=${db.state}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
