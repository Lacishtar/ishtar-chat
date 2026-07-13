const fs = require('fs');
const path = require('path');

const THEMES_DIR = path.join(__dirname, '..', 'themes');

function readThemeConfig(themeId) {
  const configPath = path.join(THEMES_DIR, themeId, 'default-config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    return {};
  }
}

module.exports = { THEMES_DIR, readThemeConfig };
