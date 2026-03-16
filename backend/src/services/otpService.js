const { sendSms } = require('./smsService');

function getProvider() {
  return (process.env.SMS_PROVIDER || 'mock').toLowerCase();
}

/**
 * Centralized OTP delivery.
 *
 * Providers:
 * - mock: logs OTP to console
 * - website: returns OTP to the caller (frontend can display)
 * - fast2sms: sends OTP via Fast2SMS (no OTP returned)
 */
async function sendOtp({ phone, otp, message }) {
  const provider = getProvider();

  if (!phone || !otp) {
    throw new Error('phone and otp are required');
  }

  const finalMessage =
    message || `Your OTP for Cafe login is ${otp}. Valid for 10 minutes.`;

  if (provider === 'website') {
    return { otp };
  }

  if (provider === 'mock') {
    // eslint-disable-next-line no-console
    console.log(`[MOCK OTP] To: ${phone} | OTP: ${otp}`);
    return {};
  }

  if (provider === 'fast2sms') {
    await sendSms(phone, finalMessage);
    return {};
  }

  // Unknown provider: default to mock behavior (safe)
  // eslint-disable-next-line no-console
  console.log(`[MOCK OTP - unknown provider "${provider}"] To: ${phone} | OTP: ${otp}`);
  return {};
}

module.exports = {
  sendOtp,
};

