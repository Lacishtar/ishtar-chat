import { useEffect, useState } from 'react';

function formatStatusError(status, localError) {
  if (localError) return localError;
  if (!status.error) return null;

  const msg = status.error;
  if (msg.includes('Link không đúng') || msg === 'invalid_url') {
    return 'Link không đúng định dạng — dùng youtube.com/watch, /live/ hoặc youtu.be.';
  }
  if (msg.includes('Không tìm thấy khung chat') || msg.includes('container-not-found')) {
    return 'Không tìm thấy khung chat — video có thể không live hoặc YouTube đã đổi giao diện.';
  }
  if (msg.includes('selector') || msg.includes('Selector')) {
    return 'Lỗi selector DOM — kiểm tra main/selectors.config.json hoặc thử lại sau.';
  }
  return msg;
}

/**
 * ConnectPanel — connect/disconnect controls for the livestream chat source.
 *
 * Renders as a single horizontal row meant to sit inline in the app
 * header, next to StatusBadge.
 */
export default function ConnectPanel({ api, status, lastSessionUrl, onConnected }) {
  const [url, setUrl] = useState('');
  const [connectedUrl, setConnectedUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isConnected = status.status === 'connected' || status.status === 'stale';
  const isConnecting = status.status === 'connecting';
  const canReconnect = status.status === 'error' || status.status === 'stale';

  useEffect(() => {
    if (lastSessionUrl && !url) {
      setUrl(lastSessionUrl);
    }
  }, [lastSessionUrl, url]);

  useEffect(() => {
    if (isConnected && url) {
      setConnectedUrl(url);
    }
    if (status.status === 'idle') {
      setConnectedUrl('');
    }
  }, [isConnected, url, status.status]);

  async function doConnect(targetUrl) {
    setLocalError(null);

    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(targetUrl.trim())) {
      setLocalError('Link phải là youtube.com/watch, youtube.com/live hoặc youtu.be.');
      return false;
    }

    setSubmitting(true);
    const result = await api.connect(targetUrl.trim());
    setSubmitting(false);

    if (!result.ok) {
      setLocalError('Không kết nối được — kiểm tra lại link livestream.');
      return false;
    }

    if (onConnected) onConnected(targetUrl.trim());
    return true;
  }

  async function handleConnect(e) {
    e.preventDefault();
    await doConnect(url);
  }

  async function handleReconnect() {
    const target = connectedUrl || url || lastSessionUrl;
    if (!target) {
      setLocalError('Chưa có URL để kết nối lại — nhập link livestream.');
      return;
    }
    setUrl(target);
    await doConnect(target);
  }

  async function handleDisconnect() {
    setSubmitting(true);
    await api.disconnect();
    setSubmitting(false);
    setConnectedUrl('');
  }

  const displayError = formatStatusError(status, localError);
  const staleHint =
    status.status === 'stale'
      ? 'Livestream có thể đã kết thúc hoặc chat tạm dừng — thử Ngắt kết nối rồi Kết nối lại.'
      : null;

  return (
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-inkMuted shrink-0">Kết nối</span>

        <form onSubmit={handleConnect} className="flex items-center gap-2 flex-wrap min-w-0">
          {isConnected && connectedUrl ? (
            <span
              className="text-xs font-mono text-inkMuted truncate max-w-[220px]"
              title={connectedUrl}
            >
              {connectedUrl}
            </span>
          ) : (
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Dán link youtube.com/watch?v=... hoặc /live/..."
              disabled={isConnecting}
              className="w-64 rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-xs font-mono
                         placeholder:text-inkMuted/60 focus:outline-none focus:ring-2 focus:ring-focusAccent
                         disabled:opacity-50"
            />
          )}

          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={submitting}
              className="shrink-0 rounded-lg bg-panelAlt border border-line hover:border-live/60 hover:text-live
                         text-xs font-medium px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              Ngắt kết nối
            </button>
          ) : (
            <>
              <button
                type="submit"
                disabled={submitting || !url.trim() || isConnecting}
                className="shrink-0 rounded-lg bg-focusAccent hover:bg-focusAccent/90 text-white text-xs font-semibold
                           px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {isConnecting ? 'Đang kết nối…' : 'Kết nối'}
              </button>
              {canReconnect && (connectedUrl || url || lastSessionUrl) && (
                <button
                  type="button"
                  onClick={handleReconnect}
                  disabled={submitting || isConnecting}
                  className="shrink-0 rounded-lg border border-line bg-panelAlt hover:border-focusAccent/50
                             text-xs font-medium px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  Kết nối lại
                </button>
              )}
            </>
          )}
        </form>

        {(displayError || staleHint) && (
          <span className={`text-[11px] leading-snug ${displayError ? 'text-live' : 'text-stale'}`}>
            {displayError || staleHint}
          </span>
        )}
      </div>
  );
}
