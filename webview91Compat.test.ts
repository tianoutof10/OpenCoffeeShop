import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Android System WebView 91 (e.g. on the Teclast P85 Pro that ships with the DE1 tablet) does not
// resolve `dvh` at all when the CSS is minified without a browser target: Lightning CSS drops the
// `vh` fallback it would otherwise keep, so every full-viewport container collapses to zero height
// (no scrolling in the profile library / Insights, see upstream issue #78).
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

test('the production build targets a CSS baseline old enough to keep vh fallbacks', () => {
  assert.match(viteConfig, /cssTarget:\s*['"]chrome91['"]/)
})

const cssFiles = [
  '../src/styles/index.css',
  '../src/features/insights/insights.css',
  '../src/features/profiles/profileLibrary.css',
  '../src/features/profiles/profileDeletion.css',
] as const

test('every dvh length in the touched stylesheets has a matching vh fallback declared first', () => {
  let totalDvh = 0
  for (const path of cssFiles) {
    const css = readFileSync(new URL(path, import.meta.url), 'utf8')
    const dvhMatches = [...css.matchAll(/(\d+)dvh/g)]
    assert.ok(dvhMatches.length > 0, `${path}: expected at least one dvh usage to guard`)
    for (const match of dvhMatches) {
      const value = match[1]
      const start = Math.max(0, (match.index ?? 0) - 80)
      const before = css.slice(start, match.index)
      assert.match(before, new RegExp(`${value}vh(?!\\w)[^{}]*$`), `${path}: ${value}dvh is missing its ${value}vh fallback`)
    }
    totalDvh += dvhMatches.length
  }
  assert.ok(totalDvh >= 20, 'expected the known set of full-viewport containers to still be guarded')
})
