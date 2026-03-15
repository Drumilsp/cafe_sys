require('dotenv').config();
const connectDB = require('./config/db');
const ensureDefaultOwner = require('./utils/ensureDefaultOwner');
const app = require('./app');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    await ensureDefaultOwner();

    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

