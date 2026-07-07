import { useState } from 'react';

export default function ChatPreview({ overlayUrl, selectedTheme, previewKey, onRefresh }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(null);

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
      <div className="flex items-center justify-between mb-3">
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

      <div className="ovs-checkerboard rounded-lg border border-line flex-1 overflow-hidden">
        <iframe
          key={`${selectedTheme}-${previewKey}`}
          title="Overlay preview"
          src={overlayUrl}
          className="w-full h-full border-0"
        />
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
