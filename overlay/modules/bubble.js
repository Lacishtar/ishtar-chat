
import { state, listEl } from './state.js';
import { texturePoolManager } from './pool/TexturePool.js';

export function ensureBubbleTexture(parent) {
  if (!parent) return;
  let tex = parent.querySelector(`:scope > .ovs-bubble-texture`);
  if (!tex) {
    // Lấy Texture node từ TexturePool thay vì tự document.createElement.
    // acquire() tự ưu tiên trả về node IDLE đã reset sẵn — chỉ thật sự
    // tạo mới khi Pool không còn object rảnh.
    tex = texturePoolManager.acquire();
    parent.insertBefore(tex, parent.firstChild);
  } else if (parent.firstChild && tex !== parent.firstChild) {
    // Texture đã tồn tại đúng chỗ (hoặc chỉ cần dời vị trí) — không đụng
    // tới Pool, không tạo/hủy gì cả, tránh reload không cần thiết.
    parent.insertBefore(tex, parent.firstChild);
  }
}

// Dùng <span class="ovs-bunny-ear ovs-bunny-ear--left/right"> thật thay vì
// ::before/::after để không xung đột với custom badges trên .ovs-author.

function ensureBunnyEarSpans(el) {
  let left = el.querySelector(':scope > .ovs-bunny-ear--left');
  let right = el.querySelector(':scope > .ovs-bunny-ear--right');
  if (!left) {
    left = document.createElement('span');
    left.className = 'ovs-bunny-ear ovs-bunny-ear--left';
    left.setAttribute('aria-hidden', 'true');
    el.insertBefore(left, el.firstChild);
  }
  if (!right) {
    right = document.createElement('span');
    right.className = 'ovs-bunny-ear ovs-bunny-ear--right';
    right.setAttribute('aria-hidden', 'true');
    // Insert right after left so both are at top of DOM
    left.after(right);
  }
  return { left, right };
}

function removeBunnyEarSpans(el) {
  el.querySelectorAll(':scope > .ovs-bunny-ear').forEach((s) => s.remove());
}

// Resolve màu tai thỏ theo role từ currentRoleStyle config.
// node có thể mang NHIỀU role class cùng lúc (vd: ovs-moderator + ovs-superchat),
// nên ưu tiên theo thứ tự moderator > member cho phần Identity (Role) —
// Super Chat không còn nằm trong bảng ưu tiên này nữa (xem
// resolveEarBgForNode bên dưới): sau refactor Super Chat -> Fan Service,
// màu tai thỏ của 1 row Super Chat đến từ state.currentFanService.superchat
// khi group đó enabled, độc lập hoàn toàn với Role — chỉ rơi về bảng
// ROLE_PRIORITY này (moderator/member) khi Fan Service superchat tắt.
const ROLE_PRIORITY = [
  { cls: 'ovs-moderator', key: 'moderator' },
  { cls: 'ovs-member', key: 'member' },
];

function resolveRoleForNode(node) {
  const roles = state.currentRoleStyle?.roles || {};
  for (const entry of ROLE_PRIORITY) {
    if (!node.classList.contains(entry.cls)) continue;
    const roleCfg = roles[entry.key] || {};
    if (roleCfg.enabled === false) continue;
    return { ...entry, roleCfg };
  }
  return null;
}


// earColor là field riêng, độc lập với authorColor/messageBg/rowBg — người
// dùng chọn "Màu tai thỏ" trong panel Vai trò thì LUÔN thắng, không bị suy
// ra (và trước đây từng bị nhầm) từ màu tên hay nền bubble.
function resolveFanServiceSuperchatEarBg(node) {
  if (!node.classList.contains('ovs-superchat')) return { matched: false };
  const superchatCfg = state.currentFanService?.superchat;
  if (!superchatCfg || superchatCfg.enabled === false) return { matched: false };
  const useTierColor = superchatCfg.useTierColor !== false;
  const bg = useTierColor
    ? (node.style.getPropertyValue('--ovs-superchat-tier-bg') || superchatCfg.authorColor || null)
    : (superchatCfg.authorColor || null);
  return { matched: true, bg: bg || null };
}

// Trả về group config Fan Service (superchat/membership) đang ÁP DỤNG cho
// row này, hoặc null nếu row không thuộc nhóm nào / nhóm đó đang tắt.
function resolveFanServiceGroupConfig(node) {
  if (node.classList.contains('ovs-superchat')) {
    const cfg = state.currentFanService?.superchat;
    return cfg && cfg.enabled !== false ? cfg : null;
  }
  if (
    node.classList.contains('ovs-event-membership_new')
    || node.classList.contains('ovs-event-membership_gift_sent')
    || node.classList.contains('ovs-event-membership_milestone')
  ) {
    const cfg = state.currentFanService?.membership;
    return cfg && cfg.enabled !== false ? cfg : null;
  }
  return null;
}

// Fan Service (Super Chat / Hội viên) luôn ép row về 1 bubble duy nhất —
// không tách author/message ra riêng — kể cả khi bố cục chung đang ở chế
// độ "bọc từng phần". Vì vậy tai thỏ của các row này KHÔNG được tách theo
// slot: luôn đúng 1 cặp ở cấp row. Trả về true/false (đã resolve, không
// còn tri-state) khi row thuộc 1 nhóm Fan Service đang bật, hoặc undefined
// nếu row không thuộc nhóm nào — khi đó rơi về logic tai thỏ thông thường
// (theo Bubble chung / theo slot).
function resolveFanServiceBunnyEnabled(node) {
  const group = resolveFanServiceGroupConfig(node);
  if (!group) return undefined;
  if (group.bubbleBunnyEars === true) return true;
  if (group.bubbleBunnyEars === false) return false;
  // Kế thừa: dùng cài đặt tai thỏ CHUNG (không phải theo slot), vì Fan
  // Service không có khái niệm "slot riêng" để kế thừa từ.
  return Boolean(state.currentConfig.bubbleBunnyEars);
}

function resolveEarBgForNode(node) {
  const fsSuperchat = resolveFanServiceSuperchatEarBg(node);
  if (fsSuperchat.matched) return fsSuperchat.bg;
  const match = resolveRoleForNode(node);
  if (!match) return null; // không có role → dùng CSS var (--ovs-bubble-bg)
  const { roleCfg } = match;
  // Ưu tiên: earColor (set riêng) → rowBg → messageBg → mặc định theo bubble
  // (không còn ép về 1 mã hex cứng — trước đây điều này khiến tai thỏ hiện
  // màu không khớp bubble/author khi role chưa cấu hình earColor/messageBg).
  const bg = roleCfg.earColor
    || roleCfg.rowBg || roleCfg.rowBgColor
    || roleCfg.messageBg || roleCfg.messageBgColor;
  return bg || null;
}

// Slot mode (author/message tách bubble riêng): role-styles.css chỉ đổi màu
// nền của .ovs-text theo messageBg (không có rowBg ở slot mode), và chỉ đổi
// nền .ovs-author khi có authorBg (pill), nên tai thỏ phải theo đúng 2 quy tắc
// đó — không phải copy nguyên priority chain của row mode.
function resolveEarBgForSlot(node, slotName) {
  const fsSuperchat = resolveFanServiceSuperchatEarBg(node);
  if (fsSuperchat.matched) return fsSuperchat.bg;
  const match = resolveRoleForNode(node);
  if (!match) return null;
  const { roleCfg } = match;
  if (roleCfg.earColor) return roleCfg.earColor;
  if (slotName === 'message') {
    return roleCfg.messageBg || roleCfg.messageBgColor || null;
  }
  if (slotName === 'author') {
    // Chỉ tô màu tai theo role khi author thực sự có pill nền riêng (authorBg);
    // nếu không, bubble tác giả vẫn dùng nền mặc định nên tai cũng phải vậy.
    return roleCfg.authorBg || null;
  }
  return null;
}

export function applyMessageBunnyEars(node) {
  if (!node) return;
  const fsEnabled = resolveFanServiceBunnyEnabled(node);
  const isFanService = fsEnabled !== undefined;
  const enabled = isFanService ? fsEnabled : state.currentConfig.bubbleBunnyEars;
  // Fan Service row: đánh dấu để CSS luôn hiện cặp tai cấp row, bất kể bố
  // cục chung đang "bọc chung" hay "bọc từng phần" (xem bubble-wrap.css).
  if (isFanService) {
    node.setAttribute('data-bunny-ears-force-row', 'true');
  } else {
    node.removeAttribute('data-bunny-ears-force-row');
  }
  if (!enabled) {
    removeBunnyEarSpans(node);
    node.removeAttribute('data-bunny-ears');
    return;
  }
  node.setAttribute('data-bunny-ears', 'true');
  const { left, right } = ensureBunnyEarSpans(node);
  // Set màu theo role (inline style override CSS var)
  const bg = resolveEarBgForNode(node);
  if (bg) {
    left.style.background = bg;
    right.style.background = bg;
  } else {
    left.style.removeProperty('background');
    right.style.removeProperty('background');
  }
}

export function applySlotBunnyEars(el, slotName) {
  if (!el) return;
  const rowNode = el.closest('.ovs-message');
  const fsEnabled = rowNode ? resolveFanServiceBunnyEnabled(rowNode) : undefined;
  // Fan Service không bao giờ tách tai thỏ theo slot (author/message) —
  // luôn chỉ có 1 cặp duy nhất ở cấp row (xem applyMessageBunnyEars), kể
  // cả khi bố cục chung đang ở chế độ "bọc từng phần".
  if (fsEnabled !== undefined) {
    removeBunnyEarSpans(el);
    el.removeAttribute('data-bunny-ears');
    return;
  }
  const slotCfg = state.currentSlotStyle?.slots?.[slotName];
  const enabled = slotCfg?.bubbleBunnyEars !== undefined && slotCfg.bubbleBunnyEars !== null
    ? slotCfg.bubbleBunnyEars
    : state.currentConfig.bubbleBunnyEars;
  if (!enabled) {
    removeBunnyEarSpans(el);
    el.removeAttribute('data-bunny-ears');
    return;
  }
  el.setAttribute('data-bunny-ears', 'true');
  const { left, right } = ensureBunnyEarSpans(el);
  // Role class nằm trên .ovs-message cha (author/message slot không tự mang
  // class role), nên phải tìm ngược lên để biết message này thuộc role nào.
  const bg = rowNode ? resolveEarBgForSlot(rowNode, slotName) : null;
  if (bg) {
    left.style.background = bg;
    right.style.background = bg;
  } else {
    left.style.removeProperty('background');
    right.style.removeProperty('background');
  }
}

export function refreshAllSlotBunnyEars() {
  const applyTo = (node) => {
    applyMessageBunnyEars(node);
    const authorEl = node.querySelector('[data-slot="author"]');
    const messageEl = node.querySelector('[data-slot="message"]');
    applySlotBunnyEars(authorEl, 'author');
    applySlotBunnyEars(messageEl, 'message');
  };
  listEl.querySelectorAll('.ovs-message').forEach(applyTo);
}
