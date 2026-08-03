
import { state, listEl } from './state.js';
import { applyInlineStyle, compileLayerInlineStyle, toImageProxyUrl } from './utils.js';
import { stickerPoolManager } from './pool/StickerPool.js';

function ensurePositionedAnchor(el) {
  if (!el) return null;
  if (getComputedStyle(el).position === 'static') {
    el.style.position = 'relative';
  }
  return el;
}

function resolveBubbleAnchor(messageNode) {
  if (!messageNode) return null;
  const root = document.documentElement;
  const msgWrap = root.dataset.ovsBubbleWrapMessage === 'true';
  if (msgWrap) {
    return messageNode.querySelector('[data-slot="message"]') || messageNode;
  }
  return messageNode;
}

// Resolves which element is the actual visible "bubble" shape for
function resolveBubbleMaskElement(messageNode) {
  if (!messageNode) return null;
  const root = document.documentElement;
  if (root.dataset.ovsBubbleWrapRow === 'true') return messageNode;
  if (root.dataset.ovsBubbleWrapMessage === 'true') {
    return messageNode.querySelector('[data-slot="message"]') || messageNode;
  }
  if (root.dataset.ovsBubbleWrapAuthor === 'true') {
    return messageNode.querySelector('[data-slot="author"]') || messageNode;
  }
  return messageNode;
}

function ensureDecorationAnchor(el, anchorName) {
  if (!el) return null;
  if (anchorName === 'avatar' && el.tagName === 'IMG') {
    const existing = el.closest('.ovs-decoration-anchor[data-anchor="avatar"]');
    if (existing) return existing;
    const wrap = document.createElement('span');
    wrap.className = 'ovs-decoration-anchor';
    wrap.dataset.anchor = 'avatar';
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    return wrap;
  }
  return el;
}

function resolveAnchorElement(messageNode, anchor) {
  if (!messageNode) return null;
  if (anchor === 'bubble') return resolveBubbleAnchor(messageNode);
  if (anchor === 'row') return messageNode;
  if (anchor === 'body') return messageNode.querySelector('.ovs-body') || messageNode;
  if (anchor === 'avatar') {
    const avatarEl = messageNode.querySelector('[data-slot="avatar"]');
    return ensureDecorationAnchor(avatarEl, 'avatar') || messageNode;
  }
  if (anchor === 'author') {
    return messageNode.querySelector('[data-slot="author"]') || messageNode;
  }
  if (anchor === 'message') {
    return messageNode.querySelector('[data-slot="message"]') || messageNode;
  }
  return messageNode;
}

function ensureDecorationHost(anchorEl, anchorName, stackLayer) {
  if (!anchorEl) return null;
  ensurePositionedAnchor(anchorEl);
  anchorEl.dataset.hasDecoration = 'true';
  const sl = stackLayer === 'background' ? 'background' : 'foreground';
  let host = anchorEl.querySelector(`:scope > .ovs-decoration-host[data-for-anchor="${anchorName}"][data-stack-layer="${sl}"]`);
  if (!host) {
    host = document.createElement('div');
    host.className = 'ovs-decoration-host';
    host.dataset.forAnchor = anchorName;
    host.dataset.stackLayer = sl;
    if (sl === 'background') {
      anchorEl.style.isolation = 'isolate';
      const texture = anchorEl.querySelector(':scope > .ovs-bubble-texture');
      if (texture) {
        texture.insertAdjacentElement('afterend', host);
      } else {
        anchorEl.insertBefore(host, anchorEl.firstChild);
      }
    } else {
      // Foreground: z-index: 50 on the host handles ordering; DOM position is
      // secondary but keeping firstChild insertion preserves existing behavior.
      anchorEl.insertBefore(host, anchorEl.firstChild);
    }
  }
  return host;
}

export function clearDecorationLayers(messageNode) {
  if (!messageNode) return;
  messageNode.querySelectorAll('.ovs-decoration-layer').forEach((el) => el.remove());
  if (messageNode.dataset.hasDecoration) delete messageNode.dataset.hasDecoration;
  messageNode.querySelectorAll('[data-has-decoration]').forEach((el) => delete el.dataset.hasDecoration);
}

const maskDataUrlCache = new Map();
const MASK_CACHE_LIMIT = 200;

// Maps a maskTarget name to the DOM element that currently renders that
function resolveMaskTargetElement(messageNode, target) {
  if (!messageNode) return null;
  if (target === 'avatar') return messageNode.querySelector('[data-slot="avatar"]');
  if (target === 'bubble') return resolveBubbleMaskElement(messageNode);
  if (target === 'username') return messageNode.querySelector('[data-slot="author"]');
  if (target === 'chatContainer') return messageNode.querySelector('[data-slot="message"]');
  return null;
}

// Resolves a maskTarget's current visible shape for a message: its box
function resolveMaskShapeRect(messageNode, target, debugLayerId) {
  const targetEl = resolveMaskTargetElement(messageNode, target);
  if (!targetEl) {
    console.warn(`[OVS mask] layer "${debugLayerId}": maskTarget "${target}" isn't wired up yet, or its element wasn't found in this message node`);
    return null;
  }
  // Only the avatar has an explicit hidden flag (e.g. "Hiện avatar" off,
  // or image failed to load); other targets are just checked for size.
  if (target === 'avatar' && targetEl.getAttribute('data-hidden') === 'true') {
    console.warn(`[OVS mask] layer "${debugLayerId}": avatar is hidden (data-hidden="true") — either "Hiện avatar" is off, or the avatar image failed to load`);
    return null;
  }
  const rect = targetEl.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    console.warn(`[OVS mask] layer "${debugLayerId}": maskTarget "${target}" element has zero size (${rect.width}x${rect.height})`);
    return null;
  }
  const cs = getComputedStyle(targetEl);
  return {
    rect,
    borderRadius: cs.borderRadius || (target === 'avatar' ? '50%' : '0px'),
  };
}

/** Builds a cache signature so identical shapes/settings reuse one data-URL. */
function maskSignature(imgRect, targetShape, mask) {
  const r = imgRect;
  const a = targetShape.rect;
  // Round to whole pixels: sub-pixel layout jitter shouldn't bust the cache.
  return [
    mask.maskTarget,
    Math.round(r.width), Math.round(r.height),
    Math.round(a.left - r.left), Math.round(a.top - r.top),
    Math.round(a.width), Math.round(a.height),
    targetShape.borderRadius,
    mask.maskMode, mask.maskPadding, mask.maskFeather, mask.maskInvert,
  ].join('|');
}

// Builds (or reuses from cache) an SVG mask-image data-URL that clips a
function buildTargetMaskDataUrl(imgRect, targetShape, mask) {
  const sig = maskSignature(imgRect, targetShape, mask);
  const cached = maskDataUrlCache.get(sig);
  if (cached) return cached;

  const a = targetShape.rect;
  const localX = a.left - imgRect.left;
  const localY = a.top - imgRect.top;
  const padding = Number(mask.maskPadding) || 0;
  const feather = Math.max(0, Number(mask.maskFeather) || 0);

  // Padding expands/shrinks the shape symmetrically from its own center.
  const shapeX = localX - padding;
  const shapeY = localY - padding;
  const shapeW = Math.max(0, a.width + padding * 2);
  const shapeH = Math.max(0, a.height + padding * 2);

  const outside = mask.maskMode === 'clipOutside';
  let shapeFill = outside ? '#000' : '#fff';
  let bgFill = outside ? '#fff' : '#000';
  if (mask.maskInvert) {
    [shapeFill, bgFill] = [bgFill, shapeFill];
  }

  const filterId = 'f';
  const blurAttr = feather > 0
    ? ` filter="url(#${filterId})"`
    : '';
  const filterDef = feather > 0
    ? `<filter id="${filterId}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${feather / 2}"/></filter>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgRect.width}" height="${imgRect.height}">` +
    `<defs>${filterDef}</defs>` +
    `<rect x="0" y="0" width="${imgRect.width}" height="${imgRect.height}" fill="${bgFill}"/>` +
    `<rect x="${shapeX}" y="${shapeY}" width="${shapeW}" height="${shapeH}" rx="${targetShape.borderRadius}" ` +
    `fill="${shapeFill}"${blurAttr}/>` +
    `</svg>`;

  const dataUrl = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  if (maskDataUrlCache.size >= MASK_CACHE_LIMIT) {
    maskDataUrlCache.clear();
  }
  maskDataUrlCache.set(sig, dataUrl);
  return dataUrl;
}

// Applies (or clears) a layer's clipping mask on its rendered <img>.
function applyDecorationMask(img, messageNode, layer) {
  if (!layer.maskEnabled || layer.maskMode === 'none') return;

  const targetShape = resolveMaskShapeRect(messageNode, layer.maskTarget, layer.id);
  if (!targetShape) return; // resolveMaskShapeRect already logged why

  // getBoundingClientRect on the not-yet-inserted img would be empty;
  // the img is appended to the DOM by the caller before this runs.
  const imgRect = img.getBoundingClientRect();
  if (!imgRect.width || !imgRect.height) {
    console.warn(`[OVS mask] layer "${layer.id}": decoration <img> has zero size (${imgRect.width}x${imgRect.height})`);
    return;
  }

  const maskUrl = buildTargetMaskDataUrl(imgRect, targetShape, layer);
  img.style.maskImage = maskUrl;
  img.style.webkitMaskImage = maskUrl;
  img.style.maskRepeat = 'no-repeat';
  img.style.webkitMaskRepeat = 'no-repeat';
  img.style.maskSize = '100% 100%';
  img.style.webkitMaskSize = '100% 100%';
  img.setAttribute('data-mask-applied', 'true');
}

// Returns true when a message node satisfies a layer's visibility condition.
// - visibilityRoles empty (default) → hiện với tất cả, không lọc.
// 'moderator' — node có class ovs-moderator
// 'member'    — node có class ovs-member VÀ memberMonths >= memberMonthsMin
// (memberMonthsMin = 0 → chấp nhận tất cả member bất kể tháng)
// 'chat'      — không có moderator lẫn member (người xem thường)
// memberMonths được đọc từ node.dataset.ovsMemberMonths, được gán trong
// message-renderer.js#createMessageNode() ngay sau khi thêm role classes.
function messageMatchesLayer(messageNode, layer) {
  const roles = layer.visibilityRoles;
  if (!Array.isArray(roles) || roles.length === 0) return true; // no filter

  const isMod = messageNode.classList.contains('ovs-moderator');
  const isMember = messageNode.classList.contains('ovs-member');
  const memberMonths = parseInt(messageNode.dataset.ovsMemberMonths || '0', 10);
  const isChat = !isMod && !isMember;

  for (const role of roles) {
    if (role === 'moderator' && isMod) return true;
    if (role === 'member' && isMember) {
      const min = Number(layer.memberMonthsMin) || 0;
      if (min === 0 || memberMonths >= min) return true;
    }
    if (role === 'chat' && isChat) return true;
  }
  return false;
}

export function applyDecorationLayers(messageNode, decorationConfig) {
  if (!messageNode) return;
  const layers = Array.isArray(decorationConfig?.layers) ? decorationConfig.layers : [];

  // Track existing layers in DOM for this messageNode
  const existingElements = new Map();
  messageNode.querySelectorAll('.ovs-decoration-layer').forEach((el) => {
    if (el.dataset.layerId) {
      existingElements.set(el.dataset.layerId, el);
    }
  });

  const activeLayerIds = new Set();

  layers.forEach((layer) => {
    if (!layer || layer.enabled === false || !layer.imageUrl) return;
    if (!messageMatchesLayer(messageNode, layer)) return;
    const anchorEl = resolveAnchorElement(messageNode, layer.anchor || 'message');
    const host = ensureDecorationHost(anchorEl, layer.anchor || 'message', layer.stackLayer);
    if (!host) return;

    const layerId = layer.id || '';
    activeLayerIds.add(layerId);

    let layerWrap = existingElements.get(layerId);
    let animWrap;
    let img;

    if (layerWrap) {
      layerWrap.dataset.placement = layer.placement || 'custom';
      applyInlineStyle(layerWrap, compileLayerInlineStyle(layer));

      if (layerWrap.parentNode !== host) {
        host.appendChild(layerWrap);
      }

      animWrap = layerWrap.querySelector('.ovs-decoration-anim');
      if (!animWrap) {
        animWrap = document.createElement('div');
        animWrap.className = 'ovs-decoration-anim';
        layerWrap.appendChild(animWrap);
      }
      if (animWrap.dataset.idleAnimation !== (layer.idleAnimation || 'none')) {
        animWrap.dataset.idleAnimation = layer.idleAnimation || 'none';
      }

      img = animWrap.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.className = 'ovs-decoration-img';
        img.alt = '';
        img.decoding = 'async';
        animWrap.appendChild(img);
      }

      const proxied = toImageProxyUrl(layer.imageUrl);
      const expectedSrc = proxied || layer.imageUrl;
      if (img.getAttribute('data-raw-src') !== layer.imageUrl) {
        img.setAttribute('data-raw-src', layer.imageUrl);
        img.src = expectedSrc;
      }
    } else {
      // Lấy Sticker node từ StickerPool thay vì tự document.createElement.
      // acquire() tự ưu tiên trả về node IDLE đã reset sẵn — chỉ thật sự
      // tạo mới khi Pool không còn object rảnh. Cấu trúc DOM trả về
      // (layerWrap > animWrap > img, cùng className) giống hệt như trước
      // đây tự tay dựng, nên giao diện/CSS/animation không đổi.
      layerWrap = stickerPoolManager.acquire(layerId);
      layerWrap.dataset.layerId = layerId;
      layerWrap.dataset.placement = layer.placement || 'custom';
      applyInlineStyle(layerWrap, compileLayerInlineStyle(layer));

      animWrap = layerWrap.querySelector(':scope > .ovs-decoration-anim');
      animWrap.dataset.idleAnimation = layer.idleAnimation || 'none';

      img = animWrap.querySelector(':scope > img');

      const proxied = toImageProxyUrl(layer.imageUrl);
      img.setAttribute('data-raw-src', layer.imageUrl);
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.setAttribute('data-load-error', 'true');
      img.onload = () => img.removeAttribute('data-load-error');
      img.src = proxied || layer.imageUrl;

      host.appendChild(layerWrap);
    }

    if (layer.maskEnabled && img) {
      applyDecorationMask(img, messageNode, layer);
    } else if (img) {
      img.style.maskImage = '';
      img.style.webkitMaskImage = '';
      img.removeAttribute('data-mask-applied');
    }
  });

  // Clean up any layers that are no longer active — trả về StickerPool
  // (reset toàn bộ state + detach) thay vì hủy hẳn bằng .remove(), để
  // lần tạo layer tiếp theo có thể tái sử dụng thay vì tạo mới.
  existingElements.forEach((el, id) => {
    if (!activeLayerIds.has(id)) {
      stickerPoolManager.release(el);
    }
  });
}

export function refreshAllDecorations() {
  const applyTo = (node) => {
    applyDecorationLayers(node, state.currentDecoration);
  };
  listEl.querySelectorAll('.ovs-message').forEach(applyTo);
}