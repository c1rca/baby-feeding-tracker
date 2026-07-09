// Guards the whole-state PUT payload before it reaches the merge logic: caps
// unbounded growth and rejects clearly malformed shapes, without altering any
// legitimate (including legacy single-family) payload.
const MAX_ITEMS_PER_COLLECTION = 20000
const MAX_STRING_LENGTH = 10000
const COLLECTIONS = ['entries', 'diapers', 'medicines', 'tummyTimes', 'growthMeasurements']
const OBJECT_FIELDS = ['session', 'tummySession']

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isValidDob = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
const hasOverlongString = (obj) => Object.values(obj).some((v) => typeof v === 'string' && v.length > MAX_STRING_LENGTH)

export const validateStatePayload = (body) => {
  // A missing body is coerced to defaults downstream; only reject a body that is
  // present but the wrong kind (primitive or array).
  if (body === undefined || body === null) return { ok: true }
  if (!isPlainObject(body)) return { ok: false, error: 'State payload must be a JSON object' }

  for (const key of COLLECTIONS) {
    const value = body[key]
    if (value === undefined || value === null) continue
    if (!Array.isArray(value)) return { ok: false, error: `${key} must be an array` }
    if (value.length > MAX_ITEMS_PER_COLLECTION) return { ok: false, error: `${key} exceeds the maximum of ${MAX_ITEMS_PER_COLLECTION} items` }
    for (const item of value) {
      if (!isPlainObject(item)) return { ok: false, error: `${key} entries must be objects` }
      if (hasOverlongString(item)) return { ok: false, error: `${key} contains a string longer than ${MAX_STRING_LENGTH} characters` }
    }
  }

  for (const key of OBJECT_FIELDS) {
    const value = body[key]
    if (value === undefined || value === null) continue
    if (!isPlainObject(value)) return { ok: false, error: `${key} must be an object` }
    if (hasOverlongString(value)) return { ok: false, error: `${key} contains a string longer than ${MAX_STRING_LENGTH} characters` }
  }

  if (body.babyDob !== undefined && body.babyDob !== null) {
    if (typeof body.babyDob !== 'string' || !isValidDob(body.babyDob)) {
      return { ok: false, error: 'babyDob must use YYYY-MM-DD' }
    }
  }

  return { ok: true }
}
