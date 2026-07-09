import { Field, inputClass, EnableToggle } from '../shared/fields.jsx';
import { SHADOW_PRESETS } from '../shared/constants.js';

export default function ShadowSection({ value, onChange, allowCustomCss = false }) {
  const enabled = !!value && value !== 'none';
  const matchedPreset = SHADOW_PRESETS.find((p) => p.value === value);

  return (
    <>
      <div className="col-span-2">
        <EnableToggle
          label="Bật shadow"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? SHADOW_PRESETS[1].value : 'none')}
        />
      </div>

      {enabled && (
        <>
          <Field label="Preset">
            <select
              className={inputClass}
              value={matchedPreset?.id || 'custom'}
              onChange={(e) => {
                const preset = SHADOW_PRESETS.find((p) => p.id === e.target.value);
                if (preset) onChange(preset.value);
              }}
            >
              {SHADOW_PRESETS.filter((p) => p.id !== 'none').map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Tuỳ chỉnh</option>
            </select>
          </Field>
          {allowCustomCss && (
            <Field label="Shadow tuỳ chỉnh (CSS)">
              <input
                type="text"
                className={inputClass}
                placeholder="0 4px 14px rgba(0,0,0,0.25)"
                value={value === 'none' ? '' : value || ''}
                onChange={(e) => onChange(e.target.value || 'none')}
              />
            </Field>
          )}
        </>
      )}
    </>
  );
}
