const fs = require('fs');
const path = require('path');

const THEMES_DIR = path.join(__dirname, '..', 'themes');

function listThemes() {
  return fs
    .readdirSync(THEMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const themeId = entry.name;
      const meta = readThemeConfig(themeId);
      return {
        id: themeId,
        name: meta._label || themeId,
        hasThumbnail: fs.existsSync(path.join(THEMES_DIR, themeId, 'thumbnail.png')),
        // Lets the Theme Gallery render a live color swatch instead of a
        // generic placeholder, without needing a real thumbnail.png per
        // theme — cheap, but keeps the gallery visual-first (§1.1).
        preview: {
          bubbleBg: meta.bubbleBg || 'rgba(22, 25, 31, 0.72)',
          authorColor: meta.authorColor || '#6E56F0',
          textColor: meta.textColor || '#EAECEF',
        },
      };
    });
}

function readThemeConfig(themeId) {
  const configPath = path.join(THEMES_DIR, themeId, 'default-config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    return {};
  }
}

function themeExists(themeId) {
  return fs.existsSync(path.join(THEMES_DIR, themeId, 'template.html'));
}

module.exports = { THEMES_DIR, listThemes, readThemeConfig, themeExists };
