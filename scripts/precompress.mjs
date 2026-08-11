/**
 * Pre-compress the built assets so the server never has to.
 *
 * The bundle shipped uncompressed until now: 830 KB over the wire where gzip
 * makes it 209 KB. The obvious fix is compression middleware, but this app
 * serves Server-Sent Events from /api/state/events, and a compressor that
 * buffers an event stream breaks live sync in a way that looks like a bug
 * somewhere else entirely — the same class of problem as the proxy buffering
 * that X-Accel-Buffering in server/stateEvents.js exists to defeat.
 *
 * Compressing at build time sidesteps that completely. The static handler
 * serves a file that is already compressed, nothing inspects a live response,
 * and the per-request CPU cost is zero rather than merely small.
 *
 * Emits both .br and .gz: brotli wins on size, gzip covers anything that does
 * not accept it. A variant is only kept if it actually beats the original.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { brotliCompress, gzip, constants } from 'node:zlib'
import { promisify } from 'node:util'

const brotliAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)

const DIST = join(process.cwd(), 'dist')

// Text formats only. woff2/png/jpg are already compressed — running them
// through gzip costs build time and disk to produce a larger file.
const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.map'])

// Below this, the encoding overhead and the extra branch aren't worth it.
const MIN_BYTES = 1024

const walk = async (dir) => {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await walk(full)))
    else found.push(full)
  }
  return found
}

const run = async () => {
  const files = await walk(DIST)
  const targets = files.filter((file) => {
    if (file.endsWith('.br') || file.endsWith('.gz')) return false
    return COMPRESSIBLE.has(extname(file))
  })

  let originalTotal = 0
  let brotliTotal = 0

  for (const file of targets) {
    const source = await readFile(file)
    if (source.length < MIN_BYTES) continue

    const [br, gz] = await Promise.all([
      brotliAsync(source, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
        },
      }),
      gzipAsync(source, { level: 9 }),
    ])

    // A variant larger than the original would be served as a pessimisation.
    if (br.length < source.length) await writeFile(`${file}.br`, br)
    if (gz.length < source.length) await writeFile(`${file}.gz`, gz)

    originalTotal += source.length
    brotliTotal += Math.min(br.length, source.length)

    const name = file.slice(DIST.length + 1)
    console.log(`precompress: ${name} ${source.length} -> br ${br.length}, gz ${gz.length}`)
  }

  if (originalTotal > 0) {
    const saved = originalTotal - brotliTotal
    const percent = Math.round((saved / originalTotal) * 100)
    console.log(`precompress: ${originalTotal} -> ${brotliTotal} bytes with brotli (${percent}% smaller)`)
  }
}

run().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
