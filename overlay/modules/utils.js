// Pure helpers with no dependency on shared state or the DOM (aside from
// applyInlineStyle, which just writes to an element it's handed).
//
// toImageProxyUrl and compileLayerInlineStyle used to be hand-copied mirrors
// of shared/image-url.js and shared/decoration-config.js (see git history).
// They're now re-exported straight from the generated ESM bridge at /shared
// (see main/server/shared-esm-bridge.js) so there's exactly one implementation.

export { toImageProxyUrl } from '/shared/image-url.mjs';
export { compileLayerInlineStyle } from '/shared/decoration-config.mjs';

export function px(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n}px` : '0px';
}

export function offsetVar(value) {
  return value != null && Number.isFinite(Number(value)) ? px(value) : 'auto';
}

export function zIndexVar(value) {
  return value != null && Number.isFinite(Number(value)) ? String(value) : 'auto';
}

export function applyInlineStyle(el, styleMap) {
  Object.entries(styleMap).forEach(([key, value]) => {
    el.style[key] = value;
  });
}
