// texture-reset.js — factory() + reset() cho một "Texture Layer" node
// (`.ovs-bubble-texture`) dùng bởi TexturePool.js.
// NO IMPORTS, cùng nguyên tắc với sticker-reset.js/bubble-reset.js: chỉ
// thao tác trên contract DOM ổn định (`.ovs-bubble-texture`) mà
// bubble-wrap.css đã bám vào — không đổi className, không đổi cách CSS
// đọc texture (background-image/... vẫn 100% đến từ CSS custom properties
// toàn cục như --ovs-bubble-texture-url, phần tử này không tự mang bất kỳ
// src/attribute riêng nào) -> giao diện/CSS giữ nguyên tuyệt đối.

// Dựng một Texture Layer node "trắng" — giống hệt những gì
// Dựng một Texture Layer node "trắng" — giống hệt những gì
// bubble.js#ensureBubbleTexture() từng tự tay document.createElement().
export function createBareTextureNode() {
  const tex = document.createElement('div');
  tex.className = 'ovs-bubble-texture';
  return tex;
}

// Scrub một Texture Layer node về trạng thái trung lập để acquire() lại
// Scrub một Texture Layer node về trạng thái trung lập để acquire() lại
// cho một bubble khác. Bản thân `.ovs-bubble-texture` không mang state
// riêng (không src, không dataset, không event listener — mọi hiển thị
// texture đến từ CSS var toàn cục qua bubble-wrap.css), nhưng vẫn dọn
// dataset/inline-style như một lớp phòng vệ chung, phòng trường hợp một
// theme/tính năng tương lai gắn thêm state trực tiếp lên phần tử này.
export function resetTextureNode(node) {
  if (!node) return node;

  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }

  if (node.dataset) {
    Object.keys(node.dataset).forEach((key) => delete node.dataset[key]);
  }
  node.removeAttribute('style');

  return node;
}

// Hủy thật sự một Texture Layer node (pool đầy / clear()) — chỉ cần đảm
// Hủy thật sự một Texture Layer node (pool đầy / clear()) — chỉ cần đảm
// bảo nó rời khỏi DOM, phần còn lại để GC lo.
export function destroyTextureNode(node) {
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

export default { createBareTextureNode, resetTextureNode, destroyTextureNode };
