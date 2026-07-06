/**
 * Ensures slice insets never overlap — required for valid 9-patch rendering.
 */
function clampSlicesToImage(slice, imageSize) {
  if (!imageSize?.width || !imageSize?.height) return { ...slice };

  const maxW = Math.max(2, imageSize.width - 1);
  const maxH = Math.max(2, imageSize.height - 1);

  let top = slice.top;
  let right = slice.right;
  let bottom = slice.bottom;
  let left = slice.left;

  if (top + bottom > maxH) {
    const f = maxH / (top + bottom);
    top = Math.max(0, Math.floor(top * f));
    bottom = Math.max(0, Math.floor(bottom * f));
  }
  if (left + right > maxW) {
    const f = maxW / (left + right);
    left = Math.max(0, Math.floor(left * f));
    right = Math.max(0, Math.floor(right * f));
  }

  top = Math.min(top, maxH - bottom);
  bottom = Math.min(bottom, maxH - top);
  left = Math.min(left, maxW - right);
  right = Math.min(right, maxW - left);

  return { top, right, bottom, left };
}

module.exports = { clampSlicesToImage };
