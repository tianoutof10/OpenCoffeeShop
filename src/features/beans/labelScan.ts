/**
 * Bag-label OCR, run locally with the bundled Tesseract engine (public/ocr).
 * Follows docs/bean-label-ocr.md: still image from the camera picker → orient →
 * resize → contrast → OCR. The result is raw text for parseBeanText(), which the
 * barista always reviews before saving.
 */
const MAX_EDGE_PX = 1_800

async function prepareImage(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => createImageBitmap(file))
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('canvas unavailable')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  // Greyscale and stretch contrast: printed labels on kraft paper or foil read far better.
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  let min = 255, max = 0
  for (let index = 0; index < data.length; index += 4) {
    const grey = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
    data[index] = grey
    if (grey < min) min = grey
    if (grey > max) max = grey
  }
  const range = Math.max(1, max - min)
  for (let index = 0; index < data.length; index += 4) {
    const stretched = (data[index] - min) * 255 / range
    data[index] = data[index + 1] = data[index + 2] = stretched
  }
  context.putImageData(image, 0, 0)
  return canvas
}

export interface LabelScanHandle { promise: Promise<string>; cancel: () => void }

export function scanLabel(file: Blob, onProgress: (fraction: number) => void): LabelScanHandle {
  let cancelled = false
  let terminate: (() => Promise<unknown>) | undefined
  const promise = (async () => {
    const canvas = await prepareImage(file)
    const { createWorker } = await import('tesseract.js')
    const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href
    const worker = await createWorker('eng', 1, {
      workerPath: `${base}worker.min.js`, corePath: base, langPath: base, gzip: true, workerBlobURL: false,
      logger: (message: { status: string; progress: number }) => { if (message.status === 'recognizing text') onProgress(message.progress) },
    })
    terminate = () => worker.terminate()
    if (cancelled) { await worker.terminate(); throw new Error('cancelled') }
    try {
      const { data } = await worker.recognize(canvas)
      return data.text
    } finally {
      await worker.terminate()
    }
  })()
  return { promise, cancel: () => { cancelled = true; void terminate?.() } }
}
