import compression from 'compression'

/**
 * Compression for the JSON API, with the event stream carved out.
 *
 * Whole-state sync means /api/state answers with the household's entire
 * history — ~240 KB on the live household — and it was going out uncompressed
 * on every cold load. It gzips to roughly a quarter of that.
 *
 * The carve-out is not paranoia. `compression`'s default filter defers to
 * `compressible()`, which returns **true** for text/event-stream, so the stream
 * at /api/state/events would be compressed and buffered. Live sync would not
 * error; it would just go quiet, which is the same failure the X-Accel-Buffering
 * header in stateEvents.js exists to prevent at the proxy layer. It took a while
 * to diagnose the first time.
 */

/** Path of the SSE endpoint, relative to the /api mount point. */
const EVENT_STREAM_PATH = '/state/events'

export const shouldCompressApiResponse = (req, res) => {
  // Checked by path first, because the filter can run before the handler has
  // set its Content-Type — at which point the header check below sees nothing.
  if (req.path === EVENT_STREAM_PATH) return false
  if (String(res.getHeader?.('Content-Type') || '').includes('text/event-stream')) return false
  return true
}

export function createApiCompression() {
  return compression({
    filter: (req, res) => shouldCompressApiResponse(req, res) && compression.filter(req, res),
  })
}
