import { useState } from 'react';
import { useEditorState } from '../state/EditorStateContext.jsx';
import { applyPaletteLock } from '../../../shared/palette-lock.js';

export default function PaletteLockPanel() {
  const {
    local,
    roleLocal,
    fanServiceLocal,
    pushConfigUpdate,
    pushRoleUpdate,
    pushFanServiceUpdate,
    getPreLockBaseline,
    paletteLockColors: colors,
    setPaletteLockColors: setColors,
  } = useEditorState();

  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  function handleColorChange(index, rawHex) {
    let nextHex = (rawHex || '').trim();
    if (nextHex && !nextHex.startsWith('#')) {
      nextHex = `#${nextHex}`;
    }
    const next = [...colors];
    next[index] = nextHex.toUpperCase();
    setColors(next);
  }

  function handleAddColor() {
    if (colors.length >= 5) return;
    setColors([...colors, '#888888']);
  }

  function handleRemoveColor(index) {
    if (colors.length <= 2) return;
    setColors(colors.filter((_, i) => i !== index));
  }

  function handleApplyLock() {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const bundle = {
        customizeConfig: local || {},
        roleStyleConfig: roleLocal || {},
        fanServiceConfig: fanServiceLocal || {},
      };

      const baselineBundle = getPreLockBaseline();

      const result = applyPaletteLock(bundle, colors, { baselineBundle });

      // 1. Push customizeConfig update
      pushConfigUpdate(result.customizeConfig);

      // 2. Push roleStyleConfig updates for each role
      if (result.roleStyleConfig?.roles) {
        if (result.roleStyleConfig.roles.moderator) {
          pushRoleUpdate('moderator', result.roleStyleConfig.roles.moderator);
        }
        if (result.roleStyleConfig.roles.member) {
          pushRoleUpdate('member', result.roleStyleConfig.roles.member);
        }
      }

      // 3. Push fanServiceConfig updates for each group
      if (result.fanServiceConfig) {
        if (result.fanServiceConfig.superchat) {
          pushFanServiceUpdate('superchat', result.fanServiceConfig.superchat);
        }
        if (result.fanServiceConfig.membership) {
          pushFanServiceUpdate('membership', result.fanServiceConfig.membership);
        }
      }

      setSuccessMessage('Đã áp dụng bảng màu thành công cho toàn bộ giao diện!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi khi áp dụng bảng màu');
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 bg-panel border border-line rounded-xl shadow-panel">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
          <span>🔒</span> Khoá Bảng Màu (Palette Lock)
        </h2>
        <p className="text-xs text-inkMuted mt-1 leading-relaxed">
          Nhập từ 2–5 màu hex. Khi áp dụng, toàn bộ nền/viền/glow sẽ được ép về các màu trong palette (mỗi loại tin nhắn Mod/Hội viên/Super Chat/Gia hạn nhận màu riêng),
          và các màu chữ sẽ được tự động tính độ tương phản WCAG để đảm bảo cực kỳ dễ đọc.
        </p>
      </div>

      {/* Color inputs list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-inkMuted uppercase tracking-wider">
            Danh sách mã màu ({colors.length}/5)
          </label>
        </div>

        <div className="flex flex-col gap-2.5">
          {colors.map((color, index) => {
            const isMain = index === 0;
            return (
              <div
                key={index}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  isMain
                    ? 'border-focusAccent/40 bg-focusAccent/5'
                    : 'border-line bg-panelAlt'
                }`}
              >
                {/* Color Picker Swatch */}
                <input
                  type="color"
                  value={color.startsWith('#') && color.length === 7 ? color : '#000000'}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="w-8 h-8 rounded-md border border-line bg-transparent cursor-pointer shrink-0"
                />

                {/* Hex Input */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData('text').trim();
                      if (text) {
                        e.preventDefault();
                        handleColorChange(index, text);
                      }
                    }}
                    placeholder="#RRGGBB"
                    maxLength={7}
                    className="w-28 rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-mono
                               text-ink focus:outline-none focus:ring-2 focus:ring-focusAccent uppercase"
                  />
                  {index === 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-focusAccent/20 text-focusAccent shrink-0">
                      Màu chính 1 (Nền bubble chung)
                    </span>
                  )}
                  {index === 1 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 shrink-0">
                      Màu chính 2 (Nền bubble Hội viên)
                    </span>
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveColor(index)}
                  disabled={colors.length <= 2}
                  className="p-1 rounded text-inkMuted hover:text-live hover:bg-live/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={colors.length <= 2 ? 'Yêu cầu tối thiểu 2 màu' : 'Xoá màu'}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-2.5 rounded-lg bg-live/10 border border-live/30 text-live text-xs font-medium">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          {successMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5 mt-1">
        {/* Large Add Color Button */}
        <button
          type="button"
          onClick={handleAddColor}
          disabled={colors.length >= 5}
          className="w-full py-2.5 rounded-lg border border-focusAccent/40 bg-focusAccent/10
                     hover:bg-focusAccent/20 text-focusAccent font-semibold text-xs transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Thêm màu mới ({colors.length}/5)</span>
        </button>

        {/* Apply Button */}
        <button
          type="button"
          onClick={handleApplyLock}
          className="w-full py-2.5 rounded-lg bg-focusAccent hover:bg-focusAccent/90 text-white font-semibold text-xs shadow-md transition-colors"
        >
          Áp dụng Bảng màu (Palette Lock)
        </button>
      </div>
    </div>
  );
}
