import { useEffect, useRef, useState } from 'react';

const ANCHOR_OPTIONS = [
  { value: 'bubble', label: 'Khung chat (bubble)' },
  { value: 'message', label: 'Chỉ vùng chữ' },
  { value: 'author', label: 'Tên người gửi' },
  { value: 'row', label: 'Toàn dòng chat' },
  { value: 'body', label: 'Thân tin nhắn (tên + chữ)' },
  { value: 'avatar', label: 'Avatar' },
];

const PLACEMENT_OPTIONS = [
  { value: 'bottom-left', label: 'Cuối bên trái bubble' },
  { value: 'bottom-right', label: 'Cuối bên phải bubble' },
  { value: 'top-left', label: 'Đầu bên trái bubble' },
  { value: 'top-right', label: 'Đầu bên phải bubble' },
  { value: 'bottom-center', label: 'Cuối giữa bubble' },
  { value: 'top-center', label: 'Đầu giữa bubble' },
  { value: 'center-left', label: 'Giữa bên trái' },
  { value: 'center-right', label: 'Giữa bên phải' },
  { value: 'center', label: 'Giữa bubble' },
  { value: 'custom', label: 'Tùy chỉnh (X/Y tự do)' },
];

const inputClass =
  'w-full rounded-lg bg-panelAlt border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-focusAccent';

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-inkMuted">{label}</span>
      {children}
    </label>
  );
}

function createLayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `deco-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createDefaultLayer() {
  return {
    id: createLayerId(),
    enabled: true,
    imageUrl: '',
    anchor: 'bubble',
    placement: 'bottom-left',
    translateX: -6,
    translateY: 6,
    rotate: 0,
    zIndex: 5,
    width: 48,
    height: 48,
    opacity: 1,
  };
}

function LayerCard({ layer, index, onChange, onRemove }) {
  const set = (patch) => onChange(index, { ...layer, ...patch });

  return (
    <div className="rounded-xl border border-line bg-panelAlt/40 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-inkMuted">Lớp {index + 1}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-inkMuted cursor-pointer">
            <input
              type="checkbox"
              checked={layer.enabled !== false}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="rounded"
            />
            Bật
          </label>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-xs text-live hover:underline"
          >
            Xóa
          </button>
        </div>
      </div>

      <Field label="URL ảnh">
        <input
          type="url"
          className={inputClass}
          placeholder="https://i.ibb.co/..."
          value={layer.imageUrl || ''}
          onChange={(e) => set({ imageUrl: e.target.value.trim() })}
        />
      </Field>

      {layer.imageUrl ? (
        <div className="rounded-lg border border-line bg-panel p-2 flex justify-center min-h-[56px]">
          <img
            src={layer.imageUrl}
            alt=""
            className="max-h-14 max-w-full object-contain"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            onLoad={(e) => {
              e.currentTarget.style.display = '';
            }}
          />
        </div>
      ) : null}

      <Field label="Gắn vào">
        <select
          className={inputClass}
          value={layer.anchor || 'bubble'}
          onChange={(e) => set({ anchor: e.target.value })}
        >
          {ANCHOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Vị trí trên khung">
        <select
          className={inputClass}
          value={layer.placement || 'bottom-left'}
          onChange={(e) => set({ placement: e.target.value })}
        >
          {PLACEMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Tinh chỉnh X — ${layer.translateX ?? 0}px`}>
        <input
          type="range"
          min={-120}
          max={120}
          step={1}
          value={layer.translateX ?? 0}
          onChange={(e) => set({ translateX: Number(e.target.value) })}
          className="w-full accent-focusAccent"
        />
      </Field>

      <Field label={`Tinh chỉnh Y — ${layer.translateY ?? 0}px`}>
        <input
          type="range"
          min={-120}
          max={120}
          step={1}
          value={layer.translateY ?? 0}
          onChange={(e) => set({ translateY: Number(e.target.value) })}
          className="w-full accent-focusAccent"
        />
      </Field>

      <Field label={`Góc xoay — ${layer.rotate ?? 0}°`}>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={layer.rotate ?? 0}
          onChange={(e) => set({ rotate: Number(e.target.value) })}
          className="w-full accent-focusAccent"
        />
      </Field>

      <Field label={`z-index — ${layer.zIndex ?? 2}`}>
        <input
          type="range"
          min={-10}
          max={100}
          step={1}
          value={layer.zIndex ?? 2}
          onChange={(e) => set({ zIndex: Number(e.target.value) })}
          className="w-full accent-focusAccent"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Rộng — ${layer.width ?? 48}px`}>
          <input
            type="range"
            min={16}
            max={200}
            step={1}
            value={layer.width ?? 48}
            onChange={(e) => set({ width: Number(e.target.value) })}
            className="w-full accent-focusAccent"
          />
        </Field>
        <Field label={`Cao — ${layer.height ?? 48}px`}>
          <input
            type="range"
            min={16}
            max={200}
            step={1}
            value={layer.height ?? 48}
            onChange={(e) => set({ height: Number(e.target.value) })}
            className="w-full accent-focusAccent"
          />
        </Field>
      </div>

      <Field label={`Độ mờ — ${Math.round((layer.opacity ?? 1) * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={layer.opacity ?? 1}
          onChange={(e) => set({ opacity: Number(e.target.value) })}
          className="w-full accent-focusAccent"
        />
      </Field>
    </div>
  );
}

export default function DecorationsPanel({ api, decorationConfig }) {
  const [local, setLocal] = useState(decorationConfig || { layers: [] });
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocal(decorationConfig || { layers: [] });
  }, [decorationConfig]);

  function pushUpdate(nextLayers) {
    setLocal({ layers: nextLayers });
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.updateDecorationConfig({ layers: nextLayers });
    }, 100);
  }

  function handleLayerChange(index, nextLayer) {
    const layers = [...(local.layers || [])];
    layers[index] = nextLayer;
    pushUpdate(layers);
  }

  function handleAddLayer() {
    pushUpdate([...(local.layers || []), createDefaultLayer()]);
  }

  function handleRemoveLayer(index) {
    const layers = (local.layers || []).filter((_, i) => i !== index);
    pushUpdate(layers);
  }

  const layers = local.layers || [];

  return (
    <section className="rounded-xl border border-line bg-panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Trang trí ảnh</h2>
        <button
          type="button"
          onClick={handleAddLayer}
          className="text-xs font-semibold text-focusAccent hover:text-focusAccent/80"
        >
          + Thêm lớp
        </button>
      </div>

      <p className="text-xs text-inkMuted leading-relaxed">
        Sticker bám theo từng tin nhắn chat. Chọn &quot;Khung chat&quot; + vị trí góc (vd. cuối trái) rồi tinh chỉnh X/Y.
      </p>

      {layers.length === 0 ? (
        <p className="text-xs text-inkMuted italic py-2">Chưa có lớp trang trí. Nhấn &quot;+ Thêm lớp&quot; để bắt đầu.</p>
      ) : (
        <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
          {layers.map((layer, index) => (
            <LayerCard
              key={layer.id || index}
              layer={layer}
              index={index}
              onChange={handleLayerChange}
              onRemove={handleRemoveLayer}
            />
          ))}
        </div>
      )}
    </section>
  );
}
