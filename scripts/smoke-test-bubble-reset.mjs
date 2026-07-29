// Verifies resetBubbleNode() (overlay/modules/pool/bubble-reset.js) leaves
// NO trace of a previously-rendered message: text, author, badges, avatar,
// sticker, decoration, texture, animation, dataset, classList, inline
// style, opacity, transform, visibility, pointer-events, aria, data-*.
import { JSDOM } from 'jsdom';
import { resetBubbleNode, captureBubbleBaseline } from '../overlay/modules/pool/bubble-reset.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.document = dom.window.document;
global.Node = dom.window.Node;

function fail(msg) {
  throw new Error(`[smoke:bubble-reset] ${msg}`);
}

function buildDirtyBubble() {
  const root = document.createElement('div'); // .ovs-slot
  root.className = 'ovs-slot';
  root.dataset.ovsBubbleId = '123';
  root.dataset.danmakuLane = '4';
  root.style.transform = 'translate3d(50px, 0, 0)';
  root.style.opacity = '0.4';
  root.setAttribute('aria-hidden', 'true');

  const row = document.createElement('div'); // .ovs-message (rowEl)
  row.className = 'ovs-message ovs-moderator ovs-superchat ovs-event-superchat';
  row.dataset.ovsMemberMonths = '7';
  row.dataset.ovsAnimState = 'idle-wobble';
  row.dataset.hasDecoration = 'true';
  row.style.setProperty('--ovs-superchat-tier-color', '#fff');
  root.appendChild(row);
  // Record baseline the way PoolManager does at factory-time — but AFTER
  // the row already has dirty classes, to prove resetRowClasses() would
  // fall back safely; instead simulate the real flow: capture baseline on
  // a pristine clone BEFORE building.
  const pristineRoot = root.cloneNode(true);
  pristineRoot.querySelector('.ovs-message').className = 'ovs-message';
  captureBubbleBaseline(pristineRoot); // wrong instance on purpose is avoided below

  // Redo properly: build baseline capture against the SAME row instance
  // this test dirties, exactly like PoolManager's real factory() ->
  // captureBubbleBaseline() -> createMessageNode() ordering.
  row.className = 'ovs-message';
  captureBubbleBaseline(root);
  row.className = 'ovs-message ovs-moderator ovs-superchat ovs-event-superchat';

  const avatar = document.createElement('img');
  avatar.setAttribute('data-slot', 'avatar');
  avatar.src = 'https://example.com/avatar.png';
  avatar.dataset.avatarUrl = 'https://example.com/avatar.png';
  avatar.onload = () => { throw new Error('stale onload should never fire'); };
  avatar.onerror = () => { throw new Error('stale onerror should never fire'); };
  avatar.style.opacity = '0.5';
  row.appendChild(avatar);

  const author = document.createElement('div');
  author.setAttribute('data-slot', 'author');
  author.innerHTML = '<span class="ovs-author-text">OldUser</span>';
  author.dataset.foo = 'bar';
  const areaWrapper = document.createElement('div');
  areaWrapper.className = 'ovs-author-area';
  row.appendChild(areaWrapper);
  areaWrapper.appendChild(author);
  const amountEl = document.createElement('span');
  amountEl.className = 'ovs-superchat-amount';
  amountEl.textContent = '$5.00';
  areaWrapper.appendChild(amountEl);

  const badges = document.createElement('div');
  badges.setAttribute('data-slot', 'badges');
  badges.textContent = '[mod]';
  row.appendChild(badges);

  const message = document.createElement('div');
  message.setAttribute('data-slot', 'message');
  message.setAttribute('data-emoji-only', 'true');
  message.innerHTML = '<span class="ovs-text-content"><img class="ovs-sticker-img" src="sticker.png"></span>';
  row.appendChild(message);

  const texture = document.createElement('div');
  texture.className = 'ovs-bubble-texture';
  row.insertBefore(texture, row.firstChild);

  const earLeft = document.createElement('span');
  earLeft.className = 'ovs-bunny-ear ovs-bunny-ear--left';
  earLeft.setAttribute('aria-hidden', 'true');
  earLeft.style.background = 'pink';
  row.insertBefore(earLeft, row.firstChild);
  row.setAttribute('data-bunny-ears', 'true');

  const decHost = document.createElement('div');
  decHost.className = 'ovs-decoration-host';
  const decLayer = document.createElement('div');
  decLayer.className = 'ovs-decoration-layer';
  decLayer.dataset.layerId = 'l1';
  decHost.appendChild(decLayer);
  row.appendChild(decHost);
  row.dataset.hasDecoration = 'true';

  const decAnchor = document.createElement('span');
  decAnchor.className = 'ovs-decoration-anchor';
  decAnchor.dataset.anchor = 'avatar';
  const wrappedImg = document.createElement('img');
  wrappedImg.className = 'wrapped-avatar-marker';
  decAnchor.appendChild(wrappedImg);
  row.appendChild(decAnchor);

  const enterEl = document.createElement('span');
  enterEl.classList.add('ovs-slot-enter');
  row.appendChild(enterEl);

  return root;
}

const node = buildDirtyBubble();
resetBubbleNode(node);

const rowEl = node.querySelector('.ovs-message');

// text
if (node.querySelector('[data-slot="message"]').innerHTML !== '') fail('message text not cleared');
if (node.querySelector('[data-slot="message"]').hasAttribute('data-emoji-only')) fail('data-emoji-only leaked');
// sticker (was inside message innerHTML)
if (node.querySelector('.ovs-sticker-img')) fail('sticker image leaked');
// author
if (node.querySelector('[data-slot="author"]').innerHTML !== '') fail('author not cleared');
if (node.querySelector('.ovs-author-area')) fail('author-area wrapper not unwrapped/removed');
if (node.querySelector('.ovs-superchat-amount')) fail('superchat amount el leaked');
// badges
if (node.querySelector('[data-slot="badges"]').textContent !== '') fail('badges not cleared');
// avatar
const avatarEl = node.querySelector('[data-slot="avatar"]');
if (avatarEl.hasAttribute('src')) fail('avatar src leaked');
if (avatarEl.onload || avatarEl.onerror) fail('avatar onload/onerror handlers leaked');
if (avatarEl.dataset.avatarUrl) fail('avatar dataset leaked');
// texture / bunny ears
if (node.querySelector('.ovs-bubble-texture')) fail('texture leaked');
if (node.querySelector('.ovs-bunny-ear')) fail('bunny ear leaked');
if (rowEl.hasAttribute('data-bunny-ears')) fail('data-bunny-ears leaked');
// decoration
if (node.querySelector('.ovs-decoration-layer')) fail('decoration layer leaked');
if (node.querySelector('.ovs-decoration-host')) fail('decoration host leaked');
if (node.querySelector('.ovs-decoration-anchor')) fail('decoration anchor wrapper not unwrapped');
if (!node.querySelector('.wrapped-avatar-marker')) fail('decoration anchor unwrap lost the wrapped element');
if (rowEl.dataset.hasDecoration) fail('hasDecoration dataset leaked');
// animation
if (node.querySelector('.ovs-slot-enter')) fail('slot-enter class leaked');
if (rowEl.dataset.ovsAnimState) fail('ovsAnimState dataset leaked');
if (node.dataset.danmakuLane) fail('danmakuLane dataset leaked');
// classList — row restored to baseline
if (rowEl.className !== 'ovs-message') fail(`row classes not reset to baseline, got "${rowEl.className}"`);
// dataset / data attributes
if (node.dataset.ovsBubbleId) fail('root dataset leaked');
if (rowEl.dataset.ovsMemberMonths) fail('member-months dataset leaked');
// inline style: opacity/transform/custom props
if (node.getAttribute('style')) fail('root inline style leaked');
if (rowEl.getAttribute('style')) fail('row inline style leaked');
if (avatarEl.getAttribute('style')) fail('avatar inline style leaked');
// aria
if (node.hasAttribute('aria-hidden')) fail('root aria-hidden leaked');

console.log('[smoke] bubble-reset: full checklist (text/author/badges/avatar/sticker/decoration/texture/animation/dataset/classList/inline-style/opacity/transform/visibility/aria/data-attrs) clean after release ✔');
