// Font groups — rendered as <optgroup> in FontSection.jsx.
// Mỗi nhóm ưu tiên fonts phù hợp với vibe hoặc ngôn ngữ của nhóm đó.
// Google Fonts được inject vào cả renderer-dashboard/index.html và overlay/index.html.
//
// QUAN TRỌNG: mọi font trong danh sách này đã được kiểm tra để chắc chắn có
// subset "vietnamese" chính thức trên Google Fonts (đủ dấu ệ, ữ, ẫ, ộ...),
// không chỉ dựa vào "latin-ext" (latin-ext KHÔNG đủ để hiển thị đúng tiếng Việt).
// Các font kiểu chữ Nhật/Hàn/Trung không có subset vietnamese (Klee One, Hachi
// Maru Pop, DotGothic16, Rampart One, Noto Sans/Serif JP·KR·SC·TC, Zen Maru
// Gothic, BIZ UDPMincho, Jua, Do Hyeon, Black Han Sans, ZCOOL XiaoWei, Ma Shan
// Zheng, Long Cang, Gamja Flower, Cute Font) đã được bỏ khỏi danh sách — nếu
// chọn các font đó, dấu tiếng Việt trong chat sẽ hiển thị sai/rớt về font dự
// phòng. "Fredoka One" cũng bị Google Fonts gỡ bỏ nên không dùng được nữa.
export const FONT_GROUPS = [
  {
    label: '🌸 Anime · VTuber · Maid · Kawaii',
    fonts: [
      { value: '"Baloo 2", sans-serif',          label: 'Baloo 2 — chữ phồng tròn dễ thương (Việt hoá đầy đủ)' },
      { value: 'Comfortaa, sans-serif',          label: 'Comfortaa — tròn hiện đại, mềm mại' },
      { value: 'Quicksand, sans-serif',          label: 'Quicksand — mỏng nhẹ, bay bổng' },
      { value: 'Nunito, sans-serif',             label: 'Nunito — tròn dịu, dễ đọc' },
      { value: 'Grandstander, cursive',          label: 'Grandstander — bo tròn nhảy nhót, năng động' },
      { value: '"Varela Round", sans-serif',     label: 'Varela Round — bo tròn êm, kiểu bong bóng' },
      { value: 'Mali, cursive',                  label: 'Mali — viết tay tròn ngộ nghĩnh, đúng chất maid/kawaii' },
      { value: 'Itim, cursive',                  label: 'Itim — viết tay cong tròn, dễ thương' },
      { value: 'Sriracha, cursive',              label: 'Sriracha — viết tay nét mảnh, phóng khoáng' },
      { value: 'Yomogi, cursive',                label: 'Yomogi — tay viết ngọt kiểu anime (JP · VN)' },
      { value: '"M PLUS Rounded 1c", sans-serif', label: 'M PLUS Rounded 1c — mềm mại kiểu Nhật (JP · VN)' },
    ],
  },
  {
    label: '🇻🇳 Tiếng Việt · Rõ ràng',
    fonts: [
      { value: '"Be Vietnam Pro", sans-serif',  label: 'Be Vietnam Pro — thiết kế riêng cho tiếng Việt' },
      { value: 'Inter, system-ui, sans-serif',  label: 'Inter — mặc định, rõ ràng' },
      { value: '"Source Sans 3", sans-serif',   label: 'Source Sans 3 — sạch, dễ đọc' },
      { value: 'Raleway, sans-serif',            label: 'Raleway — thanh lịch, mỏng' },
      { value: '"Exo 2", sans-serif',            label: 'Exo 2 — sci-fi, góc cạnh' },
      { value: '"Space Grotesk", sans-serif',   label: 'Space Grotesk — hiện đại kỹ thuật số' },
    ],
  },
  {
    label: '✦ Phổ thông',
    fonts: [
      { value: 'ui-monospace, "JetBrains Mono", monospace', label: 'JetBrains Mono — lập trình' },
      { value: '"Segoe UI", system-ui, sans-serif',          label: 'Segoe UI — system Windows' },
    ],
  },
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
  // Zero blur + visible offset + fully opaque color = a hard-edged duplicate
  // of the bubble shape peeking out from behind it (same border-radius, since
  // box-shadow always follows the element's own radius) — the classic
  // "sticker" / neo-brutalism flat shadow look, as opposed to the two presets
  // above which are soft, blurred, semi-transparent shadows.
  { id: 'solid', label: 'Khối đặc màu', value: '6px 6px 0px 0px rgba(20, 20, 24, 1)' },
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
