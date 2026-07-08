const { listThemes } = require('../main/theme-registry');
const { resolveThemeState } = require('../main/store/theme-state');

const hiddenThemeIds = ['ticker', 'scrapbook'];
const visibleThemeIds = listThemes().map((theme) => theme.id);
const hiddenVisible = hiddenThemeIds.filter((id) => visibleThemeIds.includes(id));

if (hiddenVisible.length > 0) {
  console.error(`Expected hidden themes to be absent, but found: ${hiddenVisible.join(', ')}`);
  process.exit(1);
}

try {
  const fallbackState = resolveThemeState('non-existent-theme');
  if (fallbackState.selectedTheme !== 'classic') {
    throw new Error(`Expected fallback to classic, got ${fallbackState.selectedTheme}`);
  }
} catch (err) {
  console.error('Theme fallback regression failed:', err.message);
  process.exit(1);
}

console.log(`Verified hidden themes are absent and invalid selections fall back to classic. Visible themes: ${visibleThemeIds.join(', ')}`);
