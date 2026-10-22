/**
 * The longest edge the model's API takes as is: a bigger picture is downsized
 * there, and a point the model picks on it would be off by the same factor.
 */
export const MAX_EDGE = 1568;

export interface Badged {
  dataUrl: string;
  /** Picture px per CSS px: 1 unless the viewport's longer edge is over MAX_EDGE. */
  scale: number;
}

/**
 * Draws each listed element's number onto the capture, where the page would
 * have shown it, so nothing has to be added to the page itself, and returns the
 * one JPEG the model gets — at CSS size, so a point on it is a point of the
 * viewport. The capture is in device pixels; `viewportWidth` (CSS px) gives
 * its scale.
 */
export async function drawBadges(
  dataUrl: string,
  marks: Array<{ n: number; x: number; y: number }>,
  viewportWidth: number,
): Promise<Badged> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const cssHeight = bitmap.height / (bitmap.width / viewportWidth);
  const scale = Math.min(1, MAX_EDGE / Math.max(viewportWidth, cssHeight));
  const width = Math.round(viewportWidth * scale);
  const height = Math.round(cssHeight * scale);
  const canvas = new OffscreenCanvas(width, height);
  const c = canvas.getContext('2d');
  if (!c) throw new Error('No 2d canvas in the worker.');
  c.drawImage(bitmap, 0, 0, width, height);
  c.font = `bold ${11 * scale}px sans-serif`;
  c.textBaseline = 'top';
  for (const { n, x, y } of marks) {
    const label = String(n);
    const left = Math.max(0, x) * scale;
    const top = Math.max(0, y - 14) * scale;
    c.fillStyle = '#111';
    c.fillRect(left, top, c.measureText(label).width + 6 * scale, 14 * scale);
    c.fillStyle = '#fff';
    c.fillText(label, left + 3 * scale, top + 1.5 * scale);
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { dataUrl: `data:image/jpeg;base64,${btoa(binary)}`, scale };
}
