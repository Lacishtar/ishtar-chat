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

  // 4. Verify 100% coverage: every color in palette must be present in the output
  const outputString = JSON.stringify(result);
  palette.forEach((hex) => {
    assert.ok(
      outputString.includes(hex),
      `Color ${hex} must be assigned to at least one field (no skipped colors)`,
    );
  });

  // 5. Test baselineBundle option: applying repeatedly with different palettes always compares against baseline
  const secondPalette = ['#1E1B4B', '#A855F7', '#EC4899', '#10B981'];
  const result2 = applyPaletteLock(result, secondPalette, { baselineBundle: mockBundle });
  assert.ok(result2.customizeConfig.bubbleBg.includes('30, 27, 75'), 'Second lock with baseline compares against original mockBundle');

  console.log('✓ Test 4 Passed: End-to-end applyPaletteLock with baseline support & 100% color coverage');
}

console.log('[smoke:palette-lock] ALL CHECKS PASSED SUCCESSFULLY!');
