const User = require('../models/User');

async function ensureDefaultOwner() {
  const phone = process.env.DEFAULT_OWNER_PHONE || '1234567890';
  const password = process.env.DEFAULT_OWNER_PASSWORD || 'owner123';
  const name = process.env.DEFAULT_OWNER_NAME || 'Cafe Owner';
  const username = process.env.DEFAULT_OWNER_USERNAME || '1234567890';

  let user = await User.findOne({ phone });

  if (!user) {
    user = new User({
      name,
      phone,
      role: 'owner',
      username,
      password,
    });
  } else {
    user.role = 'owner';
    if (!user.username) {
      user.username = username;
    }
    if (password) {
      user.password = password;
    }
  }

  await user.save();

  // eslint-disable-next-line no-console
  console.log(
    `Default owner ready. Phone: ${phone}, Password: ${password} (dev only)`
  );
}

module.exports = ensureDefaultOwner;
