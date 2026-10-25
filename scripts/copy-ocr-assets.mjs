// Copies the label-scan OCR engine into public/ocr so it ships inside the skin
// and works offline (docs/bean-label-ocr.md: no CDN). Runs before dev and build.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const target = join(root, 'public', 'ocr')
mkdirSync(target, { recursive: true })
const tesseract = dirname(require.resolve('tesseract.js/package.json'))
const core = dirname(require.resolve('tesseract.js-core/package.json'))
const language = dirname(require.resolve('@tesseract.js-data/eng/package.json'))
const files = [
  [join(tesseract, 'dist', 'worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map(name => [join(core, name), name]),
  // The compact integer model keeps the skin small while staying accurate on printed labels.
  [join(language, '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
]
for (const [from, name] of files) {
  if (!existsSync(from)) throw new Error(`OCR asset missing: ${from}`)
  copyFileSync(from, join(target, name))
}
console.log(`OCR assets ready in public/ocr (${files.length} files)`)
