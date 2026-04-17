require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Menu = require('../models/Menu');

// Add or remove keywords here.
// If a menu item's name contains any of these words, it will be marked as non-veg.
const NON_VEG_KEYWORDS = [
  'chicken',
  'mutton',
  'fish',
  'prawn',
  'egg',
  'keema',
  'bacon',
  'ham',
];

async function updateVegField() {
  try {
    await connectDB();

    const menuItems = await Menu.find({});

    let updatedCount = 0;

    for (const item of menuItems) {
      const itemName = String(item.name || '').toLowerCase();
      const isNonVeg = NON_VEG_KEYWORDS.some((keyword) =>
        itemName.includes(keyword.toLowerCase())
      );

      const nextIsVeg = !isNonVeg;

      if (item.isVeg !== nextIsVeg) {
        item.isVeg = nextIsVeg;
        await item.save();
        updatedCount += 1;
        console.log(
          `Updated "${item.name}" -> ${nextIsVeg ? 'veg' : 'non-veg'}`
        );
      }
    }

    console.log(`Done. Updated ${updatedCount} menu item(s).`);
    console.log(
      `Used non-veg keywords: ${NON_VEG_KEYWORDS.join(', ')}`
    );
  } catch (error) {
    console.error('Failed to update veg field:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

updateVegField();
