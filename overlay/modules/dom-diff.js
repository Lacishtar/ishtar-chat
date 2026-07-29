// DOM Diff — generic "compare the intended value against what's actually
// in the DOM right now, and only write when they differ" primitives.
//
// Sits between the Virtual Bubble's dirty-flag categories (virtual-
// bubble.js) and the real DOM writes (bubble-updater.js): a category
// being dirty (e.g. dirty.style) means SOMETHING in that category
// changed, not that EVERY field inside it changed — e.g. a superchat
// message's `roles` field flipping while `avatarUrl` stays identical
// still marks the whole `style` category dirty. Without this layer,
// bubble-updater.js would blindly rewrite every field in a dirty
// category, including the ones that didn't actually change (reloading an
// unchanged avatar image, restarting a class-driven CSS animation that
// was never touched, etc.). Each helper below re-reads the DOM's current
// value immediately before writing and skips the write entirely when it
// already matches — so "texture giống -> không update", "class giống ->
// không update" hold even for fields bundled inside a dirty category.
//
// Every helper returns true when it actually wrote something, false when
// it was a no-op. Callers don't have to use the return value, but it's
// there for anything that wants to know/log whether a write happened.

export function diffText(el, value) {
  if (!el) return false;
  const next = value ?? '';
  if (el.textContent === next) return false; // text giống -> không update
  el.textContent = next;
  return true;
}

export function diffHTML(el, html) {
  if (!el) return false;
  const next = html ?? '';
  if (el.innerHTML === next) return false; // text (HTML) giống -> không update
  el.innerHTML = next;
  return true;
}

// Toggles a single class only when its current membership doesn't match
// the desired state — class giống (already has/lacks it correctly) ->
// không update, so a class-driven CSS animation bound to that class never
// restarts just because the class was harmlessly re-applied.
export function diffClass(el, className, shouldHave) {
  if (!el) return false;
  const has = el.classList.contains(className);
  if (has === !!shouldHave) return false;
  el.classList.toggle(className, !!shouldHave);
  return true;
}

// Keeps at most one class starting with `prefix` on the element (e.g. the
// "ovs-superchat-tier-" or "ovs-event-" family, where exactly one variant
// should ever be active). Removes any stale variant, adds the desired one
// only if it isn't already there. If the desired variant is already the
// only one present, this is a complete no-op — no classList touch at all.
export function diffExclusiveClass(el, prefix, desiredSuffix) {
  if (!el) return false;
  let wrote = false;
  const desired = desiredSuffix ? `${prefix}${desiredSuffix}` : null;
  Array.from(el.classList).forEach((cls) => {
    if (cls.startsWith(prefix) && cls !== desired) {
      el.classList.remove(cls);
      wrote = true;
    }
  });
  if (desired && !el.classList.contains(desired)) {
    el.classList.add(desired);
    wrote = true;
  }
  return wrote;
}

export function diffAttr(el, name, value) {
  if (!el) return false;
  if (value === null || value === undefined) {
    if (!el.hasAttribute(name)) return false;
    el.removeAttribute(name);
    return true;
  }
  const next = String(value);
  if (el.getAttribute(name) === next) return false; // style/attr giống -> không update
  el.setAttribute(name, next);
  return true;
}

export function diffDataset(el, key, value) {
  if (!el) return false;
  if (value === null || value === undefined || value === '') {
    if (!(key in el.dataset)) return false;
    delete el.dataset[key];
    return true;
  }
  const next = String(value);
  if (el.dataset[key] === next) return false;
  el.dataset[key] = next;
  return true;
}

export function diffStyleProp(el, prop, value) {
  if (!el) return false;
  if (value === null || value === undefined || value === '') {
    if (!el.style.getPropertyValue(prop)) return false;
    el.style.removeProperty(prop);
    return true;
  }
  const next = String(value);
  if (el.style.getPropertyValue(prop) === next) return false; // style giống -> không update
  el.style.setProperty(prop, next);
  return true;
}

// For image "texture" fields (avatar src, decoration img src, ...): the
// caller stores the raw source URL it last wrote in a dataset attribute
// (e.g. data-avatar-url) alongside the element's real `src`, since `src`
// itself gets resolved/proxied on the way in and is no longer directly
// comparable to the raw value. Comparing against that raw value avoids
// re-triggering an image load (and any onload/onerror flicker) when the
// texture genuinely hasn't changed.
export function diffTextureSrc(el, rawUrlDatasetKey, rawUrl, applyFn) {
  if (!el) return false;
  const current = el.dataset[rawUrlDatasetKey] || '';
  const next = rawUrl || '';
  if (current === next) return false; // texture giống -> không update
  el.dataset[rawUrlDatasetKey] = next;
  applyFn();
  return true;
}
