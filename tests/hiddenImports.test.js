import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// A file that imports a name and then declares the same name again (a state
// variable, a const) hides the import. Both are valid code, so the build
// passes and the page crashes when it runs: on 14 November 2026 the inbox
// crashed on every conversation with a quote in it because state called
// `quoteDeposit` hid the `quoteDeposit()` helper, and the "No messages yet"
// box declared `profileUrl` while calling `profileUrl()`.
//
// This finds the forms that bite: `const name =`, `let name =`,
// `const [name, ...] = useState`, and `function name(`, anywhere in a file
// that imports `name`.
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

function importedNames(src) {
  const names = new Set()
  for (const m of src.matchAll(/^import\s+([^'"]*?)\s+from\s+['"][^'"]+['"]/gm)) {
    const clause = m[1]
    const braces = clause.match(/\{([\s\S]*)\}/)
    const outside = clause.replace(/\{[\s\S]*\}/, '').replace(/\*\s+as\s+(\w+)/, '$1')
    for (const part of outside.split(',')) if (part.trim()) names.add(part.trim())
    if (braces) for (const part of braces[1].split(',')) {
      const local = part.trim().split(/\s+as\s+/).pop()
      if (local) names.add(local)
    }
  }
  return names
}

test('no file declares a name it also imports', () => {
  const problems = []
  for (const file of ['app', 'components', 'lib'].flatMap(d => sourceFiles(path.join(root, d)))) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const name of importedNames(src)) {
      const n = name.replace(/\$/g, '\\$')
      const re = new RegExp(String.raw`\b(?:const|let|var)\s+${n}\s*=|\b(?:const|let|var)\s*\[\s*${n}\s*[,\]]|\bfunction\s+${n}\s*\(`)
      const m = src.match(re)
      if (m) problems.push(`${path.relative(root, file)}:${src.slice(0, m.index).split('\n').length} redeclares "${name}"`)
    }
  }
  assert.deepEqual(problems, [])
})
