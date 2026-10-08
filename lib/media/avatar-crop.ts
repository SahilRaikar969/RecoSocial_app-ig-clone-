export function avatarCropGeometry(width: number, height: number, zoom: number, x: number, y: number, output = 512) {
  if (![width, height, zoom, x, y, output].every(Number.isFinite) || width <= 0 || height <= 0 || output <= 0) throw new Error('Invalid image dimensions')
  const scale = Math.max(output / width, output / height) * Math.max(1, zoom)
  const drawWidth = width * scale
  const drawHeight = height * scale
  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
  return {
    x: (output - drawWidth) / 2 + clamp(x / 100 * output, (drawWidth - output) / 2),
    y: (output - drawHeight) / 2 + clamp(y / 100 * output, (drawHeight - output) / 2),
    width: drawWidth, height: drawHeight,
  }
}
