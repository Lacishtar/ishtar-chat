// Verifies the movement/idle/render DOM layer split described in the
// architecture doc: each message node is
//   .ovs-slot   (movement: JS ticker translate3d / CSS danmaku fly / none)
//     > .ovs-idle (idle: idle-animations.css float/slidex, always)
//       > .ovs-message (render: bubble background/padding/radius + slots)
//
// Loads the REAL overlay CSS files + the real theme template.html into
// jsdom (same approach as verify-decoration-cascade.js) and asserts, for
// every display mode, that:
//   - .ovs-idle always carries the idle float animation (no mode branching)
//   - .ovs-slot only gets movement positioning/animation in ticker/danmaku
//   - .ovs-message NEVER carries any animation itself — the render layer
//     must stay free of both movement and idle, or a future effect added
//     there would silently re-create the original bug (two writers on
//     one element's `transform`).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const OVERLAY_DIR = path.join(__dirname, '..', 'overlay');
// Same order as overlay/index.html <link> tags.
const CSS_FILES = [
  'base-layout.css',
  'layout-text.css',
  'slot-layout.css',
  'slot-visibility.css',
  'slot-animations.css',
  'slot-transforms.css',
  'slot-decorations.css',
  'decoration-layers.css',
  'role-styles.css',
  'bubble-frame.css',
  'bubble-wrap.css',
  'danmaku.css',
  'ticker.css',
  'idle-animations.css',
];

const css = CSS_FILES.map((f) => fs.readFileSync(path.join(OVERLAY_DIR, f), 'utf8')).join('\n');
// The message template is now inlined directly in overlay/index.html
// (#ovs-message-template) rather than living in a separate per-theme
// template.html — extract it from there.
const overlayHtml = fs.readFileSync(path.join(OVERLAY_DIR, 'index.html'), 'utf8');
const templateMatch = overlayHtml.match(/<template id="ovs-message-template">[\s\S]*?<\/template>/);
if (!templateMatch) throw new Error('could not find #ovs-message-template in overlay/index.html');
const templateHtml = templateMatch[0];

let failures = 0;
function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    failures += 1;
    console.error(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok: ${label} = ${JSON.stringify(actual)}`);
  }
}

function buildNode(mode) {
  const dom = new JSDOM(
    `<!doctype html><html><head><style>${css}</style></head><body>
      <div id="ovs-chat-list" data-ovs-theme-mode="${mode}" data-ovs-idle-animation="float"></div>
      ${templateHtml}
    </body></html>`,
    { pretendToBeVisual: true }
  );
  const { document } = dom.window;
  const tpl = document.querySelector('template');
  const slot = document.importNode(tpl.content.firstElementChild, true);
  document.getElementById('ovs-chat-list').appendChild(slot);
  return { dom, slot };
}

// jsdom's computed-style object doesn't expand the `animation` shorthand
// into the longhand `animationName`, so check both forms and combine —
// whichever the CSS source actually used will show up in one of them.
function animationNameOf(win, el) {
  const cs = win.getComputedStyle(el);
  return (cs.getPropertyValue('animation-name') || '') + (cs.animation || '');
}

['stack', 'ticker', 'danmaku'].forEach((mode) => {
  console.log(`\n--- mode=${mode} ---`);
  const { dom, slot } = buildNode(mode);
  const idle = slot.querySelector('.ovs-idle');
  const message = slot.querySelector('.ovs-message');

  assertEqual(`${mode}: root is .ovs-slot`, slot.className, 'ovs-slot');
  assertEqual(`${mode}: .ovs-idle present`, Boolean(idle), true);
  assertEqual(`${mode}: .ovs-message present`, Boolean(message), true);

  // Idle always owns .ovs-idle's animation, in every mode — no branching.
  const idleAnim = animationNameOf(dom.window, idle);
  assertEqual(`${mode}: .ovs-idle carries ovs-idle-float`, idleAnim.includes('ovs-idle-float'), true);

  // The render layer must never carry an animation of its own.
  const messageAnim = animationNameOf(dom.window, message);
  assertEqual(`${mode}: .ovs-message carries no animation`, messageAnim.trim(), '');

  // Movement layer: only positioned/animated in ticker & danmaku.
  const slotStyle = dom.window.getComputedStyle(slot);
  const slotAnim = animationNameOf(dom.window, slot);
  if (mode === 'stack') {
    assertEqual(`${mode}: .ovs-slot has no movement animation`, slotAnim.trim(), '');
  } else if (mode === 'ticker') {
    assertEqual(`${mode}: .ovs-slot is positioned for JS movement`, slotStyle.position, 'absolute');
  } else if (mode === 'danmaku') {
    assertEqual(`${mode}: .ovs-slot carries ovs-danmaku-fly`, slotAnim.includes('ovs-danmaku-fly'), true);
  }
});

if (failures > 0) {
  console.error(`\n[verify-layer-split] FAILED — ${failures} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log('\n[verify-layer-split] PASSED — movement/idle/render layers each own exactly one transform, in every display mode.');
}
