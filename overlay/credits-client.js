// Stream Credits — OBS Browser Source client.
//
// This is intentionally simple: Credits data changes rarely (background
// scrape every few minutes, plus one final snapshot when the stream ends),
// so a same-origin fetch poll is enough — no WebSocket wiring needed.

const DATA_URL = '/overlay/credits/data';
// Data itself changes rarely, but isPlaying is a manual action the streamer
// expects to feel almost immediate — kept short (not 15s) so the real OBS
// Browser Source starts within a couple seconds of the dashboard button.
// The embedded dashboard preview doesn't wait on this poll at all: it gets
// an instant postMessage override (see the 'message' listener below).
const POLL_INTERVAL_MS = 3000;

let lastPayloadJson = null; // last dataSignature (sections+snapshots+scrollSpeed only — see poll()), not the whole payload
let currentTrack = null; // the currently-rendered track element, so play/pause can be applied without a full re-render
let isPlaying = false; // authoritative source: the polled payload's isPlaying, with an instant local override via postMessage
let localOverrideUntilNextData = false; // true once a postMessage override has fired, so we don't fight the next poll if it hasn't caught up yet
let trackIsRunning = false; // whether the rAF loop is actually driving currentTrack right now — separate from `isPlaying` so a poll that finds nothing new doesn't re-trigger a restart on an already-scrolling track

// --- Gap-free infinite scroll ---------------------------------------------
//
// Two earlier approaches both broke down the same way: they measured a
// pass's height ONCE (either as a whole-track scrollHeight, or as the gap
// between two freshly-built passes) and then trusted that number for the
// rest of the session. That number is wrong as soon as an avatar <img>
// finishes loading after the measurement — rows have no reserved
// height/width, so a late-loading avatar reflows the row taller, silently
// invalidating the cached height. Every position computed against the
// stale number then drifts, which is exactly what showed up as "the loop
// still isn't right" — content overlapping itself or a blank gap opening
// up, and it wouldn't self-correct because nothing ever re-measured.
//
// This version never caches a pass height at all. Every frame it reads
// each relevant pass's REAL, live layout position (`offsetTop` /
// `offsetHeight`, both recomputed by the browser on every reflow — e.g.
// the instant an avatar image finishes loading and pushes rows around).
// The mechanism itself:
//   1. Start with 2 passes (a "pass" = one full read-through of every
//      section) stacked in the track, in normal document flow.
//   2. Drive `translateY` ourselves every frame (no CSS keyframes — those
//      require a fixed, precomputed total distance).
//   3. Watch the first pass of the current pair. The instant its live
//      bottom edge crosses the top of the screen ("chạm trần" — it has
//      fully scrolled past the ceiling), append 2 more passes and start
//      watching the first pass of *that* new pair instead.
//   4. Repeat step 3 forever. Because we always watch the FIRST pass of
//      the newest pair (not every single pass), each trigger still leaves
//      at least one full untouched pass ahead on screen at the moment it
//      fires — content never runs out mid-scroll.
// Passes fully scrolled off are recycled (removed from the DOM), and the
// running offset is corrected by that exact pass's real height at the
// moment it's removed — never an assumed/cached one — so the DOM and the
// numbers both stay bounded over a multi-hour stream without ever
// drifting out of sync with what's actually on screen.
let currentThemeId = null; // last-applied theme id, so a poll with unchanged theme never re-touches the DOM/font link

const LAYOUT_CLASS_PREFIX = 'ovs-credits-layout--';
const DEFAULT_LAYOUT = 'classic'; // 'classic' has no CSS rules of its own (see credits.html) — it's just "no layout class applied"

// Swaps the `ovs-credits-layout--*` class on #ovs-credits-root so the
// `.ovs-credits-layout--grid` / `.ovs-credits-layout--stacked` rules in
// credits.html take over. Pure class bookkeeping — never touches the row
// markup itself, so it's safe to call on every theme change regardless of
// whether the layout id actually changed.
function applyLayout(layoutId) {
  const root = document.getElementById('ovs-credits-root');
  if (!root) return;
  Array.from(root.classList)
    .filter((cls) => cls.startsWith(LAYOUT_CLASS_PREFIX))
    .forEach((cls) => root.classList.remove(cls));
  const resolved = layoutId || DEFAULT_LAYOUT;
  if (resolved !== DEFAULT_LAYOUT) {
    root.classList.add(LAYOUT_CLASS_PREFIX + resolved);
  }
}

// Applies a Credits theme preset (see shared/credits-theme-presets.js) to the
// page: every `vars` entry becomes a CSS custom property on :root (picked up
// immediately by the existing var()-based rules in credits.html), the
// Google Fonts <link> is swapped only when the preset's font href actually
// changed (avoids refetching/reflashing fonts on every 3s poll when nothing
// changed), and the preset's `layout` swaps which row structure renders —
// see applyLayout() above.
function applyTheme(theme) {
  if (!theme || theme.id === currentThemeId) return;
  currentThemeId = theme.id;

  const root = document.documentElement;
  Object.entries(theme.vars || {}).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });

  const fontLink = document.getElementById('ovs-credits-font-link');
  if (fontLink && theme.googleFontHref && fontLink.href !== theme.googleFontHref) {
    fontLink.href = theme.googleFontHref;
  }

  applyLayout(theme.layout);
}

let activeBlocks = []; // the section/items pairs for the current data, reused to build each new pass
let passEls = []; // pass wrapper elements currently in the track, oldest (topmost) first
let trackGapPx = 10; // px gap between passes, read from the track's own CSS so JS never hardcodes a value that could drift from the stylesheet
let pxPerSecond = 0; // scroll speed in px/sec, set once per render() from the reading-pace formula
let offsetPx = 0; // current scroll distance (px); transform is always translateY(-offsetPx)
let watchIdx = 0; // index into passEls of the pass we're waiting to fully exit before spawning the next pair
let rafId = null;
let lastFrameTime = null;

function buildPass(blocks) {
  const pass = el('div', 'ovs-credits-pass');
  blocks.forEach(({ section, items }, idx) => appendSectionBlock(pass, section, items, idx === 0));
  return pass;
}

function appendPasses(count) {
  for (let i = 0; i < count; i += 1) {
    const pass = buildPass(activeBlocks);
    currentTrack.appendChild(pass);
    passEls.push(pass);
  }
}

// Tears down whatever passes currently exist and rebuilds exactly the
// starting state: 2 fresh passes, scrolled to translateY(0). Used both for
// the very first render() and for "restart from the top" (Start after
// Stop, or an explicit Start while already playing).
function resetPasses() {
  if (!currentTrack || activeBlocks.length === 0) return;
  passEls.forEach((pass) => pass.remove());
  passEls = [];
  offsetPx = 0;
  watchIdx = 0;
  currentTrack.style.transform = 'translateY(0px)';
  appendPasses(2);
}

// A pass's live bottom edge, in "distance from the top of the screen"
// terms: positive while it's still below the top edge (fully or partly
// visible), zero or negative once it has fully scrolled past. Reads
// offsetTop/offsetHeight fresh every call — never a cached number — so an
// avatar image reflowing a row mid-scroll is reflected immediately instead
// of silently going stale.
function passBottom(pass) {
  return pass.offsetTop + pass.offsetHeight - offsetPx;
}

function tick(now) {
  if (lastFrameTime == null) lastFrameTime = now;
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  if (pxPerSecond > 0 && passEls.length) {
    offsetPx += pxPerSecond * dt;

    // Step 3: the watched pass has fully scrolled past the ceiling —
    // queue up the next pair and hand watch duty to its first pass.
    const watched = passEls[watchIdx];
    if (watched && passBottom(watched) <= 0) {
      const nextWatchIdx = passEls.length;
      appendPasses(2);
      watchIdx = nextWatchIdx;
    }

    // Recycle: drop passes from the front once they're fully off-screen.
    // Never touches the pass currently being watched (guarded by
    // `watchIdx > 0`) and never empties the track entirely. The offset
    // correction uses the pass's REAL height at this exact moment
    // (offsetHeight, read right before removal) rather than any earlier
    // estimate, so removing it can never introduce drift even if that
    // pass's height changed after it was built.
    while (passEls.length > 1 && watchIdx > 0 && passBottom(passEls[0]) <= 0) {
      const front = passEls.shift();
      offsetPx -= front.offsetHeight + trackGapPx;
      watchIdx -= 1;
      front.remove();
    }

    currentTrack.style.transform = `translateY(${-offsetPx}px)`;
  }

  rafId = requestAnimationFrame(tick);
}

// Starts (or restarts, from the very top) the scroll loop on the current
// track. Always rebuilds via resetPasses() first — otherwise "Start" after
// a "Stop" would resume wherever it left off instead of rolling up from the
// beginning each time.
function startAnimation() {
  if (!currentTrack) return;
  resetPasses();
  lastFrameTime = null;
  trackIsRunning = true;
  if (rafId == null) rafId = requestAnimationFrame(tick);
}

// Freezes the track at the top (not just "paused wherever it happened to
// be") so loaded-but-not-started data reads as a normal static list.
function stopAnimation() {
  if (!currentTrack) return;
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  resetPasses();
  trackIsRunning = false;
}

// Applies the current isPlaying flag to the DOM. Only actually touches the
// animation when the on-screen state doesn't already match `isPlaying` —
// this poll runs every few seconds, and calling startAnimation() on an
// already-running track resets it back to 0% every time, which is what
// made the roll visibly stutter/restart on a loop instead of scrolling
// smoothly. `force` re-applies unconditionally: used right after a brand
// new track is built (its CSS starts "running" by default and needs to be
// pinned one way or the other) and for explicit play/pause commands from
// the dashboard (an explicit "Start" click should always restart from the
// top, even if — in some edge case — it was already playing).
function applyPlayState(force = false) {
  if (isPlaying) {
    if (force || !trackIsRunning) startAnimation();
  } else if (force || trackIsRunning) {
    stopAnimation();
  }
}

// The dashboard's live preview embeds this page in a same-app iframe and
// can therefore signal play/pause instantly, instead of waiting on the
// next poll — see CreditsPanel.jsx's iframe ref + postMessage calls.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.source !== 'ovs-credits-control') return;
  if (data.type === 'play') {
    isPlaying = true;
    localOverrideUntilNextData = true;
    applyPlayState(true);
  } else if (data.type === 'pause') {
    isPlaying = false;
    localOverrideUntilNextData = true;
    applyPlayState(true);
  }
});

function el(tag, className, children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (children != null) {
    (Array.isArray(children) ? children : [children]).forEach((child) => {
      if (child == null) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
  }
  return node;
}

// `showScore` is false for Top Chatters ("viewers"): XP/score is
// intentionally left off that section, same as before it had its own grid
// cells.
function buildRow(item, { showScore = true } = {}) {
  const row = el('div', 'ovs-credits-row');
  row.appendChild(el('span', 'ovs-credits-rank', item.rank ? `#${item.rank}` : ''));

  if (item.avatarUrl) {
    const img = document.createElement('img');
    img.className = 'ovs-credits-avatar';
    img.src = item.avatarUrl;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    row.appendChild(img);
  } else {
    const initial = (item.name || '?').trim().charAt(0).toUpperCase() || '?';
    row.appendChild(el('span', 'ovs-credits-avatar ovs-credits-avatar--fallback', initial));
  }

  const info = el('div', 'ovs-credits-info', [el('div', 'ovs-credits-name', item.name || '')]);
  if (item.badge) info.appendChild(el('div', 'ovs-credits-badge', item.badge));
  row.appendChild(info);

  if (showScore && item.scoreLabel) {
    row.appendChild(el('span', 'ovs-credits-score', item.scoreLabel));
  }

  return row;
}

// Every section that has data becomes: [header row] + [item rows] inside
// ONE shared track, in section.order. That single track is what scrolls,
// StreamLabs "Stream Credits" style. Every section — including Top
// Chatters — renders one person per row; Top Chatters just hides the score
// column.
function appendSectionBlock(container, section, items, isFirst) {
  const headerCls = isFirst ? 'ovs-credits-header' : 'ovs-credits-header ovs-credits-header--spaced';
  container.appendChild(
    el('div', headerCls, [
      el('span', 'ovs-credits-accent'),
      el('span', 'ovs-credits-title', section.label),
    ])
  );

  const showScore = section.id !== 'viewers';
  items.forEach((item) => container.appendChild(buildRow(item, { showScore })));
}

// "Reading units" for one section — used to size the scroll duration: one
// unit per header, one unit per row.
function sectionUnits(section, items) {
  return 1 + items.length; // header + one row per item
}

function render(payload) {
  const root = document.getElementById('ovs-credits-root');
  if (!root) return;

  // Tear down any in-flight loop before ripping out the DOM it's driving —
  // otherwise a stray rAF callback could touch a now-detached track.
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  root.innerHTML = '';
  const sections = (payload && payload.sections) || [];
  const snapshots = (payload && payload.snapshots) || {};

  // Only keep sections that actually have data to show.
  const blocks = sections
    .map((section) => ({ section, items: (snapshots[section.id]?.ok && snapshots[section.id].items) || [] }))
    .filter((block) => block.items.length > 0);

  if (blocks.length === 0) {
    root.classList.add('is-empty');
    currentTrack = null;
    activeBlocks = [];
    passEls = [];
    return;
  }
  root.classList.remove('is-empty');

  const track = el('div', 'ovs-credits-track');
  root.appendChild(track); // must be in the real DOM before anything about it can be measured

  currentTrack = track;
  activeBlocks = blocks;

  // Read the real gap from CSS instead of hardcoding it, so JS can't drift
  // out of sync with the stylesheet.
  const trackGapValue = parseFloat(getComputedStyle(track).rowGap);
  trackGapPx = Number.isFinite(trackGapValue) ? trackGapValue : 10;

  resetPasses(); // builds the starting 2 passes

  const totalUnits = blocks.reduce((sum, { section, items }) => sum + sectionUnits(section, items), 0);

  // `scrollSpeed` is literally "rows (names) per second", 1-5 — not an
  // abstract multiplier. So the whole pass (totalUnits rows/headers) should
  // take totalUnits / speed seconds to cross the screen. pxPerSecond is then
  // derived from the first pass's live height so that timing holds
  // regardless of how tall each row actually renders (avatars, wrapping,
  // etc.) — this is only a *pacing* estimate (if avatars haven't finished
  // loading yet it may be off by a little), not something the loop's
  // correctness depends on — see the block comment above.
  const speed = Number(payload && payload.scrollSpeed) > 0 ? Number(payload.scrollSpeed) : 2;
  const durationSec = Math.max(1, totalUnits / speed);
  const firstPassHeight = (passEls[0] && passEls[0].offsetHeight) || 1;
  pxPerSecond = firstPassHeight / durationSec;

  trackIsRunning = false; // brand new element — must be pinned explicitly either way
  applyPlayState(true);
}

async function poll() {
  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const payload = await res.json();

    // Applied on every poll (not gated by dataChanged below) so a theme
    // switch takes effect immediately even while the roll is sitting empty
    // (no sections with data yet) — applyTheme() itself no-ops once the
    // same theme id is already active, so this stays cheap.
    applyTheme(payload.theme);

    // Change detection is deliberately scoped to ONLY the fields that
    // actually require rebuilding the row DOM: sections/snapshots (who's
    // shown) and scrollSpeed (pacing math). `theme` and `isPlaying` are
    // handled separately above/below and must never be part of this
    // signature — they used to be (this was `JSON.stringify(payload)`,
    // the whole response), which meant switching a Credits preset, or even
    // just toggling play/pause, changed the signature and forced a full
    // render(): every pass/row/avatar element torn down and recreated,
    // avatars re-fetched, and the crawl reset back to the very top. That's
    // what made picking a new preset feel like a slow reload even though
    // the underlying leaderboard data never changed. Theme swaps now only
    // touch CSS variables + a layout class (see applyTheme/applyLayout) —
    // instant, and the crawl keeps scrolling exactly where it was.
    const dataSignature = JSON.stringify({
      sections: payload.sections,
      snapshots: payload.snapshots,
      scrollSpeed: payload.scrollSpeed,
    });
    const dataChanged = dataSignature !== lastPayloadJson;
    lastPayloadJson = dataSignature;

    const previousIsPlaying = isPlaying;

    // The server is the eventual source of truth for isPlaying. A local
    // postMessage override (from the embedded dashboard preview) wins
    // until the server catches up to that same value — after that, hand
    // control back to the normal poll so the real OBS output (which can't
    // receive postMessage) stays in sync too.
    const serverIsPlaying = !!payload.isPlaying;
    if (localOverrideUntilNextData && serverIsPlaying === isPlaying) {
      localOverrideUntilNextData = false;
    }
    if (!localOverrideUntilNextData) {
      isPlaying = serverIsPlaying;
    }

    if (dataChanged) {
      render(payload);
    } else {
      // force=false: only (re)start the animation if isPlaying actually
      // flipped since the last poll. A steady "still playing, nothing new"
      // poll must leave the already-scrolling track completely alone.
      applyPlayState(isPlaying !== previousIsPlaying);
    }
  } catch (err) {
    console.warn('[credits-overlay] poll failed:', err);
  }
}

poll();
setInterval(poll, POLL_INTERVAL_MS);
