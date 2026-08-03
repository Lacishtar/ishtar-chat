
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
