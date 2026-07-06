/**
 * YouTube avatar URLs are hotlink-protected — OBS Browser Source often blocks
 * them (empty/broken img) while Electron's preview iframe may still load them.
 * Proxy allowed hosts through the local HTTP server so preview and OBS behave
 * identically.
 */

const ALLOWED_AVATAR_HOSTS = [
  'yt3.ggpht.com',
  'yt4.ggpht.com',
  'ggpht.com',
  'googleusercontent.com',
  'ytimg.com',
];

function isAllowedAvatarUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_AVATAR_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch (_err) {
    return false;
  }
}

/** Returns a same-origin proxy path, or '' when the URL is missing/invalid. */
function toAvatarProxyUrl(rawUrl) {
  if (!isAllowedAvatarUrl(rawUrl)) return '';
  return `/avatar/proxy?url=${encodeURIComponent(rawUrl)}`;
}

module.exports = { ALLOWED_AVATAR_HOSTS, isAllowedAvatarUrl, toAvatarProxyUrl };
