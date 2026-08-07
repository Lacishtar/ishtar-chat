// credits-theme-presets.js — Built-in theme presets for the Stream Credits
// scene (/overlay/credits). Deliberately separate from
// shared/theme-presets/* (the chat-bubble theme system): Credits is its own
// small, self-contained overlay with its own CSS variable surface, so it
// gets its own lightweight preset list instead of reusing the much larger
// chat theme shape.
//
// Every font referenced here is a free Google Font already used elsewhere
// in this app (see shared/theme-presets/themes/*.js) plus two additions
// (Playfair Display, Space Mono) that are also free/open-license Google
// Fonts — no paid or self-hosted fonts.
//
// `vars` keys map 1:1 to the CSS custom properties consumed by
// overlay/credits.html — see the :root block there for defaults/fallbacks.
//
// `layout` picks which row/track structure overlay/credits.html renders
// with (see the `.ovs-credits-layout--*` rules there and applyLayout() in
// overlay/credits-client.js) — presets are not just recolors of the same
// row, they can genuinely rearrange the crawl:
//   'classic' — original one-column list, rank/avatar/name/score in a row.
//   'grid'    — two-column card grid, section header spans both columns.
//   'stacked' — vertical "profile card" per person (avatar/name/score
//               stacked, centered), rank becomes a small badge pinned to
//               the avatar's corner instead of its own column.

const CREDITS_THEME_PRESETS = [
  {
    id: 'default',
    name: 'Mặc định',
    description: 'Bảng tối trong suốt, chữ Space Grotesk — phong cách gốc của Credits.',
    swatch: ['#12141A', '#9fd8ff', '#6e56f0'],
    layout: 'classic',
    googleFontHref:
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap',
    vars: {
      '--ovs-credits-font': "'Space Grotesk', system-ui, sans-serif",
      '--ovs-credits-font-mono': "'JetBrains Mono', ui-monospace, monospace",
      '--ovs-credits-row-bg': 'rgba(15, 17, 23, 0.55)',
      '--ovs-credits-row-radius': '14px',
      '--ovs-credits-row-border': 'none',
      '--ovs-credits-row-blur': '4px',
      '--ovs-credits-title-color': '#ffffff',
      '--ovs-credits-header-shadow': '0 2px 10px rgba(0, 0, 0, 0.7)',
      '--ovs-credits-accent-from': '#9fd8ff',
      '--ovs-credits-accent-to': '#6e56f0',
      '--ovs-credits-name-color': '#ffffff',
      '--ovs-credits-name-shadow': '0 1px 5px rgba(0, 0, 0, 0.75)',
      '--ovs-credits-badge-color': '#d3d6de',
      '--ovs-credits-rank-color': '#a7adba',
      '--ovs-credits-score-color': '#9fd8ff',
      '--ovs-credits-avatar-border': 'rgba(255, 255, 255, 0.25)',
      '--ovs-credits-avatar-fallback-bg': 'rgba(110, 86, 240, 0.4)',
    },
  },
  {
    id: 'minimal-light',
    name: 'Tối giản sáng',
    description: 'Nền trắng sạch sẽ, chữ Inter — hợp overlay theme sáng màu. Bố cục lưới 2 cột.',
    swatch: ['#FFFFFF', '#38BDF8', '#6366F1'],
    layout: 'grid',
    googleFontHref:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap',
    vars: {
      '--ovs-credits-font': "'Inter', system-ui, sans-serif",
      '--ovs-credits-font-mono': "'JetBrains Mono', ui-monospace, monospace",
      '--ovs-credits-row-bg': 'rgba(255, 255, 255, 0.92)',
      '--ovs-credits-row-radius': '12px',
      '--ovs-credits-row-border': '1px solid rgba(15, 23, 42, 0.08)',
      '--ovs-credits-row-blur': '2px',
      '--ovs-credits-title-color': '#0F172A',
      '--ovs-credits-header-shadow': 'none',
      '--ovs-credits-accent-from': '#38BDF8',
      '--ovs-credits-accent-to': '#6366F1',
      '--ovs-credits-name-color': '#0F172A',
      '--ovs-credits-name-shadow': 'none',
      '--ovs-credits-badge-color': '#64748B',
      '--ovs-credits-rank-color': '#94A3B8',
      '--ovs-credits-score-color': '#2563EB',
      '--ovs-credits-avatar-border': 'rgba(15, 23, 42, 0.15)',
      '--ovs-credits-avatar-fallback-bg': 'rgba(56, 189, 248, 0.18)',
    },
  },
  {
    id: 'neon-night',
    name: 'Neon đêm',
    description: 'Nền đen, chữ mono phát sáng hồng/xanh cyan — kiểu cyberpunk. Thẻ dọc, rank là huy hiệu tròn.',
    swatch: ['#06060F', '#FF2ED1', '#00F5FF'],
    layout: 'stacked',
    googleFontHref: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap',
    vars: {
      '--ovs-credits-font': "'JetBrains Mono', ui-monospace, monospace",
      '--ovs-credits-font-mono': "'JetBrains Mono', ui-monospace, monospace",
      '--ovs-credits-row-bg': 'rgba(6, 6, 16, 0.75)',
      '--ovs-credits-row-radius': '10px',
      '--ovs-credits-row-border': '1px solid rgba(255, 0, 200, 0.35)',
      '--ovs-credits-row-blur': '3px',
      '--ovs-credits-title-color': '#00F5FF',
      '--ovs-credits-header-shadow': '0 0 12px rgba(0, 245, 255, 0.5)',
      '--ovs-credits-accent-from': '#FF2ED1',
      '--ovs-credits-accent-to': '#00F5FF',
      '--ovs-credits-name-color': '#FF2ED1',
      '--ovs-credits-name-shadow': '0 0 8px rgba(255, 46, 209, 0.85), 0 0 2px #fff',
      '--ovs-credits-badge-color': '#7CFFEA',
      '--ovs-credits-rank-color': '#00F5FF',
      '--ovs-credits-score-color': '#FFE45C',
      '--ovs-credits-avatar-border': 'rgba(0, 245, 255, 0.6)',
      '--ovs-credits-avatar-fallback-bg': 'rgba(255, 46, 209, 0.25)',
    },
  },
  {
    id: 'pastel-cute',
    name: 'Pastel dễ thương',
    description: 'Hồng pastel bo tròn, chữ Quicksand — hợp kênh vtuber/cute. Thẻ dọc, rank là huy hiệu tròn.',
    swatch: ['#FFF1F7', '#FFB6D5', '#C58BF2'],
    layout: 'stacked',
    googleFontHref: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700&display=swap',
    vars: {
      '--ovs-credits-font': "'Quicksand', system-ui, sans-serif",
      '--ovs-credits-font-mono': "'Quicksand', system-ui, sans-serif",
      '--ovs-credits-row-bg': 'rgba(255, 241, 247, 0.9)',
      '--ovs-credits-row-radius': '20px',
      '--ovs-credits-row-border': '1px solid rgba(255, 182, 213, 0.6)',
      '--ovs-credits-row-blur': '2px',
      '--ovs-credits-title-color': '#D6549B',
      '--ovs-credits-header-shadow': '0 2px 8px rgba(255, 182, 213, 0.4)',
      '--ovs-credits-accent-from': '#FFB6D5',
      '--ovs-credits-accent-to': '#C58BF2',
      '--ovs-credits-name-color': '#6B3F73',
      '--ovs-credits-name-shadow': 'none',
      '--ovs-credits-badge-color': '#A7729D',
      '--ovs-credits-rank-color': '#E58FC0',
      '--ovs-credits-score-color': '#C58BF2',
      '--ovs-credits-avatar-border': 'rgba(255, 182, 213, 0.9)',
      '--ovs-credits-avatar-fallback-bg': 'rgba(197, 139, 242, 0.25)',
    },
  },
  {
    id: 'gold-cinematic',
    name: 'Điện ảnh vàng',
    description: 'Đen + chữ vàng kiểu credit cuối phim, font Playfair Display.',
    swatch: ['#0B0B0B', '#F3D98B', '#B8860B'],
    layout: 'classic',
    googleFontHref:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Space+Mono:wght@400;700&display=swap',
    vars: {
      '--ovs-credits-font': "'Playfair Display', Georgia, serif",
      '--ovs-credits-font-mono': "'Space Mono', ui-monospace, monospace",
      '--ovs-credits-row-bg': 'rgba(0, 0, 0, 0.55)',
      '--ovs-credits-row-radius': '6px',
      '--ovs-credits-row-border': '1px solid rgba(212, 175, 55, 0.35)',
      '--ovs-credits-row-blur': '3px',
      '--ovs-credits-title-color': '#F3D98B',
      '--ovs-credits-header-shadow': '0 2px 10px rgba(0, 0, 0, 0.85)',
      '--ovs-credits-accent-from': '#F3D98B',
      '--ovs-credits-accent-to': '#B8860B',
      '--ovs-credits-name-color': '#F7E7B4',
      '--ovs-credits-name-shadow': '0 1px 6px rgba(0, 0, 0, 0.9)',
      '--ovs-credits-badge-color': '#D4AF37',
      '--ovs-credits-rank-color': '#D4AF37',
      '--ovs-credits-score-color': '#F3D98B',
      '--ovs-credits-avatar-border': 'rgba(212, 175, 55, 0.6)',
      '--ovs-credits-avatar-fallback-bg': 'rgba(212, 175, 55, 0.2)',
    },
  },
  {
    id: 'ocean-breeze',
    name: 'Biển xanh',
    description: 'Xanh biển – ngọc lam dịu mắt, chữ Nunito bo tròn thân thiện. Bố cục lưới 2 cột.',
    swatch: ['#082F49', '#5EEAD4', '#0EA5E9'],
    layout: 'grid',
    googleFontHref:
      'https://fonts.googleapis.com/css2?family=Nunito:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap',
    vars: {
      '--ovs-credits-font': "'Nunito', system-ui, sans-serif",
      '--ovs-credits-font-mono': "'JetBrains Mono', ui-monospace, monospace",
      '--ovs-credits-row-bg': 'rgba(8, 47, 73, 0.6)',
      '--ovs-credits-row-radius': '16px',
      '--ovs-credits-row-border': '1px solid rgba(94, 234, 212, 0.3)',
      '--ovs-credits-row-blur': '4px',
      '--ovs-credits-title-color': '#E0FBFF',
      '--ovs-credits-header-shadow': '0 2px 10px rgba(0, 0, 0, 0.4)',
      '--ovs-credits-accent-from': '#5EEAD4',
      '--ovs-credits-accent-to': '#0EA5E9',
      '--ovs-credits-name-color': '#F0FDFA',
      '--ovs-credits-name-shadow': '0 1px 4px rgba(0, 0, 0, 0.6)',
      '--ovs-credits-badge-color': '#99F6E4',
      '--ovs-credits-rank-color': '#5EEAD4',
      '--ovs-credits-score-color': '#7DD3FC',
      '--ovs-credits-avatar-border': 'rgba(94, 234, 212, 0.5)',
      '--ovs-credits-avatar-fallback-bg': 'rgba(14, 165, 233, 0.25)',
    },
  },
];

const DEFAULT_CREDITS_THEME_ID = 'default';

function getCreditsThemeById(id) {
  return CREDITS_THEME_PRESETS.find((t) => t.id === id) || null;
}

/** Lightweight list for picker UIs — no need to ship the full `vars` map to the dashboard list view (the full object is still fetched per-theme when needed). `layout` is included (cheap string) so pickers can show which row structure a preset uses alongside its colors. */
function listCreditsThemes() {
  return CREDITS_THEME_PRESETS.map(({ id, name, description, swatch, layout }) => ({ id, name, description, swatch, layout }));
}

module.exports = {
  CREDITS_THEME_PRESETS,
  DEFAULT_CREDITS_THEME_ID,
  getCreditsThemeById,
  listCreditsThemes,
};
