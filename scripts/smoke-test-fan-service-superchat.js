// Verifies shared/fan-service-config.js's `superchat` group — the fields
// moved wholesale from shared/role-style-config.js's old Super Chat role
// during the Super Chat -> Fan Service refactor
// (docs/refactor-superchat-to-fanservice.md): badge, tier-color/manual-
// color, and amount display (position/scale/weight).
const {
  DEFAULT_FAN_SERVICE_CONFIG,
  mergeFanServiceConfig,
  compileFanServiceCss,
} = require('../shared/fan-service-config');

function assert(condition, message) {
  if (!condition) throw new Error(`[smoke:fan-service-superchat] ${message}`);
}

// ── Defaults ────────────────────────────────────────────────────────────────
assert(DEFAULT_FAN_SERVICE_CONFIG.superchat.enabled === false, 'superchat group off by default');
assert(DEFAULT_FAN_SERVICE_CONFIG.superchat.useTierColor === true, 'useTierColor on by default');
assert(DEFAULT_FAN_SERVICE_CONFIG.superchat.showAmount === true, 'showAmount on by default');
assert(DEFAULT_FAN_SERVICE_CONFIG.superchat.amountPosition === 'inline', 'amountPosition inline by default');
assert(DEFAULT_FAN_SERVICE_CONFIG.superchat.amountFontWeight === 'bold', 'amountFontWeight bold by default');
// Fields exist on membership too (same shape, ignored there) — see
// shared/fan-service-config.js's createGroupConfig comment.
assert('badgeBefore' in DEFAULT_FAN_SERVICE_CONFIG.membership, 'membership carries the same shape (unused fields included)');

// ── Badge + tier-color CSS ──────────────────────────────────────────────────
const withBadge = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: { enabled: true, badgeBefore: '✦', badgeAfter: 'VIP' },
});
const cssTierColor = compileFanServiceCss(withBadge);
assert(cssTierColor.includes('.ovs-message.ovs-superchat'), 'compiles a superchat-scoped block');
assert(cssTierColor.includes('"✦"'), 'badgeBefore compiles to quoted CSS content');
assert(cssTierColor.includes('"VIP"'), 'badgeAfter compiles to quoted CSS content');
assert(cssTierColor.includes('var(--ovs-superchat-tier-bg'), 'useTierColor true reads the per-message tier bg var');
assert(cssTierColor.includes('var(--ovs-superchat-tier-color'), 'useTierColor true reads the per-message tier color var');
// Contrast fix present (tiers 1-2 forced dark, base rule forces white)
assert(cssTierColor.includes("data-ovs-superchat-tier='1']"), 'tier-1 contrast-fix selector present');
assert(cssTierColor.includes("data-ovs-superchat-tier='2']"), 'tier-2 contrast-fix selector present');
assert(cssTierColor.includes('#0a0a0a'), 'tier 1/2 contrast-fix uses near-black text');

// ── Manual color (useTierColor: false) ──────────────────────────────────────
const manualColor = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: { enabled: true, useTierColor: false, authorColor: '#ff00ff' },
});
const cssManual = compileFanServiceCss(manualColor);
assert(!cssManual.includes('var(--ovs-superchat-tier-bg'), 'useTierColor false does not read the tier bg var');
assert(cssManual.includes('#ff00ff'), 'useTierColor false uses the manual authorColor');
assert(!cssManual.includes("data-ovs-superchat-tier='1']"), 'useTierColor false skips the tier contrast-fix entirely');

// manualBgColor/manualBorderColor — bubble bg/border when tier color is off,
// instead of being permanently locked to the hardcoded fallback.
const manualBubbleColor = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: { enabled: true, useTierColor: false, manualBgColor: '#112233', manualBorderColor: '#445566' },
});
const cssManualBubble = compileFanServiceCss(manualBubbleColor);
assert(cssManualBubble.includes('#112233'), 'manualBgColor overrides the row background when useTierColor is false');
assert(cssManualBubble.includes('#445566'), 'manualBorderColor overrides the row border when useTierColor is false');
// Leaving them unset must keep the old hardcoded look identical (no
// regression for existing configs saved before this field existed).
assert(cssManual.includes('rgba(104, 87, 34, 0.8)'), 'manualBgColor null falls back to the original hardcoded bg');
assert(cssManual.includes('rgba(255, 202, 40, 0.45)'), 'manualBorderColor null falls back to the original hardcoded border');

// Bubble shape/border-width/opacity/shadow/glow — independent of
// useTierColor (applies whether tier color is on or off), unlike
// manualBgColor/manualBorderColor above which only matter when it's off.
const bubbleShape = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: {
    enabled: true,
    useTierColor: true, // deliberately ON — shape fields must still apply
    bubbleBorderWidth: 3,
    bubbleBorderStyle: 'dashed',
    bubbleRadius: 22,
    bubbleOpacity: 0.8,
    bubbleBoxShadow: '0 4px 10px rgba(0,0,0,0.5)',
    bubbleGlow: 'drop-shadow(0 0 8px #ff00ff)',
  },
});
const cssBubbleShape = compileFanServiceCss(bubbleShape);
assert(cssBubbleShape.includes('border-width: 3px'), 'bubbleBorderWidth compiles even when useTierColor is on');
assert(cssBubbleShape.includes('border-style: dashed'), 'bubbleBorderStyle compiles');
assert(cssBubbleShape.includes('border-radius: 22px'), 'bubbleRadius compiles');
assert(cssBubbleShape.includes('opacity: 0.8'), 'bubbleOpacity compiles');
assert(cssBubbleShape.includes('box-shadow: 0 4px 10px rgba(0,0,0,0.5)'), 'bubbleBoxShadow compiles');
assert(cssBubbleShape.includes('filter: drop-shadow(0 0 8px #ff00ff)'), 'bubbleGlow compiles');
// Still on tier color for bg/border (not manual), since useTierColor: true here.
assert(cssBubbleShape.includes('var(--ovs-superchat-tier-bg'), 'bg still reads the tier var when useTierColor stays true');

// ── Amount display: showAmount has no off switch any more ──────────────────
// There is no user-facing toggle for this — mergeGroupConfig always forces
// showAmount back to true, so even an explicit `showAmount: false` override
// must NOT hide .ovs-superchat-amount.
const amountOff = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: { enabled: true, showAmount: false },
});
assert(amountOff.superchat.showAmount === true, 'showAmount is always forced true, ignoring overrides');
const cssAmountOff = compileFanServiceCss(amountOff);
assert(
  !/\.ovs-superchat-amount\s*\{\s*display: none/.test(cssAmountOff),
  'showAmount can no longer hide .ovs-superchat-amount — it is always on',
);

// ── Amount display: block position + custom scale/weight ───────────────────
const amountBlock = mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, {
  superchat: { enabled: true, amountPosition: 'block', amountFontScale: 2, amountFontWeight: 'extrabold' },
});
const cssAmountBlock = compileFanServiceCss(amountBlock);
assert(cssAmountBlock.includes('display: block !important'), 'amountPosition block compiles to display: block');
assert(cssAmountBlock.includes('font-size: 32px !important'), 'amountFontScale 2 * BASE_SIZES.amountFontSize(16) = 32px');
assert(cssAmountBlock.includes('font-weight: 900 !important'), 'amountFontWeight extrabold maps to 900');

// ── Group disabled: no superchat CSS at all ─────────────────────────────────
const disabled = compileFanServiceCss(DEFAULT_FAN_SERVICE_CONFIG);
assert(!disabled.includes('.ovs-superchat-amount'), 'disabled superchat group emits nothing for the amount badge');
assert(!disabled.includes('.ovs-message.ovs-superchat'), 'disabled superchat group emits no scoped block at all');

console.log('[smoke:fan-service-superchat] all checks passed');
