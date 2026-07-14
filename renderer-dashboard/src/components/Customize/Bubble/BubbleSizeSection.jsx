function formatValue(value, kind) {
  if (kind === 'min') return `${value}px`;
  if (kind === 'max') return value > 0 ? `${value}px` : 'Không giới hạn';
  return value > 0 ? `${value}px` : 'Tự động';
}

function SizeCell({ value, kind, max, onChange }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] text-inkMuted text-center tabular-nums truncate" title={formatValue(value, kind)}>
        {formatValue(value, kind)}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function SizeRow({ label, values, kinds, max, onChange }) {
  return (
    <>
      <span className="text-xs text-inkMuted self-center">{label}</span>
      {kinds.map((kind, i) => (
        <SizeCell
          key={`${label}-${kind}`}
          value={values[i]}
          kind={kind}
          max={max}
          onChange={(v) => onChange(kind, v)}
        />
      ))}
    </>
  );
}

export default function BubbleSizeSection({
  minWidth = 0,
  maxWidth = 0,
  fixedWidth = 0,
  minHeight = 0,
  maxHeight = 0,
  fixedHeight = 0,
  onChange,
}) {
  const hasCustom =
    minWidth > 0 ||
    maxWidth > 0 ||
    fixedWidth > 0 ||
    minHeight > 0 ||
    maxHeight > 0 ||
    fixedHeight > 0;

  const handleReset = () =>
    onChange({
      minWidth: 0,
      maxWidth: 0,
      fixedWidth: 0,
      minHeight: 0,
      maxHeight: 0,
      fixedHeight: 0,
    });

  const patchWidth = (kind, value) => {
    if (kind === 'min') onChange({ minWidth: value });
    else if (kind === 'max') onChange({ maxWidth: value });
    else onChange({ fixedWidth: value });
  };

  const patchHeight = (kind, value) => {
    if (kind === 'min') onChange({ minHeight: value });
    else if (kind === 'max') onChange({ maxHeight: value });
    else onChange({ fixedHeight: value });
  };

  return (
    <div className="col-span-2 rounded-lg border border-line bg-panelAlt/30 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-medium">Kích thước bubble</span>
          <p className="text-[10px] text-inkMuted mt-0.5">0 = tự động hoặc không giới hạn</p>
        </div>
        {hasCustom && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-inkMuted hover:text-ink underline shrink-0"
          >
            Đặt lại
          </button>
        )}
      </div>

      <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-x-2 gap-y-1 items-start">
        <span />
        <span className="text-[10px] uppercase tracking-wide text-inkMuted text-center">Tối thiểu</span>
        <span className="text-[10px] uppercase tracking-wide text-inkMuted text-center">Tối đa</span>
        <span className="text-[10px] uppercase tracking-wide text-inkMuted text-center">Cố định</span>

        <SizeRow
          label="Rộng"
          values={[minWidth, maxWidth, fixedWidth]}
          kinds={['min', 'max', 'fixed']}
          max={640}
          onChange={patchWidth}
        />
        <SizeRow
          label="Cao"
          values={[minHeight, maxHeight, fixedHeight]}
          kinds={['min', 'max', 'fixed']}
          max={480}
          onChange={patchHeight}
        />
      </div>
    </div>
  );
}
