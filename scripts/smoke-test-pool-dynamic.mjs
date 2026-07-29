// Verifies Dynamic Pool (expand()/shrink()) end to end:
//  1. expand() pre-builds IDLE items, respects maxSize, and is gated by a
//     cooldown so back-to-back calls don't each build something.
//  2. acquire() falls back to expand() the moment IDLE actually runs dry
//     ("Active Bubble > Available -> Pool tạo thêm Bubble") — WITHOUT
//     calling factory() while any IDLE item is still available, same
//     invariant smoke-test-pool-warmup.mjs already checks.
//  3. shrink() only ever reclaims IDLE items that have sat idle longer
//     than shrinkIdleAfterMs ("Pool dư Bubble quá lâu -> Pool thu hồi
//     dần"), never touches ACTIVE items, never goes below minSize, and
//     reclaims at most its step per call (gradual, not all at once).
//  4. Hysteresis: shrink() refuses to run shortly after a real expand()
//     (and vice versa via expand()'s own cooldown) so the pool doesn't
//     oscillate grow/shrink on bursty traffic.
import { BubblePool } from '../overlay/modules/pool/BubblePool.js';

function fail(msg) {
  throw new Error(`[smoke:pool-dynamic] ${msg}`);
}

// ===== Part 1: expand() ===================================================

function testExpand() {
  let factoryCalls = 0;
  const pool = new BubblePool({
    factory: () => {
      factoryCalls += 1;
      return { n: factoryCalls };
    },
    maxSize: 20,
    expandStep: 4,
    expandCooldownMs: 1000,
  });

  const built = pool.expand();
  if (built !== 4) fail(`expand() with no arg should use expandStep (4), got ${built}`);
  if (pool.available() !== 4) fail(`expected 4 idle after expand(), got ${pool.available()}`);

  // Hysteresis: a second expand() right after the first is cooldown-gated
  // — must build nothing, not silently double the pool.
  const secondCall = pool.expand();
  if (secondCall !== 0) fail(`expand() during cooldown should build 0, got ${secondCall}`);
  if (pool.available() !== 4) fail('cooldown-gated expand() must not have changed idle count');

  // force bypasses the cooldown.
  const forced = pool.expand(3, { force: true });
  if (forced !== 3) fail(`forced expand(3) should build 3 despite cooldown, got ${forced}`);
  if (pool.available() !== 7) fail(`expected 7 idle after forced expand(3), got ${pool.available()}`);

  // Bounded by maxSize even when forced.
  const capped = new BubblePool({ factory: () => ({}), maxSize: 5 });
  const cappedBuilt = capped.expand(20, { force: true });
  if (cappedBuilt !== 5) fail(`expand(20) on a maxSize:5 pool should only build 5, got ${cappedBuilt}`);

  console.log('[smoke] BubblePool#expand() ✔');
}

// ===== Part 2: acquire() falls back to expand() only once truly dry ======

function testAcquireFallsBackToExpand() {
  let factoryCalls = 0;
  const pool = new BubblePool({
    factory: () => {
      factoryCalls += 1;
      return { n: factoryCalls };
    },
    maxSize: 20,
    warmupSize: 5,
    expandStep: 3,
  });

  pool.warmup(5);
  const before = factoryCalls;

  // All 5 warmed-up items get handed out with ZERO extra factory() calls
  // — the existing "no bubble built while the pool still has a free one"
  // guarantee must still hold now that expand() exists.
  const handles = [];
  for (let i = 0; i < 5; i++) handles.push(pool.acquire(`msg-${i}`));
  if (factoryCalls !== before) fail('acquire() built something even though warmed-up idle items were available');

  // 6th acquire() with IDLE truly at 0 must fall back to expand(), which
  // builds MORE than the single item this acquire() needs (expandStep=3),
  // so the following couple of acquire() calls in the same burst are
  // satisfied from IDLE too.
  handles.push(pool.acquire('msg-extra'));
  if (factoryCalls !== before + 3) fail(`expected exactly 3 factory() calls from the expand() fallback, got ${factoryCalls - before}`);
  if (pool.available() !== 2) fail(`expected 2 leftover idle items from the expand() fallback, got ${pool.available()}`);

  // Those 2 leftover idle items get used without any further factory() calls.
  handles.push(pool.acquire('msg-extra-2'));
  handles.push(pool.acquire('msg-extra-3'));
  if (factoryCalls !== before + 3) fail('leftover idle items from the expand() fallback should satisfy the next acquire() calls with no new factory() calls');
  if (pool.available() !== 0) fail('leftover idle items should now be exhausted');

  console.log('[smoke] acquire() -> expand() fallback (Active Bubble > Available) ✔');
}

// ===== Part 3 & 4: shrink() — idle-duration floor, gradual, hysteresis ===

async function testShrink() {
  const destroyed = [];
  const pool = new BubblePool({
    factory: () => ({ id: Math.random() }),
    destroy: (v) => destroyed.push(v),
    maxSize: 50,
    minSize: 2,
    shrinkStep: 2,
    shrinkIdleAfterMs: 50,
    shrinkCooldownAfterExpandMs: 0, // isolate the idle-duration behavior from the expand cooldown in this part
  });

  // Force-build 6 idle items directly (bypassing the expand() cooldown
  // machinery, which part 4 below tests separately) so their
  // lastTransitionAt is "now".
  pool.expand(6, { force: true });
  if (pool.available() !== 6) fail('setup: expected 6 idle items');

  // Immediately shrinking must reclaim nothing — nothing has been idle
  // long enough yet ("Pool dư Bubble quá lâu", not "Pool dư Bubble").
  const tooSoon = pool.shrink();
  if (tooSoon !== 0) fail(`shrink() before shrinkIdleAfterMs elapses should reclaim 0, got ${tooSoon}`);
  if (pool.available() !== 6) fail('nothing should have been reclaimed yet');

  await new Promise((resolve) => setTimeout(resolve, 80));

  // Now stale — but shrink() only takes shrinkStep (2) per call, not the
  // whole surplus at once ("thu hồi dần" — gradual).
  const firstPass = pool.shrink();
  if (firstPass !== 2) fail(`expected shrink() to reclaim shrinkStep (2) idle items, got ${firstPass}`);
  if (pool.available() !== 4) fail(`expected 4 idle remaining after first shrink() pass, got ${pool.available()}`);
  if (destroyed.length !== 2) fail(`expected destroy() called exactly twice, got ${destroyed.length}`);

  const secondPass = pool.shrink();
  if (secondPass !== 2) fail(`expected a second shrink() pass to reclaim 2 more, got ${secondPass}`);
  if (pool.available() !== 2) fail(`expected 2 idle remaining after second shrink() pass, got ${pool.available()}`);

  // Floor (minSize=2) reached — further shrink() calls must reclaim
  // nothing, no matter how long those last 2 have been idle.
  const atFloor = pool.shrink();
  if (atFloor !== 0) fail(`shrink() at the minSize floor should reclaim 0, got ${atFloor}`);
  if (pool.available() !== 2) fail('shrink() must never reduce idle storage below minSize');

  console.log('[smoke] BubblePool#shrink() — gradual, idle-duration-gated, respects minSize floor ✔');
}

// ACTIVE items are never shrink candidates, regardless of how the pool
// tries to reclaim.
function testShrinkNeverTouchesActive() {
  const destroyed = [];
  const pool = new BubblePool({
    factory: () => ({ id: Math.random() }),
    destroy: (v) => destroyed.push(v),
    maxSize: 50,
    minSize: 0,
    shrinkStep: 50,
    shrinkIdleAfterMs: 0, // treat everything IDLE as immediately eligible
    shrinkCooldownAfterExpandMs: 0,
  });

  pool.warmup(5);
  const active1 = pool.acquire('a');
  const active2 = pool.acquire('b');
  if (pool.available() !== 3) fail('setup: expected 3 idle, 2 active');

  const reclaimed = pool.shrink(50, { force: true });
  if (reclaimed !== 3) fail(`expected shrink() to reclaim exactly the 3 idle items, got ${reclaimed}`);
  if (pool.available() !== 0) fail('all idle items should be gone');
  if (destroyed.length !== 3) fail(`expected destroy() called exactly 3 times (idle only), got ${destroyed.length}`);

  // The 2 still-ACTIVE items must be entirely unaffected — release() must
  // still work normally on both, proving they were never touched.
  if (!pool.release(active1)) fail('active1 should still be a valid, releasable ACTIVE item after shrink()');
  if (!pool.release(active2)) fail('active2 should still be a valid, releasable ACTIVE item after shrink()');

  console.log('[smoke] shrink() never destroys/evicts an ACTIVE item ✔');
}

// ===== Hysteresis: shrink() right after a real expand() is refused =======

function testHysteresisBetweenExpandAndShrink() {
  const pool = new BubblePool({
    factory: () => ({}),
    maxSize: 50,
    minSize: 0,
    expandStep: 4,
    shrinkStep: 10,
    shrinkIdleAfterMs: 0, // would otherwise be immediately eligible
    shrinkCooldownAfterExpandMs: 5000, // long cooldown so the test can't flake on timing
  });

  pool.expand(4, { force: true });
  if (pool.available() !== 4) fail('setup: expected 4 idle after expand()');

  const blocked = pool.shrink();
  if (blocked !== 0) fail(`shrink() right after a real expand() should be blocked by hysteresis, got ${blocked}`);
  if (pool.available() !== 4) fail('hysteresis-blocked shrink() must not have reclaimed anything');

  // force bypasses the hysteresis window when a caller genuinely needs to.
  const forced = pool.shrink(10, { force: true });
  if (forced !== 4) fail(`forced shrink() should bypass the post-expand cooldown, got ${forced}`);

  console.log('[smoke] shrink() hysteresis after a recent expand() ✔');
}

testExpand();
testAcquireFallsBackToExpand();
await testShrink();
testShrinkNeverTouchesActive();
testHysteresisBetweenExpandAndShrink();
console.log('[smoke] ALL DYNAMIC POOL CHECKS PASSED');
