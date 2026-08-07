// Client-side image downscaling. Phone-camera photos are multi-megabyte;
// we cap the longest edge and re-encode as JPEG before shipping bytes
// anywhere. Two encodings of the same pipeline:
//   - downscaleImage  → base64 (parse-receipt edge function payload)
//   - downscaleToBlob → Blob   (crew-media storage uploads)

const MAX_EDGE = 1500
const JPEG_QUALITY = 0.8

export interface DownscaledImage {
  /** Base64 payload with no `data:` prefix. */
  base64: string
  mime: string
}

export async function downscaleImage(file: File): Promise<DownscaledImage> {
  const canvas = await drawScaled(file)
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = dataUrl.split(',')[1] ?? ''
  if (!base64) throw new Error('Could not encode the image')
  return { base64, mime: 'image/jpeg' }
}

export async function downscaleToBlob(file: File): Promise<Blob> {
  const canvas = await drawScaled(file)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Could not encode the image')
  return blob
}

async function drawScaled(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await loadImage(file)
  const srcW = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const srcH = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a 2D canvas context')
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas
}

async function loadImage(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not read the image'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}
