// bubble-reset.js — scrubs one bubble node (`.ovs-slot` root, as returned
// by message-renderer.js#createMessageNode) back to a neutral state so it
// can be handed out again by BubblePool#acquire() and rebuilt from scratch
// for a different message.
//
// NO IMPORTS from renderer-specific modules (state.js, message-renderer.js,
// decoration.js, bubble.js, etc.) — it works purely off DOM structure/
// attributes that are already stable, documented contracts elsewhere in
// the app (data-slot="...", .ovs-message, .ovs-decoration-layer, ...), not
// off those modules' internals. That's what keeps the Pool independent of
// the renderer: the renderer can change how it BUILDS a bubble all it
// wants, as long as it keeps building onto these same slot/class contracts,
// and this file never has to change or import anything from it.
//
// TWO deliberate exceptions to the "no imports" rule above, both other
// Pool-layer siblings (not renderer modules):
//   - StickerPool.js — every `.ovs-decoration-layer` inside a bubble was
//     handed out by StickerPoolManager#acquire() and is tracked ACTIVE
//     there. Discarding it here with a bare `.remove()` would leak that
//     bookkeeping and throw away a reusable Sticker node instead of
//     returning it to its own pool.
//   - TexturePool.js — same reasoning, for every `.ovs-bubble-texture`
//     handed out by TexturePoolManager#acquire(). `.ovs-bunny-ear` spans
//     are unrelated and still destroyed outright below — only the
//     texture div is pool-managed.
// Routing both through their own release() keeps every pool's bookkeeping
// consistent without this file needing to know anything about decoration/
// texture rendering itself.

// Every reset* helper below is deliberately narrow (one job each) so the
// full resetBubbleNode() pass reads as a checklist matching the one this
// module was speced against: text, author, badges, avatar, sticker,
// decoration, texture, animation, dataset, classList, inline style,
// opacity, transform, visibility, pointer events, aria, data attributes.
// See the doc comment on resetBubbleNode() below for exactly which helper
// is responsible for each item.

// Root's own base class (".ovs-message") gets clobbered by the renderer
// with role/event/superchat classes for the life of an ACTIVE bubble.
// Captured EXACTLY ONCE per underlying node, at the moment it's still
// pristine (see captureBubbleBaseline(), called by PoolManager.js's
// factory right after cloning, before any build happens) — capturing it
// lazily on first release() instead would be too late: by then the class
// list already has role/event classes baked in, and resetRowClasses()
// would "restore" that mutated string forever after.
import { stickerPoolManager } from './StickerPool.js';
import { texturePoolManager } from './TexturePool.js';

const BASE_ROW_CLASS = new WeakMap(); // rowEl -> pristine className string

function resolveRowEl(node) {
  return node.querySelector('.ovs-message') || node;
}

/**
 * Records a node's pristine (just-cloned-from-template, never-built)
 * className baseline so later reset passes know exactly what to restore
 * on the row element. Must be called on a node that hasn't been built yet
 * — calling it after createMessageNode() has already added classes would
 * bake those classes into the "baseline" permanently.
 */
export function captureBubbleBaseline(node) {
  if (!node) return node;
  const rowEl = resolveRowEl(node);
  if (rowEl && !BASE_ROW_CLASS.has(rowEl)) {
    BASE_ROW_CLASS.set(rowEl, rowEl.className);
  }
  return node;
}

// `data-slot="avatar|author|badges|message"` is baked directly into every
// theme's template.html (see themes/*/template.html) — it's how
// message-renderer.js finds each slot element in the first place
// (`node.querySelector('[data-slot="message"]')`, etc.), not per-message
// state. It's structural, exactly like the row's baseline className
// (BASE_ROW_CLASS above) — never something a release() should strip.
// Wiping it (as a blanket "delete every dataset key" pass would) breaks
// slot lookup on the NEXT build for this exact node: createMessageNode()
// would silently find no author/badges/message element to write into.
const DATASET_KEYS_TO_PRESERVE = new Set(['slot']);

function clearDataset(el) {
  if (!el || !el.dataset) return;
  Object.keys(el.dataset).forEach((key) => {
    if (DATASET_KEYS_TO_PRESERVE.has(key)) return;
    delete el.dataset[key];
  });
}

// reset text — message body (both the raw slot and the emoji-only glyph
// wrapping message-renderer.js/emoji.js may have applied inside it).
function resetText(node) {
  const messageEl = node.querySelector('[data-slot="message"]');
  if (!messageEl) return;
  messageEl.innerHTML = '';
  messageEl.removeAttribute('data-emoji-only');
  clearDataset(messageEl);
  messageEl.removeAttribute('style');
}

// reset author — author name span, and the superchat "author area" wrapper
// message-renderer.js sometimes inserts around it (must be unwrapped, or
// the next build would see an already-wrapped authorEl and double-wrap it).
function resetAuthor(node) {
  const authorEl = node.querySelector('[data-slot="author"]');
  if (!authorEl) return;

  const areaWrapper = node.querySelector('.ovs-author-area');
  if (areaWrapper && areaWrapper.contains(authorEl)) {
    const grandparent = areaWrapper.parentElement;
    if (grandparent) grandparent.insertBefore(authorEl, areaWrapper);
    areaWrapper.remove();
  }

  authorEl.innerHTML = '';
  clearDataset(authorEl);
  authorEl.removeAttribute('style');
}

// reset badge — badges slot text content + its derived visibility flag.
function resetBadge(node) {
  const badgesEl = node.querySelector('[data-slot="badges"]');
  if (!badgesEl) return;
  badgesEl.textContent = '';
  badgesEl.removeAttribute('data-hidden');
  clearDataset(badgesEl);
  badgesEl.removeAttribute('style');
}

// reset avatar — avatar.js#applyAvatar() sets src/onload/onerror/data-hidden/
// dataset.avatarUrl on this element and, critically, only reassigns
// onload/onerror on the branches where an image actually loads; the
// "no rawUrl / avatar hidden" branch just clears src and returns, leaving a
// PREVIOUS message's onload/onerror closures still attached to the element.
// Those closures don't capture anything message-specific (they just toggle
// data-hidden on this same avatarEl), so they were harmless even before —
// but a pooled node must not carry ANY stale state into its next life on
// principle. Cleared unconditionally here so a released node starts every
// future build from a truly blank avatar instead of relying on the next
// applyAvatar() call to happen to overwrite every field it touches.
function resetAvatar(node) {
  const avatarEl = node.querySelector('[data-slot="avatar"]');
  if (!avatarEl) return;
  avatarEl.onload = null;
  avatarEl.onerror = null;
  avatarEl.removeAttribute('src');
  avatarEl.removeAttribute('data-hidden');
  clearDataset(avatarEl); // drops dataset.avatarUrl set by message-renderer.js
  avatarEl.removeAttribute('style');
}

// reset texture — bubble.js's real-DOM texture overlay + bunny-ear spans.
// The texture div is returned to TexturePool (reset + detached, ready for
// reuse) since ensureBubbleTexture() acquires it from there; bunny-ear
// spans are unrelated to the Texture Pool and are still simply removed —
// they're re-created lazily by ensureBunnyEarSpans() on the next build if
// still enabled.
function resetTexture(node) {
  node.querySelectorAll('.ovs-bubble-texture').forEach((el) => texturePoolManager.release(el));
  node.querySelectorAll('.ovs-bunny-ear').forEach((el) => el.remove());
  node.querySelectorAll('[data-bunny-ears]').forEach((el) => el.removeAttribute('data-bunny-ears'));
}

// reset decoration — every decoration layer (stickers/frames/etc.) and the
// per-anchor hosts/markers they were mounted on. Mirrors decoration.js's
// own clearDecorationLayers() contract (same classes/attributes) without
// importing it, per this file's no-imports rule.
function resetDecoration(node) {
  node.querySelectorAll('.ovs-decoration-layer').forEach((el) => stickerPoolManager.release(el));
  node.querySelectorAll('.ovs-decoration-host').forEach((el) => el.remove());
  node.querySelectorAll('.ovs-decoration-anchor').forEach((wrap) => {
    // Unwrap: move the real element (e.g. the avatar <img>) back out to
    // where the wrapper was, then drop the wrapper — mirrors
    // ensureDecorationAnchor()'s wrap direction in reverse.
    const child = wrap.firstElementChild;
    if (child && wrap.parentNode) {
      wrap.parentNode.insertBefore(child, wrap);
    }
    wrap.remove();
  });
  node.querySelectorAll('[data-has-decoration]').forEach((el) => delete el.dataset.hasDecoration);
  if (node.dataset.hasDecoration) delete node.dataset.hasDecoration;
}

// reset animation state — enter-animation class (only ever transiently
// present; a bubble mid-pool-release has no business still carrying it),
// idle-wobble stagger hook, and the animation-state dataset hook
// bubble-updater.js's applyAnimationUpdate() writes.
function resetAnimationState(node, rowEl) {
  node.querySelectorAll('.ovs-slot-enter').forEach((el) => el.classList.remove('ovs-slot-enter'));
  node.style.removeProperty('--ovs-idle-index');
  delete rowEl.dataset.ovsAnimState;
  // Danmaku-only hooks — harmless no-op for stack-mode nodes that never
  // had them, but keeps a node fully neutral if it's ever cross-used.
  delete node.dataset.danmakuLane;
  node.style.removeProperty('animation-duration');
}

// reset transform — ticker mode drives `el.style.transform` directly every
// frame; a node coming back to the pool must not still carry a stale
// translate3d() from wherever it last was on screen.
function resetTransform(node) {
  node.style.removeProperty('transform');
  node.style.removeProperty('top');
}

// reset opacity — nothing in this app currently animates opacity via
// inline style, but enter/exit transitions are exactly the kind of thing
// that does, so this is scrubbed unconditionally and cheaply regardless.
function resetOpacity(node) {
  node.style.removeProperty('opacity');
}

// reset dataset — every dataset key on BOTH the root (`.ovs-slot` — e.g.
// render-queue.js's `ovsBubbleId`, special-modes.js's `danmakuLane`) AND
// the row (`.ovs-message` — e.g. message-renderer.js's `ovsSuperchatTier`/
// `ovsMemberMonths`, bubble-updater.js's `ovsAnimState`). These are two
// different elements, each accumulating their own dataset keys during a
// build, so both need their own clear pass — clearing only `node`'s
// dataset would silently leave the previous message's superchat tier/
// member-months/anim-state sitting on rowEl for the next occupant to
// inherit by accident.
function resetRootDataset(node, rowEl) {
  clearDataset(node);
  if (rowEl && rowEl !== node) clearDataset(rowEl);
}

// reset inline style — catch-all pass, run LAST (before the class/dataset
// passes below, which target specific elements rather than sweep the whole
// subtree). Individual resets above already handle the fields they're
// responsible for; this exists so any inline style set anywhere in the
// build path that this file doesn't individually know about — superchat
// CSS custom properties (--ovs-superchat-tier-color/-bg/-border), decoration
// masks (mask-image/-webkit-mask-image/mask-repeat/mask-size), the
// isolation/position styles ensureDecorationHost()/ensurePositionedAnchor()
// set on anchor elements, and specifically OPACITY, TRANSFORM, VISIBILITY,
// and POINTER-EVENTS if any future feature ever drives them via inline
// style — can never survive a release() by accident. Nothing in this app
// currently sets visibility/pointer-events directly (slot show/hide is
// entirely `data-hidden` + CSS `display:none`, handled by clearDataset()
// in resetText/resetAuthor/resetBadge/resetAvatar above), so this is the
// generic safety net for that category, not the primary mechanism.
function resetInlineStyleCatchAll(node, rowEl) {
  node.removeAttribute('style');
  if (rowEl && rowEl !== node) rowEl.removeAttribute('style');
  node.querySelectorAll('[style]').forEach((el) => el.removeAttribute('style'));
}

// reset aria/role — no build-path code currently leaves an aria-* or role
// attribute on a *surviving* element (bubble.js's aria-hidden="true" bunny
// ears are removed wholesale by resetTexture() above, not left behind), but
// nothing enforces that invariant either. This sweeps every descendant so a
// pooled node can never carry a stale aria-hidden/aria-label/role from one
// message into the next if a future feature adds one — same "belt and
// suspenders" reasoning as the inline-style catch-all above, just for the
// accessibility-attribute category instead of the style category.
function stripAriaAttrs(el) {
  Array.from(el.attributes).forEach((attr) => {
    if (attr.name === 'role' || attr.name.startsWith('aria-')) {
      el.removeAttribute(attr.name);
    }
  });
}

function resetAriaAttributes(node) {
  stripAriaAttrs(node); // querySelectorAll below only matches descendants, not node itself
  const descendants = node.querySelectorAll('[aria-hidden], [aria-label], [aria-live], [aria-describedby], [aria-current], [role]');
  descendants.forEach(stripAriaAttrs);
}

// reset role/event classes on the row — restores rowEl.className to
// whatever it was the very first time this node was seen (its theme-
// template baseline, captured by captureBubbleBaseline() before this node
// was ever built), stripping every ovs-moderator / ovs-member /
// ovs-superchat* / ovs-event-* / ovs-superchat-youtube class the
// build path added. Falls back to the current className on the (should-
// never-happen) chance a node reaches release() without ever having gone
// through captureBubbleBaseline() — better to no-op than to blank the row
// class out entirely.
function resetRowClasses(rowEl) {
  const baseline = BASE_ROW_CLASS.get(rowEl);
  if (baseline !== undefined) {
    rowEl.className = baseline;
  }
}

/**
 * Resets one bubble node to a neutral, reusable state so it carries NO
 * state from whichever message it last rendered. Safe to call on a node
 * that was never fully built (e.g. straight out of factory()) — every
 * helper above is a no-op when its target slot/element isn't present.
 *
 * Checklist this pass covers (each mapped to the helper responsible):
 *   - text              -> resetText (message slot innerHTML)
 *   - author            -> resetAuthor (author slot innerHTML + unwrap)
 *   - badges            -> resetBadge (badges slot textContent)
 *   - avatar            -> resetAvatar (src/onload/onerror/data-hidden/dataset)
 *   - sticker           -> resetText — stickers render as an <img> inside
 *                          the message slot's innerHTML, wiped along with it
 *   - decoration        -> resetDecoration (layers/hosts/anchors)
 *   - texture           -> resetTexture (bubble texture + bunny-ear spans)
 *   - animation         -> resetAnimationState (enter class, idle-index,
 *                          anim-state dataset, danmaku lane, anim-duration)
 *   - dataset           -> resetRootDataset (root + row) + the per-slot
 *                          clearDataset() calls inside resetText/resetAuthor/
 *                          resetBadge/resetAvatar (each slot's own dataset)
 *   - classList         -> resetRowClasses (row restored to captured
 *                          baseline) — texture/decoration/bunny-ear elements
 *                          that carried their own classes are removed
 *                          outright rather than having classes stripped
 *   - inline style       -> resetInlineStyleCatchAll (root+row+every
 *                          descendant with a style attribute)
 *   - opacity           -> resetOpacity + the inline-style catch-all
 *   - transform         -> resetTransform + the inline-style catch-all
 *   - visibility        -> data-hidden attribute, cleared via clearDataset()
 *                          in resetText/resetAuthor/resetBadge/resetAvatar
 *                          (visibility in this app is 100% attribute-driven,
 *                          see overlay/slot-visibility.css) + the inline-
 *                          style catch-all as a generic safety net
 *   - pointer events    -> inline-style catch-all (nothing sets this today,
 *                          but any future inline pointer-events is covered)
 *   - aria              -> resetAriaAttributes (aria- attrs and role, whole subtree)
 *   - data attributes   -> same as "dataset" above — dataset and
 *                          data-* attributes are the same underlying thing
 *
 * Order matters: structural removals (texture/decoration) run before the
 * inline-style/aria sweeps so nothing removed still gets needlessly visited,
 * and resetRootDataset() runs after per-slot dataset clears so it's a
 * cheap no-op there and only does real work on root/row's own keys.
 */
export function resetBubbleNode(node) {
  if (!node) return node;
  const rowEl = resolveRowEl(node);

  resetText(node);
  resetAuthor(node);
  resetBadge(node);
  resetAvatar(node);
  resetTexture(node);
  resetDecoration(node);
  resetAnimationState(node, rowEl);
  resetTransform(node);
  resetOpacity(node);
  resetRowClasses(rowEl);
  resetRootDataset(node, rowEl);
  resetInlineStyleCatchAll(node, rowEl);
  resetAriaAttributes(node);

  return node;
}

/**
 * Detaches a node from wherever it's currently mounted in the document,
 * WITHOUT destroying it — the whole point of pooling is that the node
 * object itself survives to be reused, only its place in the visible tree
 * goes away. Safe to call on a node that isn't attached to anything.
 */
export function detachBubbleNode(node) {
  if (node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
  return node;
}

export default { resetBubbleNode, detachBubbleNode, captureBubbleBaseline };

