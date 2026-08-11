import express from 'express'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Static asset serving: pre-compressed variants, and cache headers that match
 * how each file is actually versioned.
 *
 * Two problems this fixes, both of which cost every cold load:
 *
 * 1. Nothing was compressed. `express.static` alone sent the 830 KB bundle
 *    verbatim, and the OpenResty in front only gzips text/html. scripts/
 *    precompress.mjs now emits .br/.gz at build time and this negotiates them,
 *    which keeps the compressor away from the SSE stream at /api/state/events
 *    entirely — see that script's header for why that matters.
 *
 * 2. Everything was `max-age=0`, so each load spent a round trip revalidating
 *    files whose names already contain a content hash. Vite's /assets/* output
 *    is immutable by construction and can be cached for a year; anything whose
 *    name is stable across builds must keep revalidating, or a client can never
 *    be told about a new build.
 */

// Brotli first: it beats gzip on this bundle by ~15% and every browser that
// speaks it also speaks gzip, so the fallback costs nothing.
const ENCODINGS = [
  { extension: '.br', name: 'br' },
  { extension: '.gz', name: 'gzip' },
]

const YEAR_IN_SECONDS = 31536000

/**
 * True when the client will accept `name`.
 *
 * Deliberately handles the `q=0` case: "br;q=0" means the client is refusing
 * brotli, and treating a refusal as acceptance ships bytes it cannot decode.
 */
const acceptsEncoding = (header, name) => {
  if (!header) return false
  for (const part of header.split(',')) {
    const [token, ...params] = part.trim().split(';')
    if (token.trim().toLowerCase() !== name) continue
    const quality = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    if (!quality) return true
    return Number.parseFloat(quality.slice(2)) > 0
  }
  return false
}

/** Hashed build output can be cached forever; everything else must revalidate. */
const isImmutable = (urlPath) => urlPath.startsWith('/assets/')

const cacheControlFor = (urlPath) =>
  isImmutable(urlPath)
    ? `public, max-age=${YEAR_IN_SECONDS}, immutable`
    // `no-cache` still caches — it just forces a revalidation, which returns a
    // 304 in the common case. It is what keeps a new sw.js and index.html
    // reachable; a stale service worker cannot be replaced by a later deploy.
    : 'no-cache'

export function createStaticAssets({ distPath }) {
  /**
   * Rewrite the request to a pre-compressed twin when one exists and the client
   * accepts it. Runs before express.static, which then serves the variant as an
   * ordinary file — inheriting its correct Content-Length, ETag and 304
   * handling for free.
   */
  const negotiatePrecompressed = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    // Strip the query string; the filesystem lookup must not see it.
    const urlPath = req.url.split('?')[0]

    // Resolve before touching the disk, and confirm the result is still inside
    // dist — a traversal that escapes here would read arbitrary files.
    const resolved = path.resolve(distPath, `.${decodeURIComponent(urlPath)}`)
    if (resolved !== distPath && !resolved.startsWith(distPath + path.sep)) return next()

    for (const { extension, name } of ENCODINGS) {
      if (!acceptsEncoding(req.headers['accept-encoding'], name)) continue
      if (!fs.existsSync(resolved + extension)) continue

      // Content-Type has to come from the *original* extension: left to itself
      // express.static would type `index-abc.js.br` from `.br` and the browser
      // would refuse to execute it as a module.
      res.type(path.extname(urlPath))
      res.set('Content-Encoding', name)
      // Without Vary, a shared cache can hand a brotli body to a client that
      // never asked for one.
      res.set('Vary', 'Accept-Encoding')
      req.url = urlPath + extension
      return next()
    }

    return next()
  }

  const staticHandler = express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Strip any encoding suffix so the policy is decided by the real asset:
      // `/assets/index-abc.js.br` is as immutable as `/assets/index-abc.js`.
      const withoutEncoding = filePath.replace(/\.(br|gz)$/, '')
      const urlPath = '/' + path.relative(distPath, withoutEncoding).split(path.sep).join('/')
      res.set('Cache-Control', cacheControlFor(urlPath))
    },
  })

  return [negotiatePrecompressed, staticHandler]
}
