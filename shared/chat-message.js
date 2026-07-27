/**
 * ChatMessage schema (shared reference — plain JS, no build step needed).
 *
 * {
 *   id: string,                    // dedupe key (derived from YouTube's DOM node id when possible)
 *   author: string,
 *   avatarUrl: string,
 *   badges: string[],              // raw badge labels as captured, e.g. ["Moderator", "Member (6 months)"]
 *   roles: string[],                // derived from badges: subset of "moderator" | "member" | "verified"
 *   memberMonths: number,           // parsed from a "Member (N months|years)" badge, 0 if not a member / not parseable
 *   eventType: 'text' | 'superchat' | 'sticker' | 'membership_new' | 'membership_gift' | 'membership_milestone',
 *   messageText: string,            // plain-text mirror of messageHtml (emoji alt text lost, tags stripped)
 *   messageHtml: string,            // message text, emoji already resolved to <img> tags
 *   language: string | null,        // best-effort script hint, e.g. "ja" | "zh" | "ko" | "ar" | "he" | null
 *   direction: 'ltr' | 'rtl',
 *   timestamp: number,               // ms epoch, set on the main-process side (capture time)
 *   isSuperchat: boolean,
 *   superchatAmountUsd: number,       // 0 unless currency was unambiguously recognized as USD (see parseSuperchatAmount)
 *   superchatCurrencyRaw: string | null   // original display string, e.g. "€10.00", whenever isSuperchat is true
 * }
 *
 * NOTE: roles/memberMonths/eventType/language/direction/superchatAmountUsd/superchatCurrencyRaw
 * are additive fields (added for the Rule Engine groundwork in the theme-system
 * redesign doc, §5.6). Anything reading only the older subset of this shape
 * keeps working unchanged — every new field has a safe default.
 */

const crypto = require('crypto');

const VALID_EVENT_TYPES = new Set([
  'text',
  'superchat',
  'sticker',
  'membership_new',
  'membership_gift',
  'membership_milestone',
]);

// Keyword substrings (lowercased) used to derive coarse "roles" from
// YouTube's own badge aria-labels. Intentionally a simple, easily-extended
// keyword map rather than parsing badge icon classes — aria-label text is
// the most stable signal we get from the captured DOM, but it IS still
// YouTube's own UI copy, so a reworded/relocalized label can silently stop
// matching. Ship fixes as an update to this map, same spirit as
// selectors.config.json's "edit data, not code" philosophy.
const ROLE_KEYWORDS = {
  // 'kiểm duyệt' / 'kiem duyet' added: YouTube's actual Vietnamese-locale
  // badge label for this role is "Người kiểm duyệt", not "điều hành" or
  // "quản trị" (neither of those is YouTube's own wording, so they never
  // matched a real badge — moderator detection silently failed on any
  // Vietnamese-language channel/viewer session).
  moderator: [
    'moderator',
    'mod',
    'kiểm duyệt',
    'kiem duyet',
    'điều hành',
    'dieu hanh',
    'quản trị',
    'quan tri',
  ],
  member: ['member', 'thành viên', 'thanh vien', 'hội viên', 'hoi vien'],
  verified: ['verified', 'xác minh', 'xac minh'],
};

// Unicode script ranges used for a lightweight language/direction hint. This
// is NOT a real language detector — it only recognizes a handful of
// non-Latin scripts with confidence. Everything else (including most
// Latin-script languages: en, es, fr, vi, ...) intentionally resolves to
// `language: null` rather than guessing "en", since a wrong guess is worse
// than an honest "unknown" for anything that later branches on it (e.g. a
// future Rule Engine). direction only flips to 'rtl' for the scripts below.
const SCRIPT_RANGES = [
  { language: 'ar', direction: 'rtl', ranges: [[0x0600, 0x06ff], [0x0750, 0x077f], [0x08a0, 0x08ff]] },
  { language: 'he', direction: 'rtl', ranges: [[0x0590, 0x05ff]] },
  { language: 'ja', direction: 'ltr', ranges: [[0x3040, 0x30ff], [0xff66, 0xff9f]] }, // hiragana/katakana (+halfwidth)
  { language: 'ko', direction: 'ltr', ranges: [[0xac00, 0xd7a3]] },
  { language: 'zh', direction: 'ltr', ranges: [[0x4e00, 0x9fff]] }, // Han ideographs w/o kana => best-effort "zh"
];

/**
 * Normalizes a raw message payload coming from the injected capture script
 * into the canonical ChatMessage shape. Anything captured from the page is
 * treated as untrusted text, so we defensively coerce types here.
 */
// Normalizes to NFC (precomposed) form. Vietnamese text can arrive from the
// DOM as either precomposed characters ("ế" as one code point) or decomposed
// sequences (base letter + separate combining tone-mark code points) — both
// render identically but decomposed text is fragile: slice()ing a raw string
// at a fixed length can land between a base letter and its combining mark
// (visually detaching the accent) and some fonts/consumers mis-render
// decomposed sequences even when unsliced. Normalizing up front avoids both.
function toNfc(str) {
  return typeof str === 'string' && str.normalize ? str.normalize('NFC') : str;
}

const SUPERCHAT_TIER_TABLE = [
  { tier: 7, minUsd: 100, color: '#e53935', bg: 'rgba(229, 57, 53, 0.35)', border: 'rgba(229, 57, 53, 0.7)' },
  { tier: 6, minUsd: 50,  color: '#e91e63', bg: 'rgba(233, 30, 99, 0.35)', border: 'rgba(233, 30, 99, 0.7)' },
  { tier: 5, minUsd: 20,  color: '#f57c00', bg: 'rgba(245, 124, 0, 0.35)', border: 'rgba(245, 124, 0, 0.7)' },
  { tier: 4, minUsd: 10,  color: '#ffca28', bg: 'rgba(255, 202, 40, 0.35)', border: 'rgba(255, 202, 40, 0.7)' },
  { tier: 3, minUsd: 5,   color: '#0f9d58', bg: 'rgba(15, 157, 88, 0.35)', border: 'rgba(15, 157, 88, 0.7)' },
  { tier: 2, minUsd: 2,   color: '#00e5ff', bg: 'rgba(0, 229, 255, 0.35)', border: 'rgba(0, 229, 255, 0.7)' },
  { tier: 1, minUsd: 0,   color: '#1e88e5', bg: 'rgba(30, 136, 229, 0.35)', border: 'rgba(30, 136, 229, 0.7)' },
];

function deriveSuperchatTierInfo(rawColor, amountUsd) {
  if (rawColor && typeof rawColor === 'string' && rawColor.trim()) {
    const trimmed = rawColor.trim();
    if (/229,\s*57,\s*53|e53935/i.test(trimmed)) return { tier: 7, color: trimmed, bg: 'rgba(229, 57, 53, 0.35)', border: 'rgba(229, 57, 53, 0.7)' };
    if (/233,\s*30,\s*99|e91e63/i.test(trimmed)) return { tier: 6, color: trimmed, bg: 'rgba(233, 30, 99, 0.35)', border: 'rgba(233, 30, 99, 0.7)' };
    if (/245,\s*124,\s*0|f57c00/i.test(trimmed)) return { tier: 5, color: trimmed, bg: 'rgba(245, 124, 0, 0.35)', border: 'rgba(245, 124, 0, 0.7)' };
    if (/255,\s*202,\s*40|ffca28/i.test(trimmed)) return { tier: 4, color: trimmed, bg: 'rgba(255, 202, 40, 0.35)', border: 'rgba(255, 202, 40, 0.7)' };
    if (/15,\s*157,\s*88|0f9d58/i.test(trimmed)) return { tier: 3, color: trimmed, bg: 'rgba(15, 157, 88, 0.35)', border: 'rgba(15, 157, 88, 0.7)' };
    if (/0,\s*229,\s*255|00e5ff/i.test(trimmed)) return { tier: 2, color: trimmed, bg: 'rgba(0, 229, 255, 0.35)', border: 'rgba(0, 229, 255, 0.7)' };
    if (/30,\s*136,\s*229|1e88e5/i.test(trimmed)) return { tier: 1, color: trimmed, bg: 'rgba(30, 136, 229, 0.35)', border: 'rgba(30, 136, 229, 0.7)' };

    const matchTier = SUPERCHAT_TIER_TABLE.find((t) => (amountUsd || 0) >= t.minUsd) || SUPERCHAT_TIER_TABLE[SUPERCHAT_TIER_TABLE.length - 1];
    return {
      tier: matchTier.tier,
      color: trimmed,
      bg: trimmed.startsWith('rgb') && !trimmed.startsWith('rgba') ? trimmed.replace('rgb(', 'rgba(').replace(')', ', 0.35)') : trimmed,
      border: trimmed,
    };
  }

  const matchTier = SUPERCHAT_TIER_TABLE.find((t) => (amountUsd || 0) >= t.minUsd) || SUPERCHAT_TIER_TABLE[SUPERCHAT_TIER_TABLE.length - 1];
  return matchTier;
}

function normalizeMessage(raw) {
  const author = toNfc(String(raw.author || '')).slice(0, 120);
  const messageHtml = toNfc(String(raw.messageHtml || '')).slice(0, 2000);
  const messageText = toNfc(String(raw.messageText || '')).slice(0, 2000);
  const id = raw.id ? String(raw.id) : hashFallbackId(author, messageHtml, raw.avatarUrl);
  const badges = Array.isArray(raw.badges) ? raw.badges.slice(0, 5).map((b) => toNfc(String(b))) : [];

  let eventType = typeof raw.eventType === 'string' && VALID_EVENT_TYPES.has(raw.eventType)
    ? raw.eventType
    : (raw.isSuperchat ? 'superchat' : 'text');

  const isSuperchat = Boolean(raw.isSuperchat) || eventType === 'superchat' || eventType === 'sticker';
  if (isSuperchat && eventType === 'text') {
    eventType = 'superchat';
  }

  const { language, direction } = detectLanguageDirection(messageText);
  const { superchatAmountUsd, superchatCurrencyRaw } = isSuperchat
    ? parseSuperchatAmount(String(raw.superchatAmountRaw || ''))
    : { superchatAmountUsd: 0, superchatCurrencyRaw: null };

  const superchatTierInfo = isSuperchat
    ? deriveSuperchatTierInfo(raw.superchatColor, superchatAmountUsd)
    : null;

  return {
    id,
    author,
    avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : '',
    badges,
    roles: deriveRoles(badges),
    memberMonths: deriveMemberMonths(badges),
    eventType,
    messageText,
    messageHtml,
    language,
    direction,
    timestamp: Date.now(),
    isSuperchat,
    superchatAmountUsd,
    superchatCurrencyRaw,
    superchatTier: superchatTierInfo ? superchatTierInfo.tier : null,
    superchatColor: superchatTierInfo ? superchatTierInfo.color : null,
    superchatBg: superchatTierInfo ? superchatTierInfo.bg : null,
    superchatBorder: superchatTierInfo ? superchatTierInfo.border : null,
  };
}

// Maps raw badge labels to a small closed set of role strings. A message can
// have more than one role (e.g. a moderator who is also a member).
function deriveRoles(badges) {
  const lowerBadges = badges.map((b) => b.toLowerCase());
  return Object.keys(ROLE_KEYWORDS).filter((role) =>
    lowerBadges.some((badge) => ROLE_KEYWORDS[role].some((keyword) => badge.includes(keyword)))
  );
}

// Looks for a "Member (N months|years)" style badge or header text and returns total
// months, or 0 if there's no member badge / it doesn't parse cleanly.
// Matches both "Member (6 months)", "Member for 6 months", "Thành viên (6 tháng)", "Thành viên 6 tháng", "Hội viên (1 năm)".
const MEMBER_BADGE_RE = /(member|th[aà]nh\s*vi[eê]n|h[ộo]i\s*vi[eê]n)[^0-9\(\)]*(?:\(|for\s+)?(\d+\s*(?:month|tháng|thang|year|năm|nam)[s]?)\)?/i;

function deriveMemberMonths(badges) {
  for (const badge of badges) {
    const match = MEMBER_BADGE_RE.exec(badge);
    if (!match) continue;
    const text = match[2].toLowerCase();
    const num = parseInt(text, 10);
    if (Number.isNaN(num)) continue;
    return /year|n[aă]m/.test(text) ? num * 12 : num;
  }
  return 0;
}

// Best-effort script-based language/direction hint — see SCRIPT_RANGES
// comment above for what this deliberately does NOT attempt to detect.
function detectLanguageDirection(text) {
  for (const { language, direction, ranges } of SCRIPT_RANGES) {
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (ranges.some(([start, end]) => code >= start && code <= end)) {
        return { language, direction };
      }
    }
  }
  return { language: null, direction: 'ltr' };
}

// Best-effort superchat amount parse. Only ever fills superchatAmountUsd
// when the currency is unambiguously USD ($ / US$ / USD prefix) — any other
// currency keeps superchatAmountUsd at 0 and preserves the original string
// in superchatCurrencyRaw, rather than silently mislabeling e.g. a €50
// pledge as if it were $50. Real multi-currency -> USD conversion needs a
// live FX rate and is left as a future improvement.
function parseSuperchatAmount(rawText) {
  if (!rawText) return { superchatAmountUsd: 0, superchatCurrencyRaw: null };

  const isUsd = /^\s*(\$|us\$|usd)/i.test(rawText);
  if (!isUsd) return { superchatAmountUsd: 0, superchatCurrencyRaw: rawText };

  // Strip currency marks, keep digits/separators: "$1,234.50" -> "1,234.50"
  const numeric = rawText.replace(/[^\d.,]/g, '');
  // Assume the LAST separator is the decimal point (handles both
  // "1,234.50" and, more rarely, "1.234,50") — anything before it is a
  // thousands separator and gets stripped.
  const decimalIndex = Math.max(numeric.lastIndexOf(','), numeric.lastIndexOf('.'));
  let normalized = numeric;
  if (decimalIndex !== -1) {
    const intPart = numeric.slice(0, decimalIndex).replace(/[.,]/g, '');
    const fracPart = numeric.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = `${intPart}.${fracPart}`;
  }
  const value = parseFloat(normalized);
  return {
    superchatAmountUsd: Number.isFinite(value) ? value : 0,
    superchatCurrencyRaw: rawText,
  };
}

// Used only when YouTube's DOM node has no stable id we can key off — keeps
// dedupe working even if the selector for "id" ever falls back to nothing.
function hashFallbackId(author, messageHtml, avatarUrl) {
  return crypto
    .createHash('sha1')
    .update(`${author}::${messageHtml}::${avatarUrl}`)
    .digest('hex');
}

module.exports = { normalizeMessage };