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
];

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
    const u = new URL(urlString);
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
  if (!isAllowedImageUrl(rawUrl)) return '';
  return `/image/proxy?url=${encodeURIComponent(rawUrl)}`;
}

module.exports = { ALLOWED_IMAGE_HOSTS, isAllowedImageUrl, toImageProxyUrl, isPrivateHost };
