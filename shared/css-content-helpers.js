// css-content-helpers.js — badge/CSS-content helpers shared by

const { toImageProxyUrl } = require('./image-url');

function isImageUrlValue(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

// badgeBefore/badgeAfter (member/Mốc tháng), and Fan Service's superchat
function quoteCssContent(value) {
  if (!value) return 'none';
  const str = String(value).trim();
  if (!str) return 'none';
  if (isImageUrlValue(str)) {
    return `url("${toImageProxyUrl(str) || str}")`;
  }
  return `"${str.replace(/"/g, '\\"')}"`;
}

function getBadgeImageSrc(value) {
  if (!isImageUrlValue(value)) return null;
  const str = String(value).trim();
  return toImageProxyUrl(str) || str;
}

const FONT_WEIGHT_MAP = {
  normal: '400',
  bold: '700',
  extrabold: '900',
};

module.exports = {
  isImageUrlValue,
  quoteCssContent,
  getBadgeImageSrc,
  FONT_WEIGHT_MAP,
};
