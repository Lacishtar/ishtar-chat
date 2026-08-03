// already matches — so "texture giống -> không update", "class giống ->
// không update" hold even for fields bundled inside a dirty category.

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

// the desired state — class giống (already has/lacks it correctly) ->
// không update, so a class-driven CSS animation bound to that class never
export function diffClass(el, className, shouldHave) {
  if (!el) return false;
  const has = el.classList.contains(className);
  if (has === !!shouldHave) return false;
  el.classList.toggle(className, !!shouldHave);
  return true;
}

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

export function diffTextureSrc(el, rawUrlDatasetKey, rawUrl, applyFn) {
  if (!el) return false;
  const current = el.dataset[rawUrlDatasetKey] || '';
  const next = rawUrl || '';
  if (current === next) return false; // texture giống -> không update
  el.dataset[rawUrlDatasetKey] = next;
  applyFn();
  return true;
}
