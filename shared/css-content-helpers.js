/**
 * css-content-helpers.js — badge/CSS-content helpers shared by
 * shared/role-style-config.js (moderator/member badges, member tiers) and
 * shared/fan-service-config.js (superchat badge/amount styling).
 *
 * Extracted out of role-style-config.js during the Super Chat -> Fan
 * Service refactor: Fan Service now owns Super Chat's badge fields, and it
 * must NOT import from role-style-config.js to get them (Role no longer
 * knows anything about Super Chat, so Fan Service shouldn't depend
 * backwards on Role either). This file has no concept of "role" or
 * "group" — it's pure text/URL -> CSS-content plumbing, used by both.
 */

const { toImageProxyUrl } = require('./image-url');

// A badge value is treated as an image URL (rendered via CSS `content:
// url(...)`, same replaced-element technique shared/customize-config.js
// already uses for bubbleTextureUrl) whenever it looks like an http(s)
// link; anything else (emoji, plain text like "VIP") stays a quoted text
// content string. This is deliberately a cheap prefix check, not a strict
// URL parse — badge fields are free-text inputs, not always well-formed
// URLs, and the cost of a false positive here (an oddly-typed non-URL
// string starting with "http" rendering as a broken image) is low compared
// to rejecting a valid-but-unusual image URL.
function isImageUrlValue(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

// The one place badge text/image values become a CSS `content` value —
// used for role-level badgeBefore/badgeAfter (moderator), per-tier
// badgeBefore/badgeAfter (member/Mốc tháng), and Fan Service's superchat
// badgeBefore/badgeAfter — so image-URL support and text-quoting only need
// to be correct in one spot. Image URLs are routed through
// toImageProxyUrl() (shared/image-url.js) — same allowlisted-host +
// HTTPS-only proxy every other user-supplied image URL in this app (bubble
// texture, decoration layers) already goes through, so OBS Browser
// Source's stricter fetch/CORS behavior and hotlink protection are handled
// consistently; a URL that isn't on the allowlist falls back to the raw
// value (same "best effort" fallback compileBubbleDecorationToCssVariables
// uses for bubbleTextureUrl) rather than silently dropping the badge.
function quoteCssContent(value) {
  if (!value) return 'none';
  const str = String(value).trim();
  if (!str) return 'none';
  if (isImageUrlValue(str)) {
    return `url("${toImageProxyUrl(str) || str}")`;
  }
  return `"${str.replace(/"/g, '\\"')}"`;
}

// The <img src> counterpart to quoteCssContent()'s `url(...)` branch —
// returns the same proxied URL quoteCssContent() would have embedded, or
// null when `value` isn't an image badge at all. Exists because image
// badges are no longer rendered via CSS `content: url(...)` on ::before/
// ::after (see overlay/modules/message-renderer.js): Chromium paints that
// generated content at the SOURCE image's native pixel size regardless of
// any width/height/max-width/object-fit set on the pseudo-element, so a
// badge image larger than the tiny box it was declared at (e.g. a 512x512
// avatar-style PNG) overflowed straight out of the bubble instead of being
// scaled down — text/emoji badges never hit this because `content: "..."`
// text has no intrinsic size to ignore. A real <img> element sized with
// ordinary CSS does not have that bug, so image badges are built as actual
// DOM nodes now and this is the one place their `src` value is resolved,
// mirroring quoteCssContent() so the two never drift out of sync on which
// URLs get proxied.
function getBadgeImageSrc(value) {
  if (!isImageUrlValue(value)) return null;
  const str = String(value).trim();
  return toImageProxyUrl(str) || str;
}

// Shared by Name Font Weight (authorFontWeight, every role) and Super
// Chat's amount Font Weight (amountFontWeight, now in fan-service-config.js)
// — same three options, same numeric mapping, so there's exactly one place
// this ever gets defined.
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
