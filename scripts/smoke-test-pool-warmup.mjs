// Verifies Pool Warmup end to end:
//  1. BubblePool#warmup() (generic engine) pre-builds IDLE items, is
//     idempotent, respects maxSize, and never touches ACTIVE items.
//  2. acquire() consumes warmed-up IDLE items WITHOUT calling factory()
//     again — i.e. "no bubble is created during the stream while the pool
//     still has a free one".
//  3. Once the pool actually runs dry, acquire() is still allowed to build
//     more (no hard ceiling on live growth).
//  4. PoolManager.warmup() resolves its count from the user-configurable
//     Pool Size (state.currentConfig.poolWarmupSize) at call time, with a
//     sane fallback, and an explicit argument always wins.
import { JSDOM } from 'jsdom';
import { BubblePool } from '../overlay/modules/pool/BubblePool.js';
import { DEFAULT_WARMUP_SIZE, DEFAULT_MAX_POOL_SIZE } from '../overlay/modules/pool/PoolConfig.js';

function fail(msg) {
  throw new Error(`[smoke:pool-warmup] ${msg}`);
}

// ===== Part 1: generic BubblePool#warmup() ===============================

function testGenericWarmup() {
  let factoryCalls = 0;
  const pool = new BubblePool({
    factory: () => {
      factoryCalls += 1;
      return { n: factoryCalls };
    },
    maxSize: 10,
  });

  // Nothing built yet — warmup() is opt-in, not automatic on construction.
  if (pool.size() !== 0) fail('pool should start empty before warmup()');

  const built = pool.warmup(5);
  if (built !== 5) fail(`warmup(5) should report building 5, got ${built}`);
  if (pool.available() !== 5) fail(`expected 5 idle items after warmup(5), got ${pool.available()}`);
  if (factoryCalls !== 5) fail(`expected exactly 5 factory() calls after warmup(5), got ${factoryCalls}`);

  // Idempotent: calling warmup(5) again when already at 5 builds nothing more.
  const builtAgain = pool.warmup(5);
  if (builtAgain !== 0) fail(`warmup(5) when already full should build 0 more, got ${builtAgain}`);
  if (factoryCalls !== 5) fail('re-running warmup(5) should not call factory() again');

  // Topping up: warmup(8) from 5 idle should only build the 3 missing.
  const toppedUp = pool.warmup(8);
  if (toppedUp !== 3) fail(`warmup(8) from 5 idle should build 3 more, got ${toppedUp}`);
  if (pool.available() !== 8) fail(`expected 8 idle after topping up, got ${pool.available()}`);

  // acquire() during "the stream" must NOT call factory() while idle
  // items are available — this is the actual "no tao Bubble trong luc
  // stream neu pool con Bubble ranh" requirement.
  const before = factoryCalls;
  for (let i = 0; i < 8; i++) pool.acquire(`msg-${i}`);
  if (factoryCalls !== before) fail('acquire() called factory() even though warmed-up idle items were available');
  if (pool.available() !== 0) fail('all 8 warmed-up items should now be ACTIVE, none idle');

  // Pool exhausted (0 idle) — a 9th acquire() must still succeed. Since
  // Dynamic Pool: this no longer builds a single overflow item — it falls
  // back to expand() ("Active Bubble > Available -> Pool tạo thêm
  // Bubble"), which builds a batch (bounded by maxSize's remaining room)
  // so the next few acquire() calls in the same burst are ALSO satisfied
  // without each paying factory() cost individually. Here maxSize=10 and
  // 8 are already tracked, so room for 2 more (expandStep defaults to 4,
  // capped down to the 2 that actually fit).
  const extra = pool.acquire('msg-extra');
  if (!extra) fail('acquire() on an exhausted pool should still build a fresh item, not fail');
  if (factoryCalls !== before + 2) fail(`expected the expand() fallback to build 2 (room-capped), got ${factoryCalls - before} more factory() calls`);
  if (pool.size() !== 10) fail(`pool should now track 10 total items (8 warm + 2-item expand() batch), got ${pool.size()}`);
  if (pool.available() !== 1) fail(`expand()'s batch should leave 1 leftover idle item after this acquire(), got ${pool.available()}`);

  // No hard ceiling on live growth even once maxSize's room is used up:
  // a 10th acquire() consumes that leftover idle item with no new
  // factory() call, and an 11th (pool now genuinely at maxSize, 0 room)
  // still succeeds via the bare factory() fallback.
  pool.acquire('msg-extra-2');
  if (factoryCalls !== before + 2) fail('the leftover idle item from the expand() batch should satisfy the 10th acquire() with no new factory() call');
  const overflow = pool.acquire('msg-extra-3');
  if (!overflow) fail('acquire() must still succeed even with zero maxSize room left for expand()');
  if (factoryCalls !== before + 3) fail('acquire() with zero expand() room should fall back to a single bare factory() build');

  // maxSize caps warmup() itself even if a caller asks for more.
  const capped = new BubblePool({ factory: () => ({}), maxSize: 4 });
  const cappedBuilt = capped.warmup(20);
  if (cappedBuilt !== 4) fail(`warmup(20) on a maxSize:4 pool should only build 4, got ${cappedBuilt}`);
  if (capped.available() !== 4) fail('capped pool should have exactly 4 idle after over-asking warmup()');

  console.log('[smoke] generic BubblePool#warmup() ✔');
}

// ===== Part 2: PoolManager — configurable Pool Size =======================

async function testPoolManagerConfigurableSize() {
  const dom = new JSDOM('<!doctype html><html><body><div id="ovs-chat-list"></div><link id="ovs-theme-style"></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.Node = dom.window.Node;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

  // state.js reads window.__OVS_INITIAL_STATE__ at module-eval time, so it
  // must be set BEFORE the first import of state.js (directly or via
  // PoolManager.js -> state.js).
  window.__OVS_INITIAL_STATE__ = { config: { poolWarmupSize: 6 } };

  const { state } = await import('../overlay/modules/state.js');
  const { bubblePoolManager } = await import('../overlay/modules/pool/PoolManager.js');

  // A minimal but structurally valid bubble template — PoolManager's
  // factory clones tpl.content.firstElementChild.
  const tpl = document.createElement('template');
  tpl.innerHTML = '<div class="ovs-slot"><div class="ovs-message"></div></div>';
  state.messageTemplate = tpl;

  // No explicit count -> reads state.currentConfig.poolWarmupSize (6).
  const built = bubblePoolManager.warmup();
  if (built !== 6) fail(`expected warmup() to build 6 from configured poolWarmupSize, got ${built}`);
  if (bubblePoolManager.available() !== 6) fail(`expected 6 idle bubble nodes available, got ${bubblePoolManager.available()}`);

  // Change the configured Pool Size at runtime (e.g. a dashboard edit
  // pushed down through applyThemePayload) — the NEXT warmup() call must
  // pick it up, proving the size isn't frozen at module-eval time.
  state.currentConfig.poolWarmupSize = 10;
  const toppedUp = bubblePoolManager.warmup();
  if (toppedUp !== 4) fail(`expected topping up from 6 to newly-configured 10 to build 4 more, got ${toppedUp}`);
  if (bubblePoolManager.available() !== 10) fail(`expected 10 idle after re-warming to the new size, got ${bubblePoolManager.available()}`);

  // An explicit argument always overrides the configured size.
  const explicit = bubblePoolManager.warmup(12);
  if (explicit !== 2) fail(`explicit warmup(12) from 10 idle should build 2 more, got ${explicit}`);

  // Acquiring one of the warmed-up nodes never touches the live document
  // (still detached/hidden) until the caller (render-queue.js) inserts it
  // — the Pool itself only hands back a ready, neutral, off-DOM node.
  const node = bubblePoolManager.acquire('first-message');
  if (node.isConnected) fail('a freshly acquired pooled node should not already be in the document');
  bubblePoolManager.release(node);

  // Missing/invalid config falls back to DEFAULT_WARMUP_SIZE instead of
  // throwing or silently building 0.
  bubblePoolManager.clear();
  state.currentConfig.poolWarmupSize = undefined;
  const fallbackBuilt = bubblePoolManager.warmup();
  if (fallbackBuilt !== DEFAULT_WARMUP_SIZE) {
    fail(`expected fallback to DEFAULT_WARMUP_SIZE (${DEFAULT_WARMUP_SIZE}) when unconfigured, got ${fallbackBuilt}`);
  }

  if (DEFAULT_WARMUP_SIZE > DEFAULT_MAX_POOL_SIZE) fail('DEFAULT_WARMUP_SIZE must not exceed DEFAULT_MAX_POOL_SIZE');

  console.log('[smoke] PoolManager configurable Pool Size (state.currentConfig.poolWarmupSize) ✔');
}

testGenericWarmup();
await testPoolManagerConfigurableSize();
console.log('[smoke] ALL POOL WARMUP CHECKS PASSED');
