require('dotenv').config();
const connectDB = require('./config/db');
const ensureDefaultOwner = require('./utils/ensureDefaultOwner');
const app = require('./app');

// Use port 3000 for Fly.io
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    console.log("Starting server...");

    // Connect to database
    await connectDB();
    console.log("Database connected");

    // Ensure default data
    await ensureDefaultOwner();
    console.log("Default owner ensured");

    // Start server (important: 0.0.0.0)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();