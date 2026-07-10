// Pure helpers with no dependency on shared state or the DOM (aside from
// applyInlineStyle, which just writes to an element it's handed).

export function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

export function offsetVar(value) {
  return value != null && Number.isFinite(Number(value)) ? px(value) : 'auto';
}

export function zIndexVar(value) {
  return value != null && Number.isFinite(Number(value)) ? String(value) : 'auto';
}

// Keep in sync with shared/image-url.js#toImageProxyUrl.
export function toImageProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return '';
    const host = u.hostname.toLowerCase();
    const allowed = [
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
    if (!allowed.some((h) => host === h || host.endsWith('.' + h))) return '';
    return `/image/proxy?url=${encodeURIComponent(rawUrl)}`;
  } catch (_err) {
    return '';
  }
}

export function applyInlineStyle(el, styleMap) {
  Object.entries(styleMap).forEach(([key, value]) => {
    el.style[key] = value;
  });
}

// Keep in sync with shared/decoration-config.js#compileLayerInlineStyle.
const PLACEMENT_CORNERS = {
  'top-left': { left: '0', top: '0' },
  'top-right': { left: '100%', top: '0' },
  'bottom-left': { left: '0', top: '100%' },
  'bottom-right': { left: '100%', top: '100%' },
  'top-center': { left: '50%', top: '0' },
  'bottom-center': { left: '50%', top: '100%' },
  'center-left': { left: '0', top: '50%' },
  'center-right': { left: '100%', top: '50%' },
  center: { left: '50%', top: '50%' },
};

export function compileLayerInlineStyle(layer) {
  const translateX = Number(layer.translateX) || 0;
  const translateY = Number(layer.translateY) || 0;
  const rotate = Number(layer.rotate) || 0;
  const zIndex = layer.zIndex != null ? Number(layer.zIndex) : 5;
  const opacity = layer.opacity != null ? Number(layer.opacity) : 1;
  const width = layer.width != null ? Number(layer.width) : 48;
  const height = layer.height != null ? Number(layer.height) : 48;
  const placement = layer.placement || 'custom';
  const base = {
    position: 'absolute',
    right: 'auto',
    bottom: 'auto',
    zIndex: String(zIndex),
    opacity: String(opacity),
    width: `${width}px`,
    height: `${height}px`,
    objectFit: 'contain',
    pointerEvents: 'none',
  };
  const rot = `${rotate}deg`;

  if (placement === 'custom') {
    return {
      ...base,
      left: '0',
      top: '0',
      transform: `translate(${translateX}px, ${translateY}px) rotate(${rot})`,
      transformOrigin: 'center center',
    };
  }

  const corner = PLACEMENT_CORNERS[placement] || PLACEMENT_CORNERS['bottom-left'];
  return {
    ...base,
    left: corner.left,
    top: corner.top,
    transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) rotate(${rot})`,
    transformOrigin: 'center center',
  };
}
