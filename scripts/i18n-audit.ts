import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { interfaceLiterals } from './i18nAudit.ts'
import ts from 'typescript'
import { en } from '../src/i18n/en/index.ts'
import { LANGUAGES } from '../src/i18n/registry.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allowlistPath = path.join(root, 'src/i18n/interface-literals.json')
const allowed: Record<string, string> = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
const files = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(directory, entry.name)] : [])
const literals = files(path.join(root, 'src')).flatMap(file => interfaceLiterals(path.relative(root, file), fs.readFileSync(file, 'utf8')))
const missing = literals.filter(entry => !allowed[entry.id]?.trim())
for (const entry of missing) console.error(`Untranslated interface text: ${entry.id} (line ${entry.line})`)
for (const entry of Object.keys(allowed)) if (!literals.some(literal => literal.id === entry)) console.warn(`Remove unused interface-text exception: ${entry}`)
console.log(`Interface literal audit: ${missing.length} unapproved; ${literals.length - missing.length} documented exceptions.`)
// Candidate report only: dynamic key families can make a static scan incomplete.
const sourceFiles = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? path.basename(directory) === 'i18n' && [...LANGUAGES, 'reviewed'].includes(entry.name) ? [] : sourceFiles(path.join(directory, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(directory, entry.name)] : [])
const references = new Set<string>()
const prefixes = new Set<string>()
for (const file of sourceFiles(path.join(root, 'src'))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) references.add(node.text)
    if (ts.isTemplateExpression(node) && /^[a-z]+\./.test(node.head.text)) prefixes.add(node.head.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
}
const candidates = Object.keys(en).filter(key => !references.has(key) && ![...prefixes].some(prefix => key.startsWith(prefix)))
if (candidates.length) console.warn(`Potential unused tokens (review dynamic mappings before removing):\n${candidates.join('\n')}`)
if (missing.length) process.exitCode = 1
