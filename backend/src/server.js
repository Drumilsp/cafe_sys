require('dotenv').config();
const connectDB = require('./config/db');
console.log('connectDB value:', connectDB);

const app = require('./app');

const PORT = process.env.PORT || 4000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
