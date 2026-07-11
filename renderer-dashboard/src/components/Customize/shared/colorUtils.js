export function rgbaToHexAlpha(rgba) {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/.exec(rgba || '');
  if (!match) return { hex: '#16191F', alpha: 0.72 };
  const [, r, g, b, a] = match;
  const hex = `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
  return { hex, alpha: a !== undefined ? Number(a) : 1 };
}

export function hexAlphaToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Parses any single-color CSS value we might encounter: rgba()/rgb(), plain
// hex (#rgb / #rrggbb), or 8-digit hex with alpha (#rrggbbaa) / 4-digit
// shorthand (#rgba). Falls back to a sane default if nothing matches.
export function parseAnyColor(value) {
  const str = (value || '').trim();
  if (/^#/.test(str)) {
    if (/^#[0-9a-f]{8}$/i.test(str)) {
      return { hex: str.slice(0, 7), alpha: parseInt(str.slice(7, 9), 16) / 255 };
    }
    if (/^#[0-9a-f]{4}$/i.test(str)) {
      const [r, g, b, a] = str.slice(1).split('');
      return { hex: `#${r}${r}${g}${g}${b}${b}`, alpha: parseInt(`${a}${a}`, 16) / 255 };
    }
    if (/^#[0-9a-f]{3}$/i.test(str)) {
      const [r, g, b] = str.slice(1).split('');
      return { hex: `#${r}${r}${g}${g}${b}${b}`, alpha: 1 };
    }
    if (/^#[0-9a-f]{6}$/i.test(str)) {
      return { hex: str, alpha: 1 };
    }
  }
  return rgbaToHexAlpha(str);
}

export function isGradient(value) {
  return typeof value === 'string' && /^(linear|radial)-gradient\(/i.test(value.trim());
}

// Splits a gradient's inner content on top-level commas only (so commas
// inside rgba(...) stops don't get treated as stop separators).
function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

let stopIdCounter = 0;
function nextStopId() {
  stopIdCounter += 1;
  return `stop-${Date.now()}-${stopIdCounter}`;
}

export function parseGradient(value) {
  const str = (value || '').trim();
  const isRadial = /^radial-gradient/i.test(str);
  const type = isRadial ? 'radial' : 'linear';
  const inner = str.replace(/^(linear|radial)-gradient\(/i, '').replace(/\)\s*$/, '');
  const parts = splitTopLevel(inner).map((p) => p.trim());
  if (!parts.length) return null;

  let angle = 90;
  let startIdx = 0;
  if (type === 'linear' && /deg\s*$/i.test(parts[0])) {
    angle = parseFloat(parts[0]) || 0;
    startIdx = 1;
  } else if (type === 'radial' && /^(circle|ellipse)/i.test(parts[0])) {
    startIdx = 1;
  }

  const stopParts = parts.slice(startIdx);
  if (stopParts.length < 2) return null;

  const stops = stopParts.map((p, i) => {
    const m = /^(.*?)(?:\s+(-?\d+(?:\.\d+)?)%)?$/.exec(p.trim());
    const colorStr = (m ? m[1] : p).trim();
    const position = m && m[2] !== undefined ? Number(m[2]) : (i / (stopParts.length - 1 || 1)) * 100;
    const { hex, alpha } = parseAnyColor(colorStr);
    return { id: nextStopId(), hex, alpha, position };
  });

  return { type, angle, stops };
}

export function serializeGradient({ type, angle, stops }) {
  const stopsCss = stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${hexAlphaToRgba(s.hex, s.alpha)} ${Math.round(s.position)}%`)
    .join(', ');
  if (type === 'radial') return `radial-gradient(circle, ${stopsCss})`;
  return `linear-gradient(${Math.round(angle)}deg, ${stopsCss})`;
}

// Builds a sensible starting 2-stop gradient from whatever solid color is
// currently set, so switching a picker from "Màu đơn" to "Gradient" doesn't
// dump the user into a jarring default.
export function defaultGradientFrom(value) {
  const { hex, alpha } = parseAnyColor(value);
  return {
    type: 'linear',
    angle: 90,
    stops: [
      { id: nextStopId(), hex, alpha, position: 0 },
      { id: nextStopId(), hex: '#FF6FA5', alpha, position: 100 },
    ],
  };
}
