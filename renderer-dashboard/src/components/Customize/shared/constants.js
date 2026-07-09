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
