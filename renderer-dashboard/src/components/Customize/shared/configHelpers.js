// These helpers operate on the *overlay data* (customizeConfig / slotStyleConfig),
// which is intentionally kept separate from Inspector-only UI state
// (selected object, expanded sections, search, favorites — see useCustomizeState.js).

export function mergeSlot(local, slot, patch) {
  return {
    ...local,
    slots: {
      ...local.slots,
      [slot]: { ...(local.slots?.[slot] || {}), ...patch },
    },
  };
}

export function slotVal(slotStyle, slot, key, fallback) {
  const v = slotStyle?.slots?.[slot]?.[key];
  return v !== undefined && v !== null ? v : fallback;
}

export function configVal(config, key, fallback) {
  const v = config?.[key];
  return v !== undefined && v !== null ? v : fallback;
}

export function isUserSet(config, key) {
  const v = config?.[key];
  return v !== undefined && v !== null;
}

export function slotBubbleVal(slotLocal, slot, key, globalConfig, fallback) {
  const slotValRaw = slotLocal?.slots?.[slot]?.[key];
  if (slotValRaw !== undefined && slotValRaw !== null) return slotValRaw;
  const globalVal = globalConfig?.[key];
  if (globalVal !== undefined && globalVal !== null) return globalVal;
  return fallback;
}

export function isSlotBubbleUserSet(slotLocal, slot, key) {
  const v = slotLocal?.slots?.[slot]?.[key];
  return v !== undefined && v !== null;
}

/** Maps BubbleSizeSection UI patch keys to customizeConfig / slot bubble keys. */
export function bubbleSizeConfigPatch(patch) {
  return {
    ...(patch.minWidth !== undefined ? { bubbleMinWidth: patch.minWidth } : {}),
    ...(patch.maxWidth !== undefined ? { bubbleMaxWidth: patch.maxWidth } : {}),
    ...(patch.fixedWidth !== undefined ? { bubbleFixedWidth: patch.fixedWidth } : {}),
    ...(patch.minHeight !== undefined ? { bubbleMinHeight: patch.minHeight } : {}),
    ...(patch.maxHeight !== undefined ? { bubbleMaxHeight: patch.maxHeight } : {}),
    ...(patch.fixedHeight !== undefined ? { bubbleFixedHeight: patch.fixedHeight } : {}),
  };
}
