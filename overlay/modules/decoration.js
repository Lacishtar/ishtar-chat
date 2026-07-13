// Decoration layers (per-message repeating/anchored images) + the SVG
// clipping-mask system that lets a layer clip itself to the avatar/bubble/
// username/message shape.
//
// Render order stays: Avatar -> Sticker Decoration -> Apply Mask -> Glow
// -> Border -> Foreground Decorations. The mask is realized as a CSS
// mask-image on the decoration <img> itself (applied right after the
// decoration is created, before it's appended), so it never touches the
// theme's own glow/border layers or their stacking order. When a layer's
// mask is disabled (the default), none of this code path runs and the
// decoration renders exactly as it did before this feature existed.

import { state, listEl } from './state.js';
import { applyInlineStyle, compileLayerInlineStyle, toImageProxyUrl } from './utils.js';

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

/**
 * Resolves which element is the actual visible "bubble" shape for
 * masking purposes. Unlike resolveBubbleAnchor() (used for decoration
 * *placement*, which only special-cases the message-wrap mode), this
 * checks all three bubble-wrap flags so the mask always follows whichever
 * element is really rendering the rounded bubble:
 *   - row wrap    -> the whole message row (.ovs-message)
 *   - message wrap-> the message/text bubble (.ovs-text)
 *   - author wrap -> the username bubble (.ovs-author)
 * If none are active, .ovs-message is used as a harmless fallback (it
 * simply won't have any border-radius to clip to).
 */
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

function ensureDecorationHost(anchorEl, anchorName) {
  if (!anchorEl) return null;
  ensurePositionedAnchor(anchorEl);
  let host = anchorEl.querySelector(`:scope > .ovs-decoration-host[data-for-anchor="${anchorName}"]`);
  if (!host) {
    host = document.createElement('div');
    host.className = 'ovs-decoration-host';
    host.dataset.forAnchor = anchorName;
    anchorEl.insertBefore(host, anchorEl.firstChild);
  }
  return host;
}

export function clearDecorationLayers(messageNode) {
  if (!messageNode) return;
  messageNode.querySelectorAll('.ovs-decoration-layer').forEach((el) => el.remove());
}

// Cache of generated SVG mask data-URLs, keyed by a signature of every
// input that can change the mask's pixels. Avoids rebuilding/re-parsing
// an SVG string (and forcing a style recalc) on every render pass when
// nothing about the shape actually changed.
const maskDataUrlCache = new Map();
const MASK_CACHE_LIMIT = 200;

/**
 * Maps a maskTarget name to the DOM element that currently renders that
 * target's visible shape. Only targets with a real, always-present
 * element are wired here; the rest (bottomAccentBar, glowLayer,
 * customShape) stay reserved for future work — resolveMaskShapeRect()
 * returns null for those with a console warning explaining why.
 *
 * - 'avatar'        -> [data-slot="avatar"] (existing avatar image)
 * - 'bubble'        -> whatever element currently renders the visible
 *                      chat bubble (see resolveBubbleMaskElement): the
 *                      row, the message/text bubble, or the username
 *                      bubble — whichever bubble-wrap mode is active.
 * - 'username'      -> [data-slot="author"] (the username's own bubble,
 *                      see SlotBubbleSection / bubble-wrap.css .ovs-author)
 * - 'chatContainer' -> [data-slot="message"] (the chat message's own
 *                      bubble/text box, .ovs-text in bubble-wrap.css)
 */
function resolveMaskTargetElement(messageNode, target) {
  if (!messageNode) return null;
  if (target === 'avatar') return messageNode.querySelector('[data-slot="avatar"]');
  if (target === 'bubble') return resolveBubbleMaskElement(messageNode);
  if (target === 'username') return messageNode.querySelector('[data-slot="author"]');
  if (target === 'chatContainer') return messageNode.querySelector('[data-slot="message"]');
  return null;
}

/**
 * Resolves a maskTarget's current visible shape for a message: its box
 * size/position and effective border-radius. Reads the real computed
 * style rather than assuming a circle, so circle / rounded-rect /
 * squircle / fully-custom radii are all honored, for any wired target.
 */
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
    // border-radius can be "50%", "12px", or a 4-corner shorthand like
    // "8px 8px 4px 4px" (squircle-ish custom shapes) — the raw computed
    // string is reused as-is inside the generated SVG <rect rx/ry>.
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

/**
 * Builds (or reuses from cache) an SVG mask-image data-URL that clips a
 * decoration image to a mask target's visible shape (avatar, bubble,
 * username, or chat message — see resolveMaskTargetElement).
 *
 * The mask is expressed in the decoration image's own local box: the
 * target rectangle is translated into that coordinate space so the two
 * can be different sizes/positions and still line up correctly on screen.
 */
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

  // White = visible, black = hidden, per the SVG mask spec.
  // maskMode picks the base behavior: 'clipInside' keeps the decoration
  // visible only where it overlaps the avatar shape (avatar = window);
  // 'clipOutside' does the opposite (avatar = a hole punched through the
  // decoration). maskInvert then flips whichever of those was chosen —
  // it's a modifier on top of the mode, not a replacement for it.
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

/**
 * Applies (or clears) a layer's clipping mask on its rendered <img>.
 * No-op — and leaves the element with no mask styles at all — when the
 * layer has masking disabled, its target isn't wired up yet, or the
 * target shape can't currently be resolved (e.g. avatar hidden).
 */
function applyDecorationMask(img, messageNode, layer) {
  if (!layer.maskEnabled || layer.maskMode === 'none') return;

  // 'avatar', 'bubble', 'username', and 'chatContainer' are real,
  // wired-up mask sources. The rest (bottomAccentBar, glowLayer,
  // customShape) are reserved schema values for future work (see
  // MASK_TARGETS in shared/decoration-config.js) and are safely ignored
  // until then — resolveMaskShapeRect() warns and returns null for those.
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
  console.info(`[OVS mask] layer "${layer.id}": mask applied ✔ (mode=${layer.maskMode}, invert=${layer.maskInvert})`);
}

/**
 * Returns true when a message node satisfies a layer's visibility condition.
 *
 * Logic:
 *   - visibilityRoles empty (default) → hiện với tất cả, không lọc.
 *   - Non-empty → OR across selected tokens:
 *       'moderator' — node có class ovs-moderator
 *       'member'    — node có class ovs-member VÀ memberMonths >= memberMonthsMin
 *                     (memberMonthsMin = 0 → chấp nhận tất cả member bất kể tháng)
 *       'chat'      — không có moderator lẫn member (người xem thường)
 *
 * memberMonths được đọc từ node.dataset.ovsMemberMonths, được gán trong
 * message-renderer.js#createMessageNode() ngay sau khi thêm role classes.
 */
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
  layers.forEach((layer) => {
    if (!layer || layer.enabled === false || !layer.imageUrl) return;
    if (!messageMatchesLayer(messageNode, layer)) return;
    const anchorEl = resolveAnchorElement(messageNode, layer.anchor || 'message');
    const host = ensureDecorationHost(anchorEl, layer.anchor || 'message');
    if (!host) return;

    const img = document.createElement('img');
    img.className = 'ovs-decoration-layer';
    img.alt = '';
    img.decoding = 'async';
    img.dataset.layerId = layer.id || '';
    img.dataset.placement = layer.placement || 'custom';
    applyInlineStyle(img, compileLayerInlineStyle(layer));

    const proxied = toImageProxyUrl(layer.imageUrl);
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.setAttribute('data-load-error', 'true');
    img.onload = () => img.removeAttribute('data-load-error');
    img.src = proxied || layer.imageUrl;

    host.appendChild(img);

    // Mask is applied after the image is in the DOM (layout/position
    // reads require it) and after src is set, but load timing doesn't
    // matter here since mask-image is independent of the <img>'s own
    // decode state.
    if (layer.maskEnabled) {
      applyDecorationMask(img, messageNode, layer);
    }
  });
}

export function refreshAllDecorations() {
  const applyTo = (node) => {
    clearDecorationLayers(node);
    applyDecorationLayers(node, state.currentDecoration);
  };
  listEl.querySelectorAll('.ovs-message').forEach(applyTo);
}