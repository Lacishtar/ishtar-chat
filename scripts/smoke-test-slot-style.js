const {
  DEFAULT_SLOT_STYLE_CONFIG,
  mergeSlotStyleConfig,
  compileSlotStyleToCssVariables,
  resolveEffectiveSlotStyle,
} = require('../shared/slot-style-config');
const {
  DEFAULT_ANIMATION_CONFIG,
  compileAnimationToCssVariables,
  expandSimpleAnimation,
  contractSimpleAnimation,
} = require('../shared/animation-config');
const { DEFAULT_CUSTOMIZE_CONFIG } = require('../shared/customize-config');
const { expandSimpleLayout, contractSimpleLayout } = require('../shared/layout-config');

function fail(message) {
  throw new Error(`[smoke:slot-style] ${message}`);
}

function assert(cond, message) {
  if (!cond) fail(message);
}

const custom = {
  ...DEFAULT_CUSTOMIZE_CONFIG,
  fontSize: 18,
  authorColor: '#AABBCC',
  textColor: '#112233',
  avatarSize: 40,
  showAvatar: true,
};

const slotStyle = mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, {
  slots: {
    author: { fontSize: 14, color: '#FF0000' },
    message: { fontSize: 20, fontFamily: 'Mono' },
    avatar: { size: 48, visible: true, rotate: -7, translateX: 4 },
  },
});

const vars = compileSlotStyleToCssVariables(slotStyle, custom);
assert(vars['--ovs-slot-author-font-size'] === '14px', 'author font size');
assert(vars['--ovs-slot-author-color'] === '#FF0000', 'author color override');
assert(vars['--ovs-slot-message-font-size'] === '20px', 'message font size');
assert(vars['--ovs-slot-avatar-size'] === '48px', 'avatar size override');
assert(vars['--ovs-slot-avatar-rotate'] === '-7deg', 'avatar rotate');
assert(vars['--ovs-slot-avatar-translate-x'] === '4px', 'avatar translateX');

const borderStyle = mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, {
  slots: {
    avatar: {
      borderWidth: 3,
      borderStyle: 'dashed',
      borderColor: '#00FF00',
      borderRadius: '50%',
    },
  },
});
const borderVars = compileSlotStyleToCssVariables(borderStyle, custom);
assert(borderVars['--ovs-slot-avatar-border-width'] === '3px', 'avatar border width');
assert(borderVars['--ovs-slot-avatar-border-style'] === 'dashed', 'avatar border style');
assert(borderVars['--ovs-slot-avatar-border-color'] === '#00FF00', 'avatar border color');
assert(borderVars['--ovs-slot-avatar-border-radius'] === '50%', 'avatar border radius percent');

const effective = resolveEffectiveSlotStyle(
  mergeSlotStyleConfig(DEFAULT_SLOT_STYLE_CONFIG, { slots: { avatar: { visible: false } } }),
  custom
);
assert(effective.avatar.visible === false, 'slot visible overrides global showAvatar');

const animVars = compileAnimationToCssVariables(DEFAULT_ANIMATION_CONFIG, custom);
assert(animVars['--ovs-anim-author-delay'] === '40ms', 'author anim delay');
assert(animVars['--ovs-anim-enabled'] === '1', 'anim enabled');

const expanded = expandSimpleAnimation({ authorDelay: 100 }, custom);
assert(expanded.targets.author.delayMs === 100, 'expand simple animation');

const layout = expandSimpleLayout({
  avatarPadding: 4,
  showAuthorSlot: false,
});
assert(layout.slots.avatar.padding === 4, 'layout avatar padding');
assert(layout.slots.author.visible === false, 'layout author visibility');

const contracted = contractSimpleLayout(layout);
assert(contracted.avatarPadding === 4, 'contract avatar padding');
assert(contracted.showAuthorSlot === false, 'contract author visibility');

const { resolveThemeState } = require('../main/store/theme-state');
const scrapbook = resolveThemeState('scrapbook');
assert(scrapbook.slotStyleConfig.slots.avatar.rotate === -7, 'scrapbook preset rotate');
assert(scrapbook.layoutConfig.messageRow.gap === 14, 'scrapbook preset layout gap');

console.log('[smoke:slot-style] all checks passed');
