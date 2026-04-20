const mongoose = require('mongoose');

const DB_READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersRegistered = false;

function getDbState() {
  return {
    readyState: mongoose.connection.readyState,
    state: DB_READY_STATES[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
}

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function registerConnectionListeners() {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  mongoose.connection.on('connected', () => {
    const { host, name } = getDbState();
    console.log(`MongoDB connected (${host || 'unknown-host'}/${name || 'unknown-db'})`);
  });

  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    console.error('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
}

async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set. Please configure it in environment variables.');
  }

  registerConnectionListeners();

  mongoose.set('bufferCommands', false);

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });

  return mongoose.connection;
}

module.exports = {
  connectDB,
  getDbState,
  isDbReady,
};
