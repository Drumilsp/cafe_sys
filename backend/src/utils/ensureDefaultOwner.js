const User = require('../models/User');

async function ensureDefaultOwner() {
  if (process.env.CREATE_DEFAULT_OWNER !== 'true') {
    console.log('Default owner creation disabled; skipping.');
    return;
  }

  const { DEFAULT_OWNER_PHONE, DEFAULT_OWNER_PASSWORD } = process.env;

  if (!DEFAULT_OWNER_PHONE || !DEFAULT_OWNER_PASSWORD) {
    throw new Error(
      'DEFAULT_OWNER_PHONE and DEFAULT_OWNER_PASSWORD are required when CREATE_DEFAULT_OWNER=true'
    );
  }

  const name = process.env.DEFAULT_OWNER_NAME || 'Cafe Owner';
  const username = process.env.DEFAULT_OWNER_USERNAME || DEFAULT_OWNER_PHONE;

  let user = await User.findOne({ phone: DEFAULT_OWNER_PHONE });

  if (!user) {
    user = new User({
      name,
      phone: DEFAULT_OWNER_PHONE,
      role: 'owner',
      username,
      password: DEFAULT_OWNER_PASSWORD,
    });
    await user.save();
    console.log(`Default owner created: ${DEFAULT_OWNER_PHONE}`);
    return;
  }

  user.role = 'owner';
  if (!user.username) {
    user.username = username;
  }

  await user.save();
  console.log(`Default owner already exists: ${DEFAULT_OWNER_PHONE}`);
}

module.exports = ensureDefaultOwner;
