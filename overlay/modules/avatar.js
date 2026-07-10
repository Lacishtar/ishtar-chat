import { state } from './state.js';
import { resolveEffectiveSlotStyle } from './css-variables.js';

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
  const effective = resolveEffectiveSlotStyle(state.currentSlotStyle, state.currentConfig);
  if (!effective.avatar.visible || state.currentConfig.showAvatar === false || !rawUrl) {
    avatarEl.setAttribute('data-hidden', 'true');
    avatarEl.removeAttribute('src');
    return;
  }

  avatarEl.removeAttribute('data-hidden');
  avatarEl.referrerPolicy = 'no-referrer';
  avatarEl.decoding = 'async';

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
