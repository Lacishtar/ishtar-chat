import { state } from './state.js';
import { resolveEffectiveSlotStyle } from './css-variables.js';

export function getMockAvatarUrl(authorName) {
  let hash = 0;
  for (let i = 0; i < authorName.length; i++) {
    hash = authorName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#5865F2', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'];
  const color = colors[Math.abs(hash) % colors.length];
  const letter = authorName ? authorName.charAt(0).toUpperCase() : 'U';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100%" height="100%" fill="${encodeURIComponent(color)}" /><text x="50%" y="55%" font-family="system-ui, sans-serif" font-size="50" font-weight="bold" fill="white" dominant-baseline="middle" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
}

export function toAvatarProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return '';
    const host = u.hostname.toLowerCase();
    const allowed = ['yt3.ggpht.com', 'yt4.ggpht.com', 'ggpht.com', 'googleusercontent.com', 'ytimg.com'];
    if (!allowed.some((h) => host === h || host.endsWith('.' + h))) return '';
    return `/avatar/proxy?url=${encodeURIComponent(rawUrl)}`;
  } catch (_err) {
    return '';
  }
}

export function applyAvatar(avatarEl, rawUrl) {
  if (!avatarEl) return;
  const effective = resolveEffectiveSlotStyle(state.currentSlotStyle, state.currentConfig, state.currentLayout);
  if (!effective.avatar.visible || !rawUrl) {
    avatarEl.setAttribute('data-hidden', 'true');
    avatarEl.removeAttribute('src');
    return;
  }

  avatarEl.removeAttribute('data-hidden');
  avatarEl.referrerPolicy = 'no-referrer';
  avatarEl.decoding = 'async';

  if (rawUrl.startsWith('mock-avatar:')) {
    const authorName = rawUrl.substring('mock-avatar:'.length);
    avatarEl.src = getMockAvatarUrl(authorName);
    return;
  }

  const proxied = toAvatarProxyUrl(rawUrl);

  if (proxied) {
    avatarEl.onload = () => avatarEl.removeAttribute('data-hidden');
    avatarEl.onerror = () => {
      // Proxy failed (502, token expired, rate-limit) — fall back to the
      // raw URL before giving up entirely. This keeps avatars visible even
      // when the local proxy can't reach the upstream CDN.
      avatarEl.onerror = () => avatarEl.setAttribute('data-hidden', 'true');
      avatarEl.onload = () => avatarEl.removeAttribute('data-hidden');
      avatarEl.referrerPolicy = 'no-referrer';
      avatarEl.src = rawUrl;
    };
    avatarEl.src = proxied;
  } else {
    avatarEl.onerror = () => avatarEl.setAttribute('data-hidden', 'true');
    avatarEl.onload = () => avatarEl.removeAttribute('data-hidden');
    avatarEl.referrerPolicy = 'no-referrer';
    avatarEl.src = rawUrl;
  }
}