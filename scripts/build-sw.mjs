/**
 * Inject the built bundle into the service worker's precache list.
 *
 * The worker registers on `load`, which is *after* the page has already fetched
 * its scripts and styles — so those never pass through the worker and never
 * enter its runtime cache. A first visit therefore precaches the static shell
 * only, and a household that opens the app offline before it has ever navigated
 * a second time gets a blank page: the cached `index.html` comes back, asks for
 * a bundle nothing has, and stops there.
 *
 * The bundle's filenames carry a content hash, so the worker cannot name them
 * itself. This reads what the build actually emitted and writes it in.
 *
 * The build id is derived from those same filenames, which means the cache name
 * changes exactly when the assets change — no more remembering to bump it by
 * hand, and no more shipping a new bundle behind a cache name that says it is
 * the old one.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist')

const referencedAssets = (html) => {
  const found = new Set()
  // Anything the entry document pulls in by URL: module scripts, stylesheets,
  // and modulepreload hints (which are the chunks the entry will import).
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) found.add(match[1])
  return [...found].sort()
}

const run = async () => {
  const html = await readFile(join(DIST, 'index.html'), 'utf8')
  const assets = referencedAssets(html)

  const scripts = assets.filter((path) => path.endsWith('.js'))
  const styles = assets.filter((path) => path.endsWith('.css'))
  if (scripts.length === 0) {
    throw new Error('build-sw: dist/index.html references no /assets/*.js — refusing to ship a worker that cannot boot offline')
  }
  if (styles.length === 0) {
    throw new Error('build-sw: dist/index.html references no /assets/*.css — refusing to ship an unstyled offline shell')
  }

  const buildId = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12)
  const source = await readFile(join(DIST, 'sw.js'), 'utf8')

  const injected = source
    .replace(/^const BUILD_ASSETS = \[\]$/m, `const BUILD_ASSETS = ${JSON.stringify(assets)}`)
    .replace(/^const BUILD_ID = 'source'$/m, `const BUILD_ID = '${buildId}'`)

  if (injected === source) {
    throw new Error('build-sw: could not find the BUILD_ASSETS/BUILD_ID placeholders in dist/sw.js')
  }

  await writeFile(join(DIST, 'sw.js'), injected)
  console.log(`build-sw: precaching ${assets.length} asset(s) as build ${buildId}`)
  for (const asset of assets) console.log(`  ${asset}`)
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
