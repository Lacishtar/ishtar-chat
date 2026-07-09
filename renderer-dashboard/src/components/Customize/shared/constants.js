export const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter (mặc định)' },
  { value: '"Space Grotesk", system-ui, sans-serif', label: 'Space Grotesk' },
  { value: 'ui-monospace, "JetBrains Mono", monospace', label: 'Mono' },
  { value: '"Segoe UI", system-ui, sans-serif', label: 'Segoe UI' },
];

export const BORDER_STYLE_OPTIONS = [
  { value: 'solid', label: 'Liền' },
  { value: 'dashed', label: 'Đứt khúc' },
  { value: 'dotted', label: 'Chấm' },
  { value: 'none', label: 'Không viền' },
];

export const SHADOW_PRESETS = [
  { id: 'none', label: 'Không', value: 'none' },
  { id: 'light', label: 'Nhẹ', value: '0 4px 14px rgba(255, 140, 200, 0.25)' },
  { id: 'strong', label: 'Mạnh', value: '0 8px 24px rgba(0, 0, 0, 0.45)' },
];

// Glow uses CSS `filter: drop-shadow(...)` (kept as its own property, separate from
// box-shadow) so it renders as a real halo around the bubble shape without needing
// to be string-concatenated with the Shadow value above. See overlay/bubble-wrap.css.
export const GLOW_PRESETS = [
  { id: 'none', label: 'Không', value: 'none' },
  { id: 'soft', label: 'Nhẹ', value: 'drop-shadow(0 0 8px rgba(110, 86, 240, 0.65))' },
  {
    id: 'neon',
    label: 'Neon',
    value: 'drop-shadow(0 0 6px rgba(53, 230, 176, 0.85)) drop-shadow(0 0 18px rgba(53, 230, 176, 0.55))',
  },
  {
    id: 'strong',
    label: 'Mạnh',
    value: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.9)) drop-shadow(0 0 28px rgba(255, 255, 255, 0.6))',
  },
];

// The list of "objects" the user can select in the Inspector — mirrors the
// slots that already exist in the overlay data model (customize-config /
// slot-style-config). Adding a new selectable object later just means
// appending here and creating an ObjectInspectors/<X>Inspector.jsx.
export const OBJECTS = [
  { id: 'global', label: 'Chung', hint: 'Cả overlay' },
  { id: 'avatar', label: 'Avatar', hint: 'Ảnh đại diện' },
  { id: 'author', label: 'Tên', hint: 'Username' },
  { id: 'message', label: 'Nội dung', hint: 'Nội dung chat' },
  { id: 'badges', label: 'Badge', hint: 'Huy hiệu' },
];
