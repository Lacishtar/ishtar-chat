// sticker-reset.js — factory() + reset() cho một "Sticker" node
// dùng bởi StickerPool.js.
// NO IMPORTS, cùng nguyên tắc với bubble-reset.js: chỉ thao tác trên cấu
// trúc DOM/class/attribute đã là contract ổn định giữa decoration.js và
// Không đổi class name, không đổi cấu trúc lồng nhau -> giao diện/CSS/animation
// giữ nguyên y hệt trước khi có Pool.

// Dựng một Sticker node "trắng" — cấu trúc DOM giống hệt những gì
// Dựng một Sticker node "trắng" — cấu trúc DOM giống hệt những gì
// decoration.js#applyDecorationLayers() từng tự tay document.createElement()
// trong nhánh tạo layer mới. Không gán bất kỳ thuộc tính động nào theo
// message/layer (src, dataset, style...) — những cái đó do decoration.js
// gán sau khi acquire().
export function createBareStickerNode() {
  const layerWrap = document.createElement('div');
  layerWrap.className = 'ovs-decoration-layer';

  const animWrap = document.createElement('div');
  animWrap.className = 'ovs-decoration-anim';

  const img = document.createElement('img');
  img.className = 'ovs-decoration-img';
  img.alt = '';
  img.decoding = 'async';

  animWrap.appendChild(img);
  layerWrap.appendChild(animWrap);
  return layerWrap;
}

function clearDataset(el) {
  if (!el || !el.dataset) return;
  Object.keys(el.dataset).forEach((key) => delete el.dataset[key]);
}

// Scrub một Sticker node về trạng thái trung lập để có thể acquire() lại
// Scrub một Sticker node về trạng thái trung lập để có thể acquire() lại
// cho một layer/message khác — không được mang theo BẤT KỲ state nào của
// lần dùng trước: id, placement, transform/style, animation, ảnh, mask,
// Cố tình KHÔNG đụng vào className của layerWrap/animWrap/img (đó là phần
// cấu trúc cố định mà CSS bám vào — animation/CSS phải giữ nguyên) và
// KHÔNG đụng cấu trúc lồng nhau (layerWrap > animWrap > img).
export function resetStickerNode(node) {
  if (!node) return node;

  // Detach khỏi host hiện tại — cùng hành vi với `.remove()` cũ trước khi
  // có Pool, chỉ khác là node vẫn sống để tái sử dụng thay vì bị hủy.
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }

  // layerWrap: id/placement (dataset) + toàn bộ inline style do
  // compileLayerInlineStyle() từng ghi (position/transform/zIndex/...).
  clearDataset(node);
  node.removeAttribute('style');

  const animWrap = node.querySelector(':scope > .ovs-decoration-anim');
  if (animWrap) {
    clearDataset(animWrap); // idleAnimation
    animWrap.removeAttribute('style');

    const img = animWrap.querySelector(':scope > img');
    if (img) {
      // Handler gán trực tiếp bằng property (không phải addEventListener)
      // nên phải null hóa tường minh, nếu không object cũ vẫn giữ closure
      // của lần dùng trước.
      img.onload = null;
      img.onerror = null;
      img.removeAttribute('src');
      img.removeAttribute('data-raw-src');
      img.removeAttribute('data-load-error');
      img.removeAttribute('data-mask-applied');
      img.removeAttribute('referrerpolicy');
      // Mask (maskImage/webkitMaskImage/maskRepeat/maskSize/...) chỉ được
      // set qua inline style — removeAttribute('style') dọn sạch toàn bộ.
      img.removeAttribute('style');
    }
  }

  return node;
}

// Hủy thật sự một Sticker node (pool đầy / clear()) — chỉ cần đảm bảo nó
// Hủy thật sự một Sticker node (pool đầy / clear()) — chỉ cần đảm bảo nó
// rời khỏi DOM, phần còn lại để GC lo.
export function destroyStickerNode(node) {
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

export default { createBareStickerNode, resetStickerNode, destroyStickerNode };
