// Loads the REAL overlay CSS (role-styles.css) + a real compileFanServiceCss()
// output into jsdom, and checks getComputedStyle for a superchat row.
//
// Before the Super Chat -> Fan Service refactor
// (docs/refactor-superchat-to-fanservice.md), role-styles.css had its own
// `data-ovs-role-superchat-*`-gated !important rules for Super Chat, and
// this test existed to prove Fan Service's colors won over them even when
// Vai trò (Role) was also "enabled" for Super Chat — a real cascade fight.
// After the refactor, role-styles.css has ZERO Super Chat awareness (no
// more roles.superchat, no more data-ovs-role-superchat-* selectors at
// all) — see role-styles.css's file header comment — so there is no
// cascade fight left to prove. This test now instead verifies two things
// that replaced it:
//   1. Fan Service's superchat CSS applies its own colors on a Super Chat
//      row on its own, with nothing from Role able to interfere anymore.
//   2. A moderator's Role badge (::before content) still renders on a
//      combined .ovs-moderator.ovs-superchat row — role-styles.css's badge
//      selectors no longer exclude :not(.ovs-superchat) (see docs section
//      3.3), so Identity (MOD) and Fan Service (Super Chat color/amount)
//      correctly coexist on the same row instead of one hiding the other.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { compileFanServiceCss } = require('../shared/fan-service-config');
const { compileRoleStyleToCssVariables } = require('../shared/role-style-config');

const OVERLAY_DIR = path.join(__dirname, '..', 'overlay');
const roleStylesCss = fs.readFileSync(path.join(OVERLAY_DIR, 'role-styles.css'), 'utf8');

const fanServiceCss = compileFanServiceCss({
  superchat: { enabled: true, useTierColor: false, authorColor: 'rgb(1, 2, 3)', messageColor: 'rgb(4, 5, 6)' },
});

// Role: moderator enabled with a badge — Identity, no Super Chat knowledge.
const { vars: roleVars, rootFlags: roleFlags } = compileRoleStyleToCssVariables({
  roles: { moderator: { enabled: true, badgeBefore: 'MOD' } },
});
const rootVarsCss = `:root { ${Object.entries(roleVars).map(([k, v]) => `${k}: ${v};`).join(' ')} }`;

// Real <link>/<style> order: role-styles.css loads before the Fan Service
// <style> tag (appended to <head> at runtime by applyFanServiceStyle()).
const html = `<!doctype html><html>
<head><style>${rootVarsCss}</style><style>${roleStylesCss}</style><style id="ovs-fan-service-style">${fanServiceCss}</style></head>
<body>
  <div id="ovs-chat-list">
    <div class="ovs-message ovs-moderator ovs-superchat">
      <div class="ovs-body"><div class="ovs-meta">
        <span class="ovs-author" data-slot="author"></span>
      </div>
      <div class="ovs-text" data-slot="message"></div></div>
    </div>
  </div>
</body></html>`;

const dom = new JSDOM(html, { pretendToBeVisual: true });
const { document } = dom.window;
Object.entries(roleFlags).forEach(([attr, value]) => {
  document.documentElement.setAttribute(attr, value);
});

const author = document.querySelector('.ovs-author');
const text = document.querySelector('.ovs-text');
const authorColor = dom.window.getComputedStyle(author).color;
const textColor = dom.window.getComputedStyle(text).color;

// jsdom's getComputedStyle doesn't support pseudo-elements
// (`Not implemented: ... with pseudo-elements`), so the moderator-badge
// check below is structural (on the CSS text) rather than a computed-style
// assertion: confirms role-styles.css's moderator ::before badge selector
// no longer excludes .ovs-superchat (docs section 3.3), instead of
// asserting the actual rendered content.
const modBadgeSelectorHasSuperchatExclusion =
  /\.ovs-message\.ovs-moderator:not\(\.ovs-superchat\)\s+\.ovs-author::before/.test(roleStylesCss);
const modBadgeSelectorExists =
  /\.ovs-message\.ovs-moderator\s+\.ovs-author::before/.test(roleStylesCss);

const expectedAuthor = 'rgb(1, 2, 3)';
const expectedText = 'rgb(4, 5, 6)';

let ok = true;
if (authorColor !== expectedAuthor) {
  ok = false;
  console.error(`FAIL: .ovs-author color = ${authorColor}, expected ${expectedAuthor} (Fan Service superchat color not applied)`);
}
if (textColor !== expectedText) {
  ok = false;
  console.error(`FAIL: .ovs-text color = ${textColor}, expected ${expectedText} (Fan Service superchat color not applied)`);
}
if (modBadgeSelectorHasSuperchatExclusion) {
  ok = false;
  console.error('FAIL: role-styles.css still excludes .ovs-superchat from the moderator badge selector — a mod+superchat row would show no MOD badge.');
}
if (!modBadgeSelectorExists) {
  ok = false;
  console.error('FAIL: role-styles.css no longer has a moderator ::before badge selector at all.');
}

if (ok) {
  console.log('PASS: Fan Service owns superchat color; Role\'s moderator badge still shows on the same row.');
} else {
  process.exit(1);
}
