const { loadThemeDocument, listThemeIds } = require('../main/theme-engine');
const {
  DEFAULT_BUBBLE_CONFIG,
  mergeBubbleConfig,
  compileBubbleToCssVariables,
  isImageBubbleActive,
  resolveBubbleMode,
} = require('../shared/bubble-config');

function fail(message) {
  throw new Error(`[smoke:bubble-engine] ${message}`);
}

function checkThemeBubble(themeId) {
  const doc = loadThemeDocument(themeId);
  if (!doc.style.bubble) fail(`${themeId}: style.bubble missing`);
  if (!['color', 'gradient', 'image'].includes(doc.style.bubble.type)) {
    fail(`${themeId}: invalid bubble.type`);
  }
  console.log(`[smoke] ${themeId}: style.bubble present (${doc.style.bubble.type}) ✔`);
}

function checkCompiler() {
  const vars = compileBubbleToCssVariables(DEFAULT_BUBBLE_CONFIG);
  if (vars['--ovs-bubble-image-url'] !== 'none') fail('color mode should set image url none');
  if (resolveBubbleMode(DEFAULT_BUBBLE_CONFIG) !== 'color') fail('default mode should be color');
  if (isImageBubbleActive(DEFAULT_BUBBLE_CONFIG)) fail('default should not be active image bubble');

  const imageCfg = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, {
    type: 'image',
    image: '/themes/classic/assets/chat-bubble.png',
  });
  if (!isImageBubbleActive(imageCfg)) fail('image config should be active');
  if (resolveBubbleMode(imageCfg) !== 'image') fail('image mode resolve failed');
  const imageVars = compileBubbleToCssVariables(imageCfg);
  if (!imageVars['--ovs-bubble-image-url'].includes('chat-bubble.png')) fail('image url not compiled');
  if (imageVars['--ovs-bubble-border-top'] !== '24px') fail('scale 1 border width');
  if (imageVars['--ovs-bubble-painted-w'] !== '1px') fail('painted w fallback without image size');
  if (imageVars['--ovs-bubble-painted-h'] !== '1px') fail('painted h fallback without image size');

  const scaledCfg = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, {
    type: 'image',
    image: '/themes/classic/assets/chat-bubble.png',
    scale: 0.5,
  });
  const scaledVars = compileBubbleToCssVariables(scaledCfg, { width: 200, height: 100 });
  if (scaledVars['--ovs-bubble-border-top'] !== '12px') fail('scale 0.5 border width');
  if (scaledVars['--ovs-bubble-painted-w'] !== '100px') fail('painted w should be imgW * scale');
  if (scaledVars['--ovs-bubble-painted-h'] !== '50px') fail('painted h should be imgH * scale');

  const gradientCfg = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, { type: 'gradient' });
  if (resolveBubbleMode(gradientCfg) !== 'gradient') fail('gradient mode resolve failed');
  const gradVars = compileBubbleToCssVariables(gradientCfg);
  if (!gradVars['--ovs-bubble-gradient'].includes('linear-gradient')) fail('gradient not compiled');

  const assetObj = mergeBubbleConfig(DEFAULT_BUBBLE_CONFIG, {
    type: 'image',
    image: { asset: 'assets/chat-bubble.png' },
  });
  if (assetObj.image !== 'assets/chat-bubble.png') fail('image.asset normalize failed');

  console.log('[smoke] bubble compiler ✔');
}

function main() {
  checkCompiler();
  listThemeIds().forEach(checkThemeBubble);
  console.log('[smoke] ALL CHECKS PASSED');
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
