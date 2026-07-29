// StickerPool — Object Pool riêng cho Sticker (`.ovs-decoration-layer`),
// tách biệt hoàn toàn khỏi BubblePoolManager (PoolManager.js) vốn chỉ pool
// nguyên bubble node.
//
// Dùng lại engine generic BubblePool (đã renderer-agnostic sẵn: chỉ cần
// factory()/reset()/destroy()) thay vì viết lại logic acquire/release/
// maxSize từ đầu.

import { BubblePool } from './BubblePool.js';
import { createBareStickerNode, resetStickerNode, destroyStickerNode } from './sticker-reset.js';
import { DEFAULT_MAX_POOL_SIZE, DEFAULT_WARMUP_SIZE } from './PoolConfig.js';

const enginePool = new BubblePool({
  factory: createBareStickerNode,
  reset: resetStickerNode,
  destroy: destroyStickerNode,
  maxSize: DEFAULT_MAX_POOL_SIZE,
  warmupSize: DEFAULT_WARMUP_SIZE,
});

export const stickerPoolManager = {
  /**
   * Trả về một Sticker node sẵn sàng để build (đã reset, hoặc mới tinh
   * nếu Pool đang rỗng). enginePool.acquire() tự ưu tiên lấy từ IDLE
   * trước khi factory() — Renderer không bao giờ tự tạo mới nếu Pool còn
   * object rảnh.
   */
  acquire(layerId = null) {
    return enginePool.acquire(layerId);
  },

  /**
   * Trả một Sticker node về Pool: reset toàn bộ state (id, placement,
   * style, animation, ảnh, mask, event handler — xem sticker-reset.js) và
   * detach khỏi DOM. An toàn khi gọi với node không do Pool này quản lý
   * (fallback: vẫn đảm bảo nó rời khỏi DOM, giống hành vi `.remove()` cũ).
   */
  release(node) {
    if (!node) return false;
    const released = enginePool.release(node);
    if (!released && node.parentNode) {
      node.parentNode.removeChild(node);
    }
    return released;
  },

  warmup(count) {
    return enginePool.warmup(count);
  },

  clear() {
    enginePool.clear();
  },

  size() {
    return enginePool.size();
  },

  available() {
    return enginePool.available();
  },

  stats() {
    return enginePool.stats();
  },
};

export default stickerPoolManager;
