// Detects "emoji-only" messages (no real text — just emoji, whether they're
// plain unicode emoji characters or YouTube's own custom emoji <img> tags)
// and, when found, wraps every individual emoji glyph in its own
// .ovs-emoji-glyph span/img so CSS can give each one a square backdrop chip
// and bump the whole message's text scale slightly (see layout-text.css).

// Matches a single "emoji-ish" code point: anything in the broad
// Extended_Pictographic set (covers virtually all standalone emoji) plus
// regional-indicator letters (flag halves, e.g. 🇻 + 🇳 -> 🇻🇳).
const EMOJI_TEST_RE = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u;

// Grapheme-cluster splitter: Intl.Segmenter keeps composed sequences (ZWJ
// joins, skin-tone modifiers, flags, keycaps) as one visual "character" —
// e.g. "👨‍👩‍👧‍👦" stays one glyph instead of exploding into 4+ separate
// emoji. Electron's Chromium always has Intl.Segmenter, but fall back to a
// plain code-point split (Array.from) just in case.
function segmentGraphemes(str) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), (s) => s.segment);
  }
  return Array.from(str);
}

/**
 * Walks `contentEl`'s direct children (text nodes + <img> emoji tags) and
 * determines whether the message is emoji-only. If so, marks `rowEl` with
 * data-emoji-only="true" and wraps every emoji glyph individually so CSS
 * can render each one with its own square backdrop.
 *
 * Sticker messages (single <img class="ovs-sticker-img">) are intentionally
 * excluded — they're a distinct event type, not a chat emoji, and are
 * already sized/styled on their own.
 */
export function applyEmojiOnlyStyling(rowEl, contentEl) {
  if (!contentEl) return;

  const nodes = Array.from(contentEl.childNodes);
  if (nodes.length === 0) return;

  let hasEmoji = false;
  let onlyEmoji = true;

  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
      if (node.classList.contains('ovs-sticker-img')) return; // not a chat emoji — bail entirely
      hasEmoji = true;
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) continue; // pure whitespace between glyphs — ignore
      for (const g of segmentGraphemes(text)) {
        if (!g.trim()) continue;
        if (EMOJI_TEST_RE.test(g)) hasEmoji = true;
        else onlyEmoji = false;
      }
      continue;
    }
    // Any other node type (links, formatted spans, etc.) means it's not a
    // plain "just emoji" message.
    onlyEmoji = false;
  }

  if (!hasEmoji || !onlyEmoji) return;

  if (rowEl) rowEl.setAttribute('data-emoji-only', 'true');

  // Second pass: wrap each glyph individually now that we know the whole
  // message qualifies.
  Array.from(contentEl.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
      node.classList.add('ovs-emoji-glyph');
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent;
    if (!text) return;

    const frag = document.createDocumentFragment();
    segmentGraphemes(text).forEach((g) => {
      if (!g.trim()) {
        frag.appendChild(document.createTextNode(g));
        return;
      }
      const span = document.createElement('span');
      span.className = 'ovs-emoji-glyph';
      span.textContent = g;
      frag.appendChild(span);
    });
    node.replaceWith(frag);
  });
}
