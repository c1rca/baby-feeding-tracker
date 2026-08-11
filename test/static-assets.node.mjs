import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { createStaticAssets } from '../server/staticAssets.js'

/**
 * These run against a real listening server rather than the fake-app helper the
 * router tests use: the whole point of the middleware is what ends up in the
 * response headers and on the socket, and a stub cannot show that.
 */
const BUNDLE = `console.log(${JSON.stringify('x'.repeat(4000))})`

async function withServer(run) {
  const dist = await mkdtemp(join(tmpdir(), 'static-assets-'))
  await mkdir(join(dist, 'assets'), { recursive: true })

  await writeFile(join(dist, 'assets', 'index-abc123.js'), BUNDLE)
  await writeFile(join(dist, 'assets', 'index-abc123.js.gz'), gzipSync(BUNDLE))
  await writeFile(join(dist, 'assets', 'index-abc123.js.br'), brotliCompressSync(BUNDLE))
  await writeFile(join(dist, 'index.html'), '<!doctype html><title>t</title>')
  await writeFile(join(dist, 'sw.js'), 'self.addEventListener("install", () => {})')

  const app = express()
  app.use(createStaticAssets({ distPath: dist }))
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    await run(base)
  } finally {
    server.close()
    await rm(dist, { recursive: true, force: true })
  }
}

test('serves the brotli variant when the client accepts it', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/assets/index-abc123.js`, { headers: { 'Accept-Encoding': 'br, gzip' } })

    assert.equal(res.headers.get('content-encoding'), 'br')
    assert.equal(res.headers.get('vary'), 'Accept-Encoding')
    // Typed from the real extension, not from `.br` — a bundle served as
    // application/brotli is a bundle the browser refuses to execute.
    assert.match(res.headers.get('content-type'), /javascript/)
    assert.equal(await res.text(), BUNDLE)
  })
})

test('falls back to gzip, then to the original, as the client allows', async () => {
  await withServer(async (base) => {
    const gzip = await fetch(`${base}/assets/index-abc123.js`, { headers: { 'Accept-Encoding': 'gzip' } })
    assert.equal(gzip.headers.get('content-encoding'), 'gzip')
    assert.equal(await gzip.text(), BUNDLE)

    const identity = await fetch(`${base}/assets/index-abc123.js`, { headers: { 'Accept-Encoding': 'identity' } })
    assert.equal(identity.headers.get('content-encoding'), null)
    assert.equal(await identity.text(), BUNDLE)
  })
})

test('honours an explicit q=0 refusal instead of reading it as acceptance', async () => {
  await withServer(async (base) => {
    // "br;q=0" is a client saying it cannot decode brotli. Treating the token's
    // presence as acceptance would send it bytes it has to throw away.
    const res = await fetch(`${base}/assets/index-abc123.js`, { headers: { 'Accept-Encoding': 'br;q=0, gzip' } })

    assert.equal(res.headers.get('content-encoding'), 'gzip')
    assert.equal(await res.text(), BUNDLE)
  })
})

test('caches hashed assets for a year and keeps everything else revalidating', async () => {
  await withServer(async (base) => {
    const hashed = await fetch(`${base}/assets/index-abc123.js`, { headers: { 'Accept-Encoding': 'br' } })
    assert.match(hashed.headers.get('cache-control'), /max-age=31536000/)
    assert.match(hashed.headers.get('cache-control'), /immutable/)

    // sw.js and index.html keep their names across builds. Caching either one
    // immutably would strand clients on the deployed-at-the-time version with
    // no way to tell them a new build exists.
    for (const path of ['/sw.js', '/index.html']) {
      const res = await fetch(`${base}${path}`)
      assert.equal(res.headers.get('cache-control'), 'no-cache', `${path} must revalidate`)
    }
  })
})

test('does not serve a precompressed file from outside dist', async () => {
  await withServer(async (base) => {
    // Encoded traversal: if the resolved path escaped dist, this would be a
    // read primitive for any .gz/.br on the host.
    const res = await fetch(`${base}/assets/..%2f..%2f..%2fetc%2fpasswd`)
    assert.equal(res.headers.get('content-encoding'), null)
    assert.ok(res.status >= 400, `expected a rejection, got ${res.status}`)
  })
})
