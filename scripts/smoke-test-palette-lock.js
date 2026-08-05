/**
 * Smoke Test: Palette Lock Engine (`scripts/smoke-test-palette-lock.js`)
 *
 * Verifies:
 *   1. Palette input normalization (dedupe, uppercase, strip invalid, clamp 2-5)
 *   2. WCAG relative luminance & contrast ratio calculations
 *   3. Color snapping in nested CSS filter / shadow strings
 *   4. End-to-end applyPaletteLock test on a mock bundle with all 3 config buckets
 */

const assert = require('assert');
const {
  normalizePalette,
  getContrastRatio,
  snapCssString,
  applyPaletteLock,
  parseColor,
} = require('../shared/palette-lock');

console.log('[smoke:palette-lock] Running checks...');

// ── Test 1: Palette Normalization ───────────────────────────────────────────
{
  const rawInput = ['#ff0000', ' #FF0000 ', 'invalid-hex', '00ff00', '#0000ff', '#112233', '#445566', '#778899'];
  const normalized = normalizePalette(rawInput);

  assert.strictEqual(normalized.length, 5, 'Should clamp to max 5 colors');
  assert.strictEqual(normalized[0], '#FF0000', 'Should capitalize and strip whitespace');
  assert.strictEqual(normalized[1], '#00FF00', 'Should handle hex missing # prefix');
  assert.strictEqual(normalized[2], '#0000FF', 'Should preserve 6-digit hex');
  assert.strictEqual(normalized[3], '#112233');
  assert.strictEqual(normalized[4], '#445566');

  // Less than 2 valid colors throws error
  assert.throws(() => {
    normalizePalette(['#123456']);
  }, /Palette cần ít nhất 2 mã màu hex hợp lệ/);

  console.log('✓ Test 1 Passed: Palette normalization (dedupe, uppercase, invalid strip, clamp)');
}

// ── Test 2: WCAG Contrast Ratio Math ───────────────────────────────────────
{
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  const whiteOnBlackCR = getContrastRatio(white, black);
  assert.strictEqual(Math.round(whiteOnBlackCR), 21, 'White on Black contrast ratio must be 21:1');

  const sameColorCR = getContrastRatio(white, white);
  assert.strictEqual(Math.round(sameColorCR), 1, 'Same color contrast ratio must be 1:1');

  console.log('✓ Test 2 Passed: WCAG Contrast Ratio math');
}

// ── Test 3: Complex CSS Color Snapping ──────────────────────────────────────
{
  const paletteEntries = [
    { hex: '#FF0000', r: 255, g: 0, b: 0 },
    { hex: '#000000', r: 0, g: 0, b: 0 },
  ];

  const cssInput = 'drop-shadow(0 0 8px rgba(10, 10, 10, 0.6)) 0 4px 12px #fa0000';
  const cssSnapped = snapCssString(cssInput, paletteEntries);

  // rgba(10,10,10,0.6) is closest to #000000 (0,0,0) -> rgba(0, 0, 0, 0.6)
  // #fa0000 is closest to #FF0000
  assert.strictEqual(
    cssSnapped,
    'drop-shadow(0 0 8px rgba(0, 0, 0, 0.6)) 0 4px 12px #FF0000',
    'Should snap nested colors inside CSS strings correctly',
  );

  console.log('✓ Test 3 Passed: Complex CSS color string snapping');
}

// ── Test 4: End-to-End applyPaletteLock ────────────────────────────────────
{
  const mockBundle = {
    customizeConfig: {
      textColor: '#EAECEF',
      authorColor: '#6E56F0',
      bubbleBg: 'rgba(22, 25, 31, 0.72)',
      bubbleBorderColor: '#334155',
      bubbleGlow: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))',
    },
    roleStyleConfig: {
      roles: {
        moderator: {
          enabled: true,
          authorColor: '#fca5a5',
          messageBg: 'rgba(86, 50, 54, 0.78)',
          messageTextColor: '#ffffff',
        },
        member: {
          enabled: true,
          authorColor: '#93c5fd',
          messageBg: 'rgba(30, 58, 95, 0.9)',
          memberTiers: [
            { id: 't1', minMonths: 1, color: '#ffd166' },
          ],
        },
      },
    },
    fanServiceConfig: {
      superchat: {
        enabled: true,
        authorColor: '#6e56f0',
        messageColor: '#eaecef',
        manualBgColor: 'rgba(104, 87, 34, 0.8)',
      },
      membership: {
        enabled: true,
        authorColor: '#6e56f0',
        monthsColor: '#ffd166',
      },
    },
    slotStyleConfig: {
      slots: {
        author: { bubbleBg: 'rgba(17, 17, 17, 0.9)' },
        message: { bubbleBg: null }, // null = inherit bubbleBg, should stay untouched
      },
    },
    layoutConfig: {
      screen: {
        headerSplit: true,
      },
    },
  };

  const palette = ['#0F172A', '#F87171', '#38BDF8', '#FACC15']; // 4 palette colors

  const result = applyPaletteLock(mockBundle, palette);

  // 1. customizeConfig assertions
  const parsedNewBubbleBg = parseColor(result.customizeConfig.bubbleBg);
  assert.strictEqual(parsedNewBubbleBg.r, 15, 'bubbleBg RGB should snap to Main Color #0F172A (15, 23, 42)');
  assert.strictEqual(parsedNewBubbleBg.g, 23);
  assert.strictEqual(parsedNewBubbleBg.b, 42);
  assert.strictEqual(parsedNewBubbleBg.a, 0.72, 'bubbleBg alpha 0.72 should be preserved');

  // Text color on dark #0F172A background should pick a high contrast color from palette (e.g. #F87171 / #38BDF8 / #FACC15)
  assert.ok(palette.includes(result.customizeConfig.textColor) || ['#FFFFFF', '#000000'].includes(result.customizeConfig.textColor));
  assert.ok(palette.includes(result.customizeConfig.authorColor) || ['#FFFFFF', '#000000'].includes(result.customizeConfig.authorColor));

  // 2. roleStyleConfig assertions (Member bubble bg uses Main Color 2 #F87171)
  const parsedMemBg = parseColor(result.roleStyleConfig.roles.member.messageBg);
  assert.strictEqual(parsedMemBg.r, 248, 'Member messageBg RGB should snap to Main Color 2 #F87171 (248, 113, 113)');
  assert.strictEqual(parsedMemBg.g, 113);
  assert.strictEqual(parsedMemBg.b, 113);
  assert.ok(result.roleStyleConfig.roles.moderator.authorColor);
  assert.ok(result.roleStyleConfig.roles.member.memberTiers[0].color);

  // 3. fanServiceConfig assertions
  assert.ok(result.fanServiceConfig.superchat.authorColor);
  assert.ok(result.fanServiceConfig.membership.monthsColor);

  // 4. Verify 100% coverage: every color in palette must be present in the output (hex or rgba)
  const outputString = JSON.stringify(result);
  palette.forEach((hex) => {
    const { r, g, b } = parseColor(hex);
    const hasHex = outputString.toUpperCase().includes(hex.toUpperCase());
    const hasRgb = outputString.includes(`${r}, ${g}, ${b}`) || outputString.includes(`${r},${g},${b}`);
    assert.ok(
      hasHex || hasRgb,
      `Color ${hex} (or rgb ${r}, ${g}, ${b}) must be assigned to at least one field`,
    );
  });

  // 5. Test 5-color palette — Color 4 must be applied to bubbleBorderColor
  const palette5 = ['#0F172A', '#F87171', '#38BDF8', '#FACC15', '#A855F7'];
  const result5 = applyPaletteLock(mockBundle, palette5);
  assert.strictEqual(
    result5.customizeConfig.bubbleBorderColor,
    '#A855F7',
    'With 5 colors, Color 4 (#A855F7) must be directly assigned to bubbleBorderColor',
  );
  const output5 = JSON.stringify(result5);
  palette5.forEach((hex) => {
    const { r, g, b } = parseColor(hex);
    const hasHex = output5.toUpperCase().includes(hex.toUpperCase());
    const hasRgb = output5.includes(`${r}, ${g}, ${b}`) || output5.includes(`${r},${g},${b}`);
    assert.ok(hasHex || hasRgb, `5-color: Color ${hex} (or rgb ${r}, ${g}, ${b}) must be present in output`);
  });

  // 6. Test baselineBundle option: applying repeatedly with different palettes always compares against baseline
  const secondPalette = ['#1E1B4B', '#A855F7', '#EC4899', '#10B981'];
  const result2 = applyPaletteLock(result, secondPalette, { baselineBundle: mockBundle });
  assert.ok(result2.customizeConfig.bubbleBg.includes('30, 27, 75'), 'Second lock with baseline compares against original mockBundle');

  console.log('✓ Test 4 Passed: End-to-end applyPaletteLock with 4+5 color palettes, baseline support & 100% coverage');

  // 7. slotStyleConfig header/body split colors (author/message bubbleBg) —
  //    with headerSplit ON, both bands are FORCE-ASSIGNED to two DISTINCT
  //    palette colors (see shared/palette-lock.js Step 3b), even though
  //    mockBundle's message.bubbleBg started at null. Palette Lock must not
  //    silently skip a feature the user has explicitly turned on.
  const parsedHeaderBg = parseColor(result.slotStyleConfig.slots.author.bubbleBg);
  assert.ok(
    palette.some((hex) => {
      const p = parseColor(hex);
      return p.r === parsedHeaderBg.r && p.g === parsedHeaderBg.g && p.b === parsedHeaderBg.b;
    }),
    'slots.author.bubbleBg (header band) should snap to a palette color',
  );
  assert.strictEqual(parsedHeaderBg.a, 0.9, 'slots.author.bubbleBg alpha 0.9 should be preserved');

  const parsedBodyBg = parseColor(result.slotStyleConfig.slots.message.bubbleBg);
  assert.ok(
    parsedBodyBg,
    'slots.message.bubbleBg (body band) must be force-assigned a color when headerSplit is on, not left null',
  );
  assert.ok(
    palette.some((hex) => {
      const p = parseColor(hex);
      return p.r === parsedBodyBg.r && p.g === parsedBodyBg.g && p.b === parsedBodyBg.b;
    }),
    'slots.message.bubbleBg (body band) should snap to a palette color',
  );
  assert.ok(
    parsedHeaderBg.r !== parsedBodyBg.r || parsedHeaderBg.g !== parsedBodyBg.g || parsedHeaderBg.b !== parsedBodyBg.b,
    'header band and body band must be assigned DISTINCT colors so the split is actually visible',
  );

  console.log('✓ Test 7 Passed: headerSplit forces two distinct palette colors onto header/body bands');

  // 8. headerSplit OFF -> normal snap-only-if-set behavior applies again: an
  //    unset slots.message.bubbleBg stays null (this is what split-wrap
  //    mode's "🖌️ Bubble riêng" relies on — untouched fields keep inheriting
  //    the global bubbleBg).
  const mockBundleNoSplit = {
    ...mockBundle,
    layoutConfig: { screen: { headerSplit: false } },
  };
  const resultNoSplit = applyPaletteLock(mockBundleNoSplit, palette);
  assert.strictEqual(
    resultNoSplit.slotStyleConfig.slots.message.bubbleBg,
    null,
    'with headerSplit off, an unset slots.message.bubbleBg must stay null (not forced)',
  );

  console.log('✓ Test 8 Passed: headerSplit off leaves unset slot bubbleBg fields untouched');
}

// ── Test 9: Regression — headerSplit toggled ON *after* baseline was
//    captured must still force two distinct bands (dashboard scenario:
//    user applies Palette Lock once early — freezing preLockSnapshotRef —
//    then turns on "Chia đôi bubble kiểu YouTube" and re-applies without
//    ever re-selecting a port/theme, which is the only thing that refreshes
//    the cached baseline). headerSplitOn must be decided from the LIVE
//    `bundle.layoutConfig`, not the stale `options.baselineBundle`.
{
  const staleBaseline = {
    customizeConfig: { bubbleBg: 'rgba(22, 25, 31, 0.72)' },
    roleStyleConfig: { roles: {} },
    fanServiceConfig: {},
    slotStyleConfig: { slots: { author: { bubbleBg: null }, message: { bubbleBg: null } } },
    layoutConfig: { screen: { headerSplit: false, bubbleWrapRow: true } }, // captured BEFORE split was turned on
  };

  const liveBundle = {
    customizeConfig: { bubbleBg: 'rgba(22, 25, 31, 0.72)' },
    roleStyleConfig: { roles: {} },
    fanServiceConfig: {},
    slotStyleConfig: { slots: { author: { bubbleBg: null }, message: { bubbleBg: null } } },
    layoutConfig: { screen: { headerSplit: true, bubbleWrapRow: true } }, // headerSplit just turned ON
  };

  const palette9 = ['#0F172A', '#F87171', '#38BDF8', '#FACC15'];
  const result9 = applyPaletteLock(liveBundle, palette9, { baselineBundle: staleBaseline });

  assert.ok(
    result9.slotStyleConfig.slots.author.bubbleBg,
    'Regression: headerSplit turned on after a stale baseline must still force-assign the header band',
  );
  assert.ok(
    result9.slotStyleConfig.slots.message.bubbleBg,
    'Regression: headerSplit turned on after a stale baseline must still force-assign the body band',
  );
  assert.notStrictEqual(
    result9.slotStyleConfig.slots.author.bubbleBg,
    result9.slotStyleConfig.slots.message.bubbleBg,
    'Regression: header and body bands must end up as two DISTINCT colors, not both stuck at null/same fallback',
  );

  console.log('✓ Test 9 Passed: headerSplit gate uses LIVE layoutConfig, not a stale baselineBundle');
}

// ── Test 10: headerSplit contrast override — author/message text colors for
//    EVERY role (default/viewer + moderator + member) must be WCAG-checked
//    against the band color actually painted on screen (slots.author/
//    message.bubbleBg), not against each bucket's own "logical" background
//    field, because bubble-wrap.css visually paints the same two split bands
//    behind every role's text once headerSplit is on.
{
  const bundle10 = {
    customizeConfig: { bubbleBg: 'rgba(22, 25, 31, 0.72)', textColor: '#EAECEF', authorColor: '#6E56F0' },
    roleStyleConfig: {
      roles: {
        moderator: { messageBg: 'rgba(86, 50, 54, 0.78)', messageTextColor: '#ffffff', authorColor: '#fca5a5' },
        member: { messageBg: 'rgba(30, 58, 95, 0.9)', authorColor: '#93c5fd' },
      },
    },
    fanServiceConfig: {},
    slotStyleConfig: { slots: { author: { bubbleBg: null }, message: { bubbleBg: null } } },
    layoutConfig: { screen: { headerSplit: true, bubbleWrapRow: true } },
  };
  const palette10 = ['#0F172A', '#F87171', '#0EA5E9', '#FACC15'];
  const result10 = applyPaletteLock(bundle10, palette10);

  const BASE_CANVAS = { r: 14, g: 16, b: 19 };
  function effectiveBg(rawStr) {
    const c = parseColor(rawStr);
    const a = c.a ?? 1;
    return {
      r: Math.round(c.r * a + BASE_CANVAS.r * (1 - a)),
      g: Math.round(c.g * a + BASE_CANVAS.g * (1 - a)),
      b: Math.round(c.b * a + BASE_CANVAS.b * (1 - a)),
    };
  }

  const headerBg = effectiveBg(result10.slotStyleConfig.slots.author.bubbleBg);
  const bodyBg = effectiveBg(result10.slotStyleConfig.slots.message.bubbleBg);

  const viewerAuthorCr = getContrastRatio(parseColor(result10.customizeConfig.authorColor), headerBg);
  const viewerTextCr = getContrastRatio(parseColor(result10.customizeConfig.textColor), bodyBg);
  const modAuthorCr = getContrastRatio(parseColor(result10.roleStyleConfig.roles.moderator.authorColor), headerBg);
  const modMessageCr = getContrastRatio(parseColor(result10.roleStyleConfig.roles.moderator.messageTextColor), bodyBg);
  const memAuthorCr = getContrastRatio(parseColor(result10.roleStyleConfig.roles.member.authorColor), headerBg);

  assert.ok(viewerAuthorCr >= 3.0, `viewer authorColor vs actual header band must be >=3.0, got ${viewerAuthorCr.toFixed(2)}`);
  assert.ok(viewerTextCr >= 4.5, `viewer textColor vs actual body band must be >=4.5, got ${viewerTextCr.toFixed(2)}`);
  assert.ok(modAuthorCr >= 3.0, `moderator authorColor vs actual header band must be >=3.0, got ${modAuthorCr.toFixed(2)}`);
  assert.ok(modMessageCr >= 4.5, `moderator messageTextColor vs actual body band must be >=4.5, got ${modMessageCr.toFixed(2)}`);
  assert.ok(memAuthorCr >= 3.0, `member authorColor vs actual header band must be >=3.0, got ${memAuthorCr.toFixed(2)}`);

  console.log('✓ Test 10 Passed: headerSplit text colors validated against the actually-rendered band bg for every role');
}

// ── Test 11: Mốc tháng (member tier) color must be WCAG-checked against the
//    background it renders on, not just cycled through the palette blindly.
//    Regression for the exact reported symptom: the top tier (e.g. "12
//    tháng", idx 0 after the descending minMonths sort) landing on the SAME
//    palette color already assigned to member.messageBg — making the tier
//    badge/border/author-name invisible against its own bubble.
{
  const bundle11 = {
    customizeConfig: { bubbleBg: 'rgba(22, 25, 31, 0.72)' },
    roleStyleConfig: {
      roles: {
        member: {
          messageBg: 'rgba(30, 58, 95, 0.9)',
          memberTiers: [
            { id: 't12', minMonths: 12 },
            { id: 't6', minMonths: 6 },
            { id: 't3', minMonths: 3 },
            { id: 't1', minMonths: 1 },
          ],
        },
      },
    },
    fanServiceConfig: {},
    slotStyleConfig: { slots: {} },
    layoutConfig: { screen: { headerSplit: false } },
  };
  const palette11 = ['#0F172A', '#F87171', '#38BDF8', '#FACC15'];
  const result11 = applyPaletteLock(bundle11, palette11);

  const memberBg = parseColor(result11.roleStyleConfig.roles.member.messageBg);
  result11.roleStyleConfig.roles.member.memberTiers.forEach((tier) => {
    const cr = getContrastRatio(parseColor(tier.color), memberBg);
    assert.ok(
      cr >= 3.0,
      `Mốc ${tier.minMonths} tháng phải đạt tương phản >=3.0 với nền bubble hội viên, hiện chỉ ${cr.toFixed(2)}`,
    );
  });

  console.log('✓ Test 11 Passed: memberTiers ("Mốc tháng") color is WCAG-checked against its actual bubble background');
}

// ── Test 12: Super Chat manualBgColor must still be snapped to the palette
//    when the palette has <4 colors AND the user already disabled "Tự động
//    dùng màu theo tier" (useTierColor: false) manually. Step 3 only
//    directly-assigns superchat.manualBgColor when shouldUseManualColor
//    (paletteEntries.length >= 4); with a shorter palette + a pre-existing
//    manual override, the generic FAN_SERVICE_SURFACE_FIELDS loop is the
//    ONLY place that can snap it — an unconditional skip there (mirroring
//    the old moderator.messageBg bug) would leave it stuck on its
//    pre-lock color forever, silently ignoring the locked palette.
{
  const bundle12 = {
    customizeConfig: { bubbleBg: 'rgba(22, 25, 31, 0.72)' },
    roleStyleConfig: { roles: {} },
    fanServiceConfig: {
      superchat: {
        useTierColor: false, // user manually turned off tier color
        manualBgColor: 'rgba(200, 40, 40, 0.85)', // pre-lock manual color, off-palette
      },
    },
    slotStyleConfig: { slots: {} },
    layoutConfig: { screen: { headerSplit: false } },
  };
  const palette12 = ['#0F172A', '#38BDF8']; // only 2 colors -> shouldUseManualColor is false
  const result12 = applyPaletteLock(bundle12, palette12);

  const paletteRgbs = palette12.map((hex) => parseColor(hex));
  const snappedBg = parseColor(result12.fanServiceConfig.superchat.manualBgColor);
  const matchesPalette = paletteRgbs.some(
    (p) => p.r === snappedBg.r && p.g === snappedBg.g && p.b === snappedBg.b,
  );

  assert.ok(
    matchesPalette,
    `Super Chat manualBgColor phải được snap vào palette dù <4 màu và useTierColor=false, hiện vẫn là ${result12.fanServiceConfig.superchat.manualBgColor}`,
  );
  // useTierColor must remain untouched by the palette-length rule since it
  // was already false and palette has <4 colors (restores from baseline).
  assert.strictEqual(result12.fanServiceConfig.superchat.useTierColor, false);

  console.log('✓ Test 12 Passed: Super Chat manualBgColor snapped via generic loop when <4 colors, not left stuck off-palette');
}

// ── Test 13: Direct-assignment steps (Step 1-3, headerSplit) must PRESERVE
//    gradient CSS structure, not collapse it to a flat color. Role messageBg,
//    customizeConfig.bubbleBg, and slot bubbleBg all allow a
//    `linear-gradient(angle, stop1, stop2)` value in the UI (ColorPicker's
//    allowGradient prop) — the old formatSnappedColor() call in these steps
//    only recognized a bare hex/rgb/rgba string via parseColor(), so any
//    gradient string silently fell through to `closestPaletteEntry.hex`,
//    discarding the entire gradient and painting a flat solid color instead.
{
  const bundle13 = {
    customizeConfig: {
      bubbleBg: 'linear-gradient(135deg, rgba(110, 86, 240, 0.9), rgba(22, 25, 31, 0.72))',
    },
    roleStyleConfig: {
      roles: {
        moderator: { messageBg: 'linear-gradient(135deg, rgba(248, 113, 113, 0.22), rgba(22, 25, 31, 0.72))' },
        member: { messageBg: 'linear-gradient(135deg, rgba(96, 165, 250, 0.3), rgba(22, 25, 31, 0.72))' },
      },
    },
    fanServiceConfig: {},
    slotStyleConfig: { slots: {} },
    layoutConfig: { screen: { headerSplit: false } },
  };
  const palette13 = ['#6E56F0', '#22D3EE', '#F472B6']; // 3 colors -> also triggers moderator Step 3 direct-assign
  const result13 = applyPaletteLock(bundle13, palette13);

  [
    ['customizeConfig.bubbleBg', result13.customizeConfig.bubbleBg],
    ['moderator.messageBg', result13.roleStyleConfig.roles.moderator.messageBg],
    ['member.messageBg', result13.roleStyleConfig.roles.member.messageBg],
  ].forEach(([label, value]) => {
    assert.ok(
      typeof value === 'string' && value.startsWith('linear-gradient('),
      `${label} phải giữ nguyên cấu trúc linear-gradient(...) sau Palette Lock, hiện là: ${value}`,
    );
    // Both original stops (0.22/0.9 and 0.72 alpha) must survive independently
    // — i.e. NOT collapsed into a single flat stop.
    const stopCount = (value.match(/rgba?\(/g) || []).length;
    assert.strictEqual(stopCount, 2, `${label} phải giữ đủ 2 điểm dừng màu (color stops), hiện có ${stopCount}`);
  });

  console.log('✓ Test 13 Passed: gradient bubbleBg/messageBg preserved (not collapsed to flat color) through direct-assignment steps');
}

// ── Test 14: Membership manualBgColor snapping must preserve the ALPHA the
//    user is actually seeing when manualBgColor was never manually set
//    (null). fan-service-config.js's real render fallback is
//    `var(--ovs-role-member-message-bg, var(--ovs-bubble-bg, rgba(22, 25,
//    31, 0.72)))` — i.e. it inherits role.member.messageBg's opacity first.
//    Snapping straight from a hardcoded 0.72 literal (skipping that chain)
//    would silently change the visible opacity even though Palette Lock is
//    only supposed to touch hue.
{
  const bundle14 = {
    customizeConfig: { bubbleBg: 'rgba(22, 25, 31, 0.72)' },
    roleStyleConfig: { roles: { member: { messageBg: 'rgba(30, 58, 95, 0.92)' } } },
    fanServiceConfig: { membership: { manualBgColor: null } },
    slotStyleConfig: { slots: {} },
    layoutConfig: { screen: { headerSplit: false } },
  };
  const palette14 = ['#6E56F0', '#22D3EE'];
  const result14 = applyPaletteLock(bundle14, palette14);

  const snappedAlpha = parseColor(result14.fanServiceConfig.membership.manualBgColor).a;
  assert.strictEqual(
    snappedAlpha,
    0.92,
    `Membership manualBgColor phải giữ alpha 0.92 kế thừa từ member.messageBg, hiện là ${snappedAlpha}`,
  );

  console.log('✓ Test 14 Passed: Membership manualBgColor inherits the real displayed alpha (member.messageBg), not a hardcoded literal');
}

console.log('[smoke:palette-lock] ALL CHECKS PASSED SUCCESSFULLY!');