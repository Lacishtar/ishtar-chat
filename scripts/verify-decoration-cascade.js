// Loads the REAL overlay CSS files (decoration-layers.css + bubble-wrap.css,
// in actual <link> order) into jsdom and checks getComputedStyle on a
// .ovs-decoration-host built the same way overlay/modules/decoration.js
// builds it, for every anchor/stack-layer combination. This proves the
// cascade fix in overlay/bubble-wrap.css actually restores the intended
// position/z-index for .ovs-decoration-host, using the browser's own
// selector-matching + specificity engine rather than manual reasoning.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const OVERLAY_DIR = path.join(__dirname, '..', 'overlay');

// Same order as overlay/index.html <link> tags.
const CSS_FILES = [
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

function buildDom({ bubbleWrapRow = 'true' } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><style>${css}</style></head><body>
    <div id="ovs-chat-list" data-ovs-theme-mode="stack">
      <div class="ovs-message" data-has-decoration="true">
        <div class="ovs-decoration-host" data-for-anchor="row" data-stack-layer="foreground" id="fg-host"></div>
        <div class="ovs-decoration-host" data-for-anchor="row" data-stack-layer="background" id="bg-host"></div>
        <div class="ovs-body"><div class="ovs-meta"><div class="ovs-author" data-slot="author"></div></div>
        <div class="ovs-text" data-slot="message"></div></div>
      </div>
    </div>
  </body></html>`, { pretendToBeVisual: true });
  dom.window.document.documentElement.setAttribute('data-ovs-bubble-wrap-row', bubbleWrapRow);
  return dom;
}

function check(dom) {
  const { document } = dom.window;
  const fg = document.getElementById('fg-host');
  const bg = document.getElementById('bg-host');
  const fgStyle = dom.window.getComputedStyle(fg);
  const bgStyle = dom.window.getComputedStyle(bg);
  return {
    fgPosition: fgStyle.position,
    fgZIndex: fgStyle.zIndex,
    bgPosition: bgStyle.position,
    bgZIndex: bgStyle.zIndex,
  };
}

const dom = buildDom({ bubbleWrapRow: 'true' });
const result = check(dom);

console.log('Computed style for .ovs-decoration-host under real cascade (bubble-wrap-row=true):');
console.log(result);

const failures = [];
if (result.fgPosition !== 'absolute') failures.push(`foreground host position should be "absolute", got "${result.fgPosition}"`);
if (result.fgZIndex !== '50') failures.push(`foreground host z-index should be "50", got "${result.fgZIndex}"`);
if (result.bgPosition !== 'absolute') failures.push(`background host position should be "absolute", got "${result.bgPosition}"`);
if (result.bgZIndex !== '0') failures.push(`background host z-index should be "0", got "${result.bgZIndex}"`);

if (failures.length) {
  console.error('\n[verify-decoration-cascade] FAILED:');
  failures.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}

console.log('\n[verify-decoration-cascade] PASSED — decoration host keeps its intended position/z-index through the real bubble-wrap.css cascade.');
