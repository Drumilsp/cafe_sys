const axios = require('axios');

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

const sendSms = async (phone, message) => {
  const provider = process.env.SMS_PROVIDER || 'mock';

  if (!phone || !message) {
    throw new Error('Phone and message are required to send SMS');
  }

  if (provider === 'mock') {
    // eslint-disable-next-line no-console
    console.log(`[MOCK SMS] To: ${phone} | Message: ${message}`);
    return;
  }

  if (provider === 'fast2sms') {
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      throw new Error('FAST2SMS_API_KEY is not configured');
    }

    try {
      await axios.post(
        FAST2SMS_URL,
        {
          route: 'dlt',
          message,
          language: 'english',
          flash: 0,
          numbers: phone,
        },
        {
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Fast2SMS error:', error.response?.data || error.message);
      throw new Error('Failed to send SMS via Fast2SMS');
    }
  }

  // Fallback: treat unknown provider as mock
  // eslint-disable-next-line no-console
  console.log(`[MOCK SMS - unknown provider] To: ${phone} | Message: ${message}`);
};

module.exports = {
  sendSms,
};

