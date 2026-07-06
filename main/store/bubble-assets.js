const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const THEMES_DIR = path.join(__dirname, '..', '..', 'themes');

function getBubbleAssetsDir() {
  return path.join(app.getPath('userData'), 'bubble-assets');
}

function decodePngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl || '');
  if (!match) throw new Error('invalid_png');
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length === 0) throw new Error('empty_png');
  return buffer;
}

function saveBubbleImage(dataUrl) {
  const buffer = decodePngDataUrl(dataUrl);
  const filename = `${crypto.randomUUID()}.png`;
  const dir = getBubbleAssetsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/bubble-assets/${filename}`;
}

/**
 * Saves bubble PNG into themes/<themeId>/assets/ and returns a public URL path.
 */
function saveBubbleImageToTheme(themeId, dataUrl) {
  if (!themeId || typeof themeId !== 'string') throw new Error('invalid_theme');
  const buffer = decodePngDataUrl(dataUrl);
  const assetsDir = path.join(THEMES_DIR, themeId, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const filename = `chat-bubble-${crypto.randomUUID().slice(0, 8)}.png`;
  fs.writeFileSync(path.join(assetsDir, filename), buffer);

  return `/themes/${themeId}/assets/${filename}`;
}

function removeBubbleImage(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return;

  if (imagePath.startsWith('/bubble-assets/')) {
    const file = path.join(getBubbleAssetsDir(), path.basename(imagePath));
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (err) {
      console.error('[bubble-assets] failed to delete userData asset:', err.message || err);
    }
    return;
  }

  if (imagePath.startsWith('/themes/')) {
    const rel = imagePath.replace(/^\/themes\//, '');
    const file = path.join(THEMES_DIR, rel.replace(/\//g, path.sep));
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (err) {
      console.error('[bubble-assets] failed to delete theme asset:', err.message || err);
    }
  }
}

/**
 * Persists bubble image path into themes/<themeId>/bubble-config.json for theme JSON compat.
 */
function writeThemeBubbleJson(themeId, bubblePartial) {
  if (!themeId) return;
  const themeDir = path.join(THEMES_DIR, themeId);
  if (!fs.existsSync(themeDir)) return;

  const target = path.join(themeDir, 'bubble-config.json');
  let existing = {};
  if (fs.existsSync(target)) {
    try {
      existing = JSON.parse(fs.readFileSync(target, 'utf-8'));
    } catch (_err) {
      existing = {};
    }
  }

  const next = { ...existing, ...bubblePartial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(target, JSON.stringify(next, null, 2));
}

module.exports = {
  getBubbleAssetsDir,
  saveBubbleImage,
  saveBubbleImageToTheme,
  removeBubbleImage,
  writeThemeBubbleJson,
  THEMES_DIR,
};
