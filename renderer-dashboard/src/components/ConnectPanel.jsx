import { useState } from 'react';
import StatusBadge from './StatusBadge.jsx';

export default function ConnectPanel({ api, status, onConnected }) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isConnected = status.status === 'connected' || status.status === 'stale';
  const isConnecting = status.status === 'connecting';

  async function handleConnect(e) {
    e.preventDefault();
    setLocalError(null);

    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url.trim())) {
      setLocalError('Link phải là youtube.com/watch, youtube.com/live hoặc youtu.be.');
      return;
    }

    setSubmitting(true);
    const result = await api.connect(url.trim());
    setSubmitting(false);
    if (!result.ok) {
      setLocalError('Không kết nối được — kiểm tra lại link livestream.');
    } else if (onConnected) {
      onConnected();
    }
  }

  async function handleDisconnect() {
    setSubmitting(true);
    await api.disconnect();
    setSubmitting(false);
  }

  return (
    <section className="rounded-xl bg-panel border border-line shadow-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm uppercase tracking-wide text-inkMuted">Kết nối</h2>
        <StatusBadge status={status.status} />
      </div>

      <form onSubmit={handleConnect} className="flex flex-col gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Dán link youtube.com/watch?v=... hoặc /live/..."
          disabled={isConnected || isConnecting}
          className="w-full rounded-lg bg-panelAlt border border-line px-3 py-2 text-sm font-mono
                     placeholder:text-inkMuted/60 focus:outline-none focus:ring-2 focus:ring-focusAccent
                     disabled:opacity-50"
        />

        {(localError || status.error) && (
          <p className="text-xs text-live leading-relaxed">{localError || status.error}</p>
        )}

        {isConnected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={submitting}
            className="rounded-lg bg-panelAlt border border-line hover:border-live/60 hover:text-live
                       text-sm font-medium py-2 transition-colors disabled:opacity-50"
          >
            Ngắt kết nối
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting || !url.trim() || isConnecting}
            className="rounded-lg bg-focusAccent hover:bg-focusAccent/90 text-white text-sm font-semibold
                       py-2 transition-colors disabled:opacity-50"
          >
            {isConnecting ? 'Đang kết nối…' : 'Kết nối'}
          </button>
        )}
      </form>
    </section>
  );
}
