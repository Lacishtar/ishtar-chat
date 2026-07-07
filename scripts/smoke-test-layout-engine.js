// Proves the Layout Engine compiles layout.settings from every legacy theme
// into the CSS custom properties theme style.css files consume.
const fs = require('fs');
const path = require('path');
const { loadThemeDocument, listThemeIds, compileLayoutToCssVariables } = require('../main/theme-engine');
const { THEMES_DIR } = require('../main/theme-registry');
const { DEFAULT_LAYOUT_CONFIG, compileLayoutToCssVariables: compileFromConfig, contractSimpleLayout, expandSimpleLayout } = require('../shared/layout-config');

const EXPECTED_THEME_IDS = ['classic', 'bubble', 'glass', 'minimal', 'anime', 'cyber', 'danmaku', 'ticker', 'scrapbook'];
const EXPECTED_VARS = [
  '--ovs-layout-message-direction',
  '--ovs-layout-message-gap',
  '--ovs-layout-slot-avatar-order',
  '--ovs-layout-slot-author-order',
  '--ovs-layout-slot-badges-order',
  '--ovs-layout-slot-message-order',
];

function fail(message) {
  throw new Error(`[smoke:layout-engine] ${message}`);
}

function varsUsedByStylesheet(themeId) {
  const cssPath = path.join(THEMES_DIR, themeId, 'style.css');
  const css = fs.readFileSync(cssPath, 'utf-8');
  const regex = /var\(\s*(--ovs-layout-[a-z-]+)/g;
  const found = new Set();
  let match = regex.exec(css);
  while (match !== null) {
    found.add(match[1]);
    match = regex.exec(css);
  }
  return found;
}

function checkTheme(themeId) {
  const doc = loadThemeDocument(themeId);
  if (!doc.layout.settings) fail(`${themeId}: layout.settings missing from ThemeDocument`);

  const compiled = compileLayoutToCssVariables(doc.layout);
  const direct = compileFromConfig(doc.layout.settings);

  EXPECTED_VARS.forEach((varName) => {
    if (compiled[varName] !== direct[varName]) {
      fail(`${themeId}: ${varName} mismatch between engine and shared compiler`);
    }
  });

  const usedByCss = varsUsedByStylesheet(themeId);
  if (usedByCss.size === 0) fail(`${themeId}: style.css uses zero --ovs-layout-* variables`);

  console.log(`[smoke] ${themeId}: ${usedByCss.size} layout CSS vars referenced in style.css ✔`);
}

function checkDefaults() {
  const compiled = compileFromConfig(DEFAULT_LAYOUT_CONFIG);
  if (compiled['--ovs-layout-message-direction'] !== 'row') {
    fail('default messageRow direction should compile to row');
  }
  console.log('[smoke] DEFAULT_LAYOUT_CONFIG compiles correctly ✔');
}

function checkSimpleRoundtrip() {
  const expanded = expandSimpleLayout({});
  const varsFromDefault = compileFromConfig(DEFAULT_LAYOUT_CONFIG);
  const varsFromExpanded = compileFromConfig(expanded);
  Object.keys(varsFromDefault).forEach((key) => {
    if (varsFromDefault[key] !== varsFromExpanded[key]) {
      fail(`simple expand default mismatch on ${key}`);
    }
  });

  const custom = expandSimpleLayout({
    avatarPosition: 'top',
    nameBadges: 'badges-below',
    messagePosition: 'beside',
    gap: 16,
    padding: 12,
  });
  const contracted = contractSimpleLayout(custom);
  if (contracted.avatarPosition !== 'top') fail('contract avatarPosition roundtrip failed');
  if (contracted.gap !== 16) fail('contract gap roundtrip failed');
  console.log('[smoke] simple layout expand/contract roundtrip ✔');
}

function checkRtlMirror() {
  const rtl = {
    ...DEFAULT_LAYOUT_CONFIG,
    screen: { ...DEFAULT_LAYOUT_CONFIG.screen, contentDirection: 'rtl' },
  };
  const compiled = compileFromConfig(rtl);
  if (compiled['--ovs-layout-message-direction'] !== 'row-reverse') {
    fail('rtl contentDirection should mirror message row to row-reverse');
  }
  if (compiled['--ovs-layout-content-direction'] !== 'ltr') {
    fail('content direction CSS var must stay ltr for correct text rendering');
  }
  console.log('[smoke] RTL layout mirrors via flex, text stays LTR ✔');
}

function checkSlotPosition() {
  const layout = expandSimpleLayout({
    authorPositionMode: 'absolute',
    authorTop: -8,
    authorLeft: 12,
    authorZIndex: 2,
  });
  const compiled = compileFromConfig(layout);
  if (compiled['--ovs-layout-slot-author-position'] !== 'absolute') {
    fail('author absolute position should compile');
  }
  if (compiled['--ovs-layout-slot-author-top'] !== '-8px') fail('author top offset');
  if (compiled['--ovs-layout-slot-author-left'] !== '12px') fail('author left offset');
  if (compiled['--ovs-layout-slot-author-z-index'] !== '2') fail('author z-index');
  console.log('[smoke] slot absolute positioning compiles ✔');
}

function checkBubbleWrap() {
  const messageOnly = compileFromConfig({
    ...DEFAULT_LAYOUT_CONFIG,
    screen: { bubbleWrapRow: false, bubbleWrapMessage: true },
  });
  if (messageOnly['--ovs-bubble-wrap-row'] !== '0') fail('split mode should disable row wrap');
  if (messageOnly['--ovs-bubble-wrap-message'] !== '1') fail('message wrap should compile');

  const rowDefault = compileFromConfig(DEFAULT_LAYOUT_CONFIG);
  if (rowDefault['--ovs-bubble-wrap-row'] !== '1') fail('default should be row wrap');

  const legacyMessage = compileFromConfig({
    ...DEFAULT_LAYOUT_CONFIG,
    screen: { bubbleScope: 'message' },
  });
  if (legacyMessage['--ovs-bubble-wrap-message'] !== '1') fail('legacy bubbleScope message should migrate');

  const contracted = contractSimpleLayout({
    ...DEFAULT_LAYOUT_CONFIG,
    screen: { bubbleWrapRow: false, bubbleWrapAuthor: true, bubbleWrapMessage: true },
  });
  if (contracted.bubbleWrapMode !== 'split') fail('contract split mode failed');
  if (!contracted.bubbleWrapAuthor) fail('contract author wrap failed');

  const expandedSplit = expandSimpleLayout({
    bubbleWrapMode: 'split',
    bubbleWrapAuthor: true,
    bubbleWrapMessage: false,
  });
  if (expandedSplit.screen.bubbleWrapRow !== false) fail('expand split should set bubbleWrapRow false');
  if (!expandedSplit.screen.bubbleWrapAuthor) fail('expand author wrap failed');

  const expandedRow = expandSimpleLayout({ bubbleWrapMode: 'row' });
  if (expandedRow.screen.bubbleWrapRow !== true) fail('expand row should set bubbleWrapRow true');
  if (expandedRow.screen.bubbleWrapMessage) fail('expand row should clear message wrap');
  if (expandedRow.screen.bubbleScope != null) fail('expand row should clear legacy bubbleScope');

  console.log('[smoke] bubbleWrap compiles and roundtrips ✔');
}

function main() {
  const ids = listThemeIds();
  EXPECTED_THEME_IDS.forEach((id) => {
    if (!ids.includes(id)) fail(`listThemeIds() is missing "${id}"`);
  });
  checkDefaults();
  checkRtlMirror();
  checkSimpleRoundtrip();
  checkSlotPosition();
  checkBubbleWrap();
  EXPECTED_THEME_IDS.forEach(checkTheme);
  console.log('[smoke] ALL CHECKS PASSED');
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
