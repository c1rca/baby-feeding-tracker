import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
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
