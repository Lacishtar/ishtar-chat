import { useMemo, useState } from 'react';
import { useEditorState } from '../state/EditorStateContext.jsx';
import { applyPaletteLock, hasLowAlphaBubble } from '../../../shared/palette-lock.js';

const LOW_ALPHA_WARNING =
  'Theme hiện tại quá trong suốt để đảm bảo độ tương phản trên mọi nền.';

export default function PaletteLockPanel() {
  const {
    local,
    slotLocal,
    roleLocal,
    fanServiceLocal,
    layoutLocal,
    pushConfigUpdate,
    pushSlotStyleFull,
    pushRoleUpdate,
    pushFanServiceUpdate,
    getPreLockBaseline,
    paletteLockColors: colors,
    setPaletteLockColors: setColors,
  } = useEditorState();

  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Live bundle mirrors the exact shape applyPaletteLock() / getPreLockBaseline()
  // work with, so the transparency check reflects whatever the lock would
  // actually touch right now.
  const liveBundle = useMemo(
    () => ({
      customizeConfig: local || {},
      roleStyleConfig: roleLocal || {},
      fanServiceConfig: fanServiceLocal || {},
      slotStyleConfig: slotLocal || {},
      layoutConfig: layoutLocal || {},
    }),
    [local, roleLocal, fanServiceLocal, slotLocal, layoutLocal],
  );

  const showLowAlphaWarning = useMemo(() => hasLowAlphaBubble(liveBundle), [liveBundle]);

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
      const bundle = liveBundle;
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

      // 4. Push slotStyleConfig update (slot bg/border colors — this also
      //    covers "Chia đôi bubble" header/body split colors now, since they
      //    read the same slots.author.bubbleBg / slots.message.bubbleBg;
      //    see shared/layout-config.js's compileLayoutToCssVariables).
      if (result.slotStyleConfig && pushSlotStyleFull) {
        pushSlotStyleFull(result.slotStyleConfig);
      }

      setSuccessMessage('Đã áp dụng!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi khi áp dụng');
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 bg-panel border border-line rounded-xl shadow-panel">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">🔒</span>
        <h2 className="flex-1 text-xs font-semibold text-ink">Khoá Bảng Màu</h2>
        {showLowAlphaWarning && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0"
            title="Bubble quá trong suốt"
          >
            ⚠
          </span>
        )}
      </div>

      {/* Low-alpha transparency warning */}
      {showLowAlphaWarning && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-medium leading-snug">
          ⚠ {LOW_ALPHA_WARNING}
        </div>
      )}

      {/* Color inputs list */}
      <div className="flex flex-col gap-1.5">
        {colors.map((color, index) => {
          const isMain = index === 0;
          const isSecondary = index === 1;
          return (
            <div
              key={index}
              className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                isMain
                  ? 'border-focusAccent/40 bg-focusAccent/5'
                  : 'border-line bg-panelAlt'
              }`}
            >
              <input
                type="color"
                value={color.startsWith('#') && color.length === 7 ? color : '#000000'}
                onChange={(e) => handleColorChange(index, e.target.value)}
                title={isMain ? 'Màu nền chung' : isSecondary ? 'Màu nền hội viên' : 'Màu bổ sung'}
                className="w-6 h-6 rounded border border-line bg-transparent cursor-pointer shrink-0"
              />

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
                className="flex-1 min-w-0 rounded-md border border-line bg-panel px-2 py-1 text-[11px] font-mono
                           text-ink focus:outline-none focus:ring-2 focus:ring-focusAccent uppercase"
              />

              <button
                type="button"
                onClick={() => handleRemoveColor(index)}
                disabled={colors.length <= 2}
                className="p-1 rounded text-inkMuted hover:text-live hover:bg-live/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                title="Xoá"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-2 rounded-lg bg-live/10 border border-live/30 text-live text-[11px] font-medium">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
          {successMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAddColor}
          disabled={colors.length >= 5}
          title="Thêm màu"
          className="rounded-lg border border-focusAccent/40 bg-focusAccent/10
                     hover:bg-focusAccent/20 text-focusAccent font-semibold text-xs transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 shrink-0"
        >
          + ({colors.length}/5)
        </button>

        <button
          type="button"
          onClick={handleApplyLock}
          className="flex-1 rounded-lg bg-focusAccent hover:bg-focusAccent/90 text-white font-semibold text-xs shadow-md transition-colors py-2"
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}
