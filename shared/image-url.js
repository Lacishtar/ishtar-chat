/**
 * External decoration image URLs — proxied for OBS Browser Source compatibility.
 */

const ALLOWED_IMAGE_HOSTS = [
  'i.ibb.co',
  'ibb.co',
  'i.imgur.com',
  'imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'raw.githubusercontent.com',
  'images.unsplash.com',
  'placehold.co',
  'placekitten.com',
  'drive.google.com',
  'googleusercontent.com',
  'lh3.googleusercontent.com',
];

/**
 * Automatically converts Google Drive share/view links into direct Google
 * UserContent image CDN links. Leaves non-Drive URLs untouched.
 */
function normalizeGoogleDriveImageUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return urlString;
  const trimmed = urlString.trim();
  // Match Google Drive share/view/open URLs:
  // - https://drive.google.com/file/d/FILE_ID/view...
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?id=FILE_ID
  // - https://drive.google.com/uc?export=view&id=FILE_ID
  const driveRegex = /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^&]+&)*id=))([a-zA-Z0-9_-]+)/i;
  const match = trimmed.match(driveRegex);
  if (match && match[1]) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return trimmed;
}

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '127.0.0.1' || h.startsWith('127.')) return true;
  if (h.startsWith('10.')) return true;
  if (h.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '::1' || h === '[::1]') return true;
  return false;
}

function isAllowedImageUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const normalized = normalizeGoogleDriveImageUrl(urlString);
    const u = new URL(normalized);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (isPrivateHost(host)) return false;
    return ALLOWED_IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch (_err) {
    return false;
  }
}

/** Returns a same-origin proxy path, or '' when the URL is missing/invalid. */
function toImageProxyUrl(rawUrl) {
  const normalized = normalizeGoogleDriveImageUrl(rawUrl);
  if (!isAllowedImageUrl(normalized)) return '';
  return `/image/proxy?url=${encodeURIComponent(normalized)}`;
}

module.exports = {
  ALLOWED_IMAGE_HOSTS,
  normalizeGoogleDriveImageUrl,
  isAllowedImageUrl,
  toImageProxyUrl,
  isPrivateHost,
};

