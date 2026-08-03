// TexturePool — Object Pool riêng cho Texture Layer (`.ovs-bubble-texture`),
// tách biệt hoàn toàn khỏi BubblePoolManager (bubble node) và StickerPool
// (decoration layer). Dùng lại engine generic BubblePool thay vì viết lại
// logic acquire/release/maxSize từ đầu.

import { BubblePool } from './BubblePool.js';
import { createBareTextureNode, resetTextureNode, destroyTextureNode } from './texture-reset.js';
import { DEFAULT_MAX_POOL_SIZE, DEFAULT_WARMUP_SIZE } from './PoolConfig.js';

const enginePool = new BubblePool({
  factory: createBareTextureNode,
  reset: resetTextureNode,
  destroy: destroyTextureNode,
  maxSize: DEFAULT_MAX_POOL_SIZE,
  warmupSize: DEFAULT_WARMUP_SIZE,
});

export const texturePoolManager = {
  // Trả về một Texture Layer node sẵn sàng dùng (đã reset, hoặc mới tinh
  // Trả về một Texture Layer node sẵn sàng dùng (đã reset, hoặc mới tinh
  // nếu Pool đang rỗng). acquire() tự ưu tiên lấy từ IDLE trước khi
  // factory() — không tự tạo mới nếu Pool còn object rảnh.
  acquire(key = null) {
    return enginePool.acquire(key);
  },

  // Trả một Texture Layer node về Pool: reset toàn bộ state (xem
  // Trả một Texture Layer node về Pool: reset toàn bộ state (xem
  // texture-reset.js) và detach khỏi DOM. An toàn khi gọi với node không
  // do Pool này quản lý (fallback: vẫn đảm bảo nó rời khỏi DOM, giống
  // hành vi `.remove()` cũ).
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

export default texturePoolManager;
