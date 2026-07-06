const STATUS_MAP = {
  idle: { label: 'Chưa kết nối', color: 'bg-inkMuted' },
  connecting: { label: 'Đang kết nối…', color: 'bg-stale' },
  connected: { label: 'Đang live', color: 'bg-connected' },
  stale: { label: 'Không thấy tin nhắn mới', color: 'bg-stale' },
  error: { label: 'Lỗi kết nối', color: 'bg-live' },
};

export default function StatusBadge({ status }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.idle;
  const isLive = status === 'connected';

  return (
    <div className="flex items-center gap-2">
      <span className={`ovs-signal-dot ${meta.color} ${isLive ? 'is-live' : ''}`} />
      <span className="text-sm font-medium text-inkMuted">{meta.label}</span>
    </div>
  );
}
