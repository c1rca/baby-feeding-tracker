import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

// The stylesheet ships as ordered sections joined by src/styles/index.ts; this
// reads them the same way so the assertions still see the whole cascade.
const stylesDir = new URL('../src/styles/', import.meta.url)
const sections = (await readdir(stylesDir)).filter((name) => name.endsWith('.css')).sort()
const css = (await Promise.all(sections.map((name) => readFile(new URL(name, stylesDir), 'utf8')))).join('\n')
const rule = (selector) => {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'))
  assert.ok(match, `Missing ${selector} CSS rule`)
  return match[1]
}

test('global toast stays compact and readable over an open modal', () => {
  const toast = rule('.toast')
  const modalBackdrop = rule('.modal-backdrop')
  const toastZIndex = Number(toast.match(/z-index:\s*(\d+)/)?.[1])
  const modalZIndex = Number(modalBackdrop.match(/z-index:\s*(\d+)/)?.[1])

  assert.match(toast, /position:\s*fixed/)
  assert.match(toast, /width:\s*fit-content/)
  assert.match(toast, /max-width:\s*min\(calc\(100vw - 28px\),\s*420px\)/)
  assert.ok(toastZIndex > modalZIndex, 'toast must render above the modal backdrop instead of behind its blur')
})
