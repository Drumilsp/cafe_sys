/**
 * Script: otpAnalysis.js
 *
 * Shows how many OTPs were generated per day for the last 7 days.
 *
 * How it works:
 *   Every time a customer requests an OTP, their User document is saved
 *   (new user created OR existing user updated), which bumps `updatedAt`.
 *   We count customer users whose `updatedAt` falls within each day window.
 *
 * NOTE: This is a best-effort count. If a user updated their profile for
 * any other reason it would also count. But since customers only interact
 * via OTP login, updatedAt reliably reflects OTP requests.
 *
 * Run: node backend/src/scripts/otpAnalysis.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

function dayRange(daysAgo) {
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function run() {
  try {
    await connectDB();

    console.log('\n📊  OTP Generation Analysis — Last 7 Days\n');
    console.log('─'.repeat(50));

    let grandTotal = 0;

    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const { start, end } = dayRange(daysAgo);
      const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : formatDate(start);

      // Count new users created (first-time OTP) in this window
      const newUsers = await User.countDocuments({
        role: 'customer',
        createdAt: { $gte: start, $lte: end },
      });

      // Count existing users who requested OTP again (updatedAt in window, but created before)
      const returningUsers = await User.countDocuments({
        role: 'customer',
        createdAt: { $lt: start },
        updatedAt: { $gte: start, $lte: end },
      });

      const total = newUsers + returningUsers;
      grandTotal += total;

      console.log(`\n  ${label} — ${formatDate(start)}`);
      console.log(`    New users (first OTP)     : ${newUsers}`);
      console.log(`    Returning users (re-OTP)  : ${returningUsers}`);
      console.log(`    ─────────────────────────`);
      console.log(`    Total OTPs generated      : ${total}`);
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`  Combined total (7 days)     : ${grandTotal}`);
    console.log('─'.repeat(50) + '\n');

  } catch (err) {
    console.error('Script failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
