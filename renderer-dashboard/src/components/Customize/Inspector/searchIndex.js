// Each entry describes one accordion section that exists somewhere in the
// Inspector. Keeping this list separate (rather than inspecting the DOM)
// means search stays fast and works even for sections that are currently
// collapsed or belong to an object that isn't selected yet.
export const SEARCH_INDEX = [
  { objectId: 'global', sectionId: 'typography', label: 'Font & màu chữ mặc định', keywords: ['font', 'chữ', 'màu', 'color', 'text'] },
  { objectId: 'global', sectionId: 'bubbleAppearance', label: 'Hình dạng bubble', keywords: ['bubble', 'radius', 'bo góc', 'nền', 'background', 'opacity', 'mờ'] },
  { objectId: 'global', sectionId: 'border', label: 'Viền bubble', keywords: ['border', 'viền'] },
  { objectId: 'global', sectionId: 'shadow', label: 'Shadow bubble', keywords: ['shadow', 'đổ bóng', 'bóng'] },
  { objectId: 'global', sectionId: 'glow', label: 'Glow bubble', keywords: ['glow', 'phát sáng', 'neon', 'sáng viền'] },
  { objectId: 'global', sectionId: 'texture', label: 'Texture nền bubble', keywords: ['texture', 'ảnh nền', 'pattern'] },
  { objectId: 'global', sectionId: 'bunny', label: 'Tai thỏ (Bunny Ears)', keywords: ['bunny', 'tai thỏ', 'ears'] },
  { objectId: 'global', sectionId: 'behavior', label: 'Vị trí & tốc độ hiệu ứng', keywords: ['animation', 'hiệu ứng', 'tốc độ', 'vị trí', 'position', 'số tin', 'maxmessages'] },

  { objectId: 'avatar', sectionId: 'appearance', label: 'Avatar — Kích thước & độ mờ', keywords: ['avatar', 'size', 'kích thước', 'opacity', 'radius', 'bo góc'] },
  { objectId: 'avatar', sectionId: 'border', label: 'Avatar — Viền', keywords: ['avatar', 'border', 'viền'] },
  { objectId: 'avatar', sectionId: 'transform', label: 'Avatar — Transform', keywords: ['avatar', 'xoay', 'rotate', 'offset', 'z-index'] },

  { objectId: 'author', sectionId: 'typography', label: 'Tên — Font & màu', keywords: ['tên', 'username', 'font', 'màu', 'color'] },
  { objectId: 'author', sectionId: 'transform', label: 'Tên — Transform', keywords: ['tên', 'xoay', 'rotate', 'offset', 'z-index'] },
  { objectId: 'author', sectionId: 'bubble', label: 'Tên — Bubble riêng', keywords: ['tên', 'bubble', 'radius', 'viền', 'shadow', 'glow', 'texture', 'tai thỏ'] },

  { objectId: 'message', sectionId: 'typography', label: 'Nội dung — Font & màu', keywords: ['nội dung', 'message', 'font', 'màu', 'color'] },
  { objectId: 'message', sectionId: 'transform', label: 'Nội dung — Transform', keywords: ['nội dung', 'message', 'xoay', 'rotate', 'offset', 'z-index'] },
  { objectId: 'message', sectionId: 'bubble', label: 'Nội dung — Bubble riêng', keywords: ['nội dung', 'message', 'bubble', 'radius', 'viền', 'shadow', 'glow', 'texture', 'tai thỏ'] },

  { objectId: 'badges', sectionId: 'appearance', label: 'Badge — Kích thước & độ mờ', keywords: ['badge', 'huy hiệu', 'size', 'opacity'] },
  { objectId: 'badges', sectionId: 'transform', label: 'Badge — Transform', keywords: ['badge', 'xoay', 'rotate', 'offset', 'z-index'] },
];

export function searchSections(keyword) {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX.filter(
    (entry) =>
      entry.label.toLowerCase().includes(q) || entry.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
