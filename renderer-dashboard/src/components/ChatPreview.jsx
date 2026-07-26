import { useEffect, useMemo, useRef, useState } from 'react';
import { inputClass } from './Customize/shared/fields.jsx';

// Common OBS canvas / Browser Source resolutions. The point of all this is
// to render the overlay's iframe at the SAME pixel size a real OBS Browser
// Source would use, then visually scale that down to fit the dashboard
// panel — rather than letting the iframe stretch to whatever width the
// panel happens to be. The overlay leans on vw/vh and % positioning
// (danmaku lanes, layout margins, ...), so previewing at the panel's own
// (arbitrary, resizable) size gives numbers that don't match what OBS will
// actually show once it's rendering at a fixed 1920x1080 (or whatever the
// user's Browser Source is really configured as).
const CANVAS_PRESETS = [
  { id: '1920x1080', label: '1920 × 1080 (16:9)', width: 1920, height: 1080 },
  { id: '1280x720', label: '1280 × 720 (16:9)', width: 1280, height: 720 },
  { id: '2560x1440', label: '2560 × 1440 (16:9)', width: 2560, height: 1440 },
  { id: '3840x2160', label: '3840 × 2160 (4K)', width: 3840, height: 2160 },
  { id: '1080x1920', label: '1080 × 1920 (dọc)', width: 1080, height: 1920 },
  { id: '720x1280', label: '720 × 1280 (dọc)', width: 720, height: 1280 },
  { id: 'custom', label: 'Tuỳ chỉnh…' },
];

const MIN_DIM = 100;
const MAX_DIM = 7680;
const STORAGE_KEY = 'ovs-preview-canvas-v1';

function loadStoredCanvas() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const width = Number(parsed?.width);
    const height = Number(parsed?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return {
      presetId: typeof parsed?.presetId === 'string' ? parsed.presetId : 'custom',
      width: Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(width))),
      height: Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(height))),
    };
  } catch {
    return null;
  }
}

export default function ChatPreview({ overlayUrl, previewKey, onRefresh }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(null);

  const stored = useMemo(() => loadStoredCanvas(), []);
  const [presetId, setPresetId] = useState(stored?.presetId || '1920x1080');
  const [canvasWidth, setCanvasWidth] = useState(stored?.width || 1920);
  const [canvasHeight, setCanvasHeight] = useState(stored?.height || 1080);

  // The custom width/height <input>s are backed by their OWN string state
  // instead of being bound straight to canvasWidth/canvasHeight. If they
  // were bound directly and we clamped into [MIN_DIM, MAX_DIM] on every
  // keystroke, typing "600" would clamp the very first "6" up to 100
  // immediately (100 > 6), stomping the digit before the user could finish
  // typing. These buffers hold whatever the user is literally typing
  // (including "", a bare "6", etc.) and only get clamped/normalized on
  // blur; canvasWidth/canvasHeight still update live off any parseable
  // number so the preview keeps responding as you type.
  const [widthText, setWidthText] = useState(String(stored?.width || 1920));
  const [heightText, setHeightText] = useState(String(stored?.height || 1080));

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ presetId, width: canvasWidth, height: canvasHeight }),
      );
    } catch {
      // Preview-only convenience — fine to silently skip if storage is
      // unavailable (private mode, quota, etc.).
    }
  }, [presetId, canvasWidth, canvasHeight]);

  function handlePresetChange(id) {
    setPresetId(id);
    const preset = CANVAS_PRESETS.find((p) => p.id === id);
    if (preset && preset.width && preset.height) {
      setCanvasWidth(preset.width);
      setCanvasHeight(preset.height);
      setWidthText(String(preset.width));
      setHeightText(String(preset.height));
    }
  }

  // Free typing: accept literally whatever's in the box (so "", "6", "60"
  // all pass through untouched) and only push a live canvasWidth/Height
  // update when it currently parses to a real number, unclamped, so the
  // preview still tracks what's typed without fighting the caret.
  function handleCustomDimChange(dim, raw) {
    if (dim === 'width') setWidthText(raw);
    else setHeightText(raw);
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || raw.trim() === '') return;
    if (dim === 'width') setCanvasWidth(n);
    else setCanvasHeight(n);
  }

  // Only clamp into [MIN_DIM, MAX_DIM] once the user is done typing
  // (leaves the field), so an in-progress "6" on its way to "600" never
  // gets snapped up to 100 mid-keystroke.
  function handleCustomDimBlur(dim) {
    const current = dim === 'width' ? canvasWidth : canvasHeight;
    const raw = dim === 'width' ? widthText : heightText;
    const n = Math.round(Number(raw));
    const base = Number.isFinite(n) && raw.trim() !== '' ? n : current;
    const clamped = Math.min(MAX_DIM, Math.max(MIN_DIM, base));
    if (dim === 'width') {
      setCanvasWidth(clamped);
      setWidthText(String(clamped));
    } else {
      setCanvasHeight(clamped);
      setHeightText(String(clamped));
    }
  }

  // Measures the available space inside the checkerboard "stage" area so we
  // can compute a scale factor that fits the full canvasWidth x
  // canvasHeight iframe inside it — same idea as OBS Studio's own preview
  // pane, which scales the real canvas down (or up) to fit the window
  // instead of re-flowing content at a different resolution.
  const stageWrapRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setStageSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(() => {
    if (!stageSize.width || !stageSize.height || !canvasWidth || !canvasHeight) return 1;
    return Math.min(stageSize.width / canvasWidth, stageSize.height / canvasHeight);
  }, [stageSize, canvasWidth, canvasHeight]);

  const scaledWidth = Math.round(canvasWidth * scale);
  const scaledHeight = Math.round(canvasHeight * scale);

  async function handleCopy() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error('Copy failed', err);
      setCopyError('Không copy được — chọn URL và copy thủ công (Ctrl+C).');
    }
  }

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">
          Xem trước trực tiếp
        </h2>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-[11px] text-inkMuted hover:text-focusAccent transition-colors"
            >
              Làm mới preview
            </button>
          )}
          <span className="text-[11px] text-inkMuted/70">
            Đây chính là những gì OBS Browser Source sẽ hiển thị
          </span>
        </div>
      </div>

      {/* Canvas size controls — sets the REAL pixel size the iframe renders
          at (so vw/vh and % layout match a real OBS Browser Source), then
          the stage below scales that down to fit visually. */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select
          className={`${inputClass} w-auto`}
          value={presetId}
          onChange={(e) => handlePresetChange(e.target.value)}
        >
          {CANVAS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {presetId === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={widthText}
              onChange={(e) => handleCustomDimChange('width', e.target.value)}
              onBlur={() => handleCustomDimBlur('width')}
              className={`${inputClass} w-20`}
              aria-label="Chiều rộng canvas"
            />
            <span className="text-inkMuted text-xs">×</span>
            <input
              type="number"
              min={MIN_DIM}
              max={MAX_DIM}
              value={heightText}
              onChange={(e) => handleCustomDimChange('height', e.target.value)}
              onBlur={() => handleCustomDimBlur('height')}
              className={`${inputClass} w-20`}
              aria-label="Chiều cao canvas"
            />
          </div>
        )}

        <span className="text-[11px] text-inkMuted/70 ml-auto">
          {canvasWidth}×{canvasHeight}px · {Math.round(scale * 100)}%
        </span>
      </div>

      {/* Plain, unbordered measuring area that fills the panel — only used
          to know how much room is available for centering. The bordered /
          checkerboard box below is sized to the SCALED canvas dimensions
          only, so the visible preview frame itself is shaped like the real
          OBS Browser Source (e.g. a 16:9 rectangle), not a big square panel
          with the video floating in the middle of it. */}
      <div
        ref={stageWrapRef}
        className="flex-1 overflow-hidden flex items-center justify-center min-h-0 min-w-0"
      >
        <div
          className="ovs-checkerboard rounded-lg border border-line overflow-hidden shrink-0"
          style={{ width: scaledWidth || undefined, height: scaledHeight || undefined, position: 'relative' }}
        >
          {/* Scaling via `transform: scale()` + absolute positioning.
              We tried CSS `zoom` here first (it re-rasters instead of
              stretching a bitmap, so it's sharper on upscale) but `zoom`
              on an element containing an <iframe> is a known trouble spot
              in Chromium/CEF: the box the browser actually paints and the
              box it reserves in layout can disagree, which showed up here
              as the content only filling half the frame at some sizes.
              `transform: scale()` doesn't have that failure mode — the
              rendered box size is always exactly canvasWidth/Height * scale,
              guaranteed — so correctness wins over the (purely cosmetic,
              preview-only) softness it introduces when scaling up a lot. */}
          <div
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <iframe
              key={previewKey}
              title="Xem trước overlay"
              src={`${overlayUrl}${overlayUrl.includes('?') ? '&' : '?'}preview=1`}
              style={{ width: canvasWidth, height: canvasHeight, border: 0, display: 'block' }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={overlayUrl}
            className="flex-1 rounded-lg bg-panelAlt border border-line px-3 py-2 text-xs font-mono text-inkMuted"
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-lg bg-focusAccent hover:bg-focusAccent/90 text-white text-sm
                       font-semibold px-4 py-2 transition-colors"
          >
            {copied ? 'Đã copy!' : 'Copy URL cho OBS'}
          </button>
        </div>
        {copyError && (
          <p className="text-xs text-live leading-relaxed">{copyError}</p>
        )}
      </div>
    </section>
  );
}
