// Guards the whole-state PUT payload before it reaches merge/persistence. Normal
// writes must contain domain-shaped data; only deliberately supported pre-v1
// payload shapes may omit newer fields.
const MAX_ITEMS_PER_COLLECTION = 20000
const MAX_STRING_LENGTH = 10000
const MAX_ID_LENGTH = 200
const COLLECTIONS = ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements']
const OBJECT_FIELDS = ['session', 'tummySession', 'pumpSession']
const DIAPER_KINDS = new Set(['wet', 'stool'])
const FEED_TYPES = new Set(['breast', 'bottle', 'mixed'])
const MEDICINE_KINDS = new Set(['tylenol', 'motrin', 'vitamin_d'])
const CARE_TIMER_KINDS = new Set(['tummy', 'sleep'])
const SIDES = new Set(['left', 'right'])
const PUMP_SIDES = new Set(['left', 'right', 'both'])

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isNonEmptyString = (value, max = MAX_STRING_LENGTH) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const isOptionalString = (value) => value === undefined || (typeof value === 'string' && value.length <= MAX_STRING_LENGTH)
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value)
const isNonNegativeNumber = (value) => isFiniteNumber(value) && value >= 0
const isNullableNonNegativeNumber = (value) => value === null || isNonNegativeNumber(value)
const isTimestamp = (value) => {
  if (isNonNegativeNumber(value)) return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false
  return Number.isFinite(Date.parse(value))
}
const isValidDob = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
const timestampAfterOrEqual = (start, end) => typeof start === 'number' && typeof end === 'number' ? end >= start : Date.parse(end) >= Date.parse(start)
const validId = (value) => isNonEmptyString(value, MAX_ID_LENGTH)
const validKinds = (value, { allowEmpty = false } = {}) => Array.isArray(value) && (allowEmpty || value.length > 0) && value.every((kind) => DIAPER_KINDS.has(kind)) && new Set(value).size === value.length
const hasSafeFields = (obj, objectKeys = []) => Object.entries(obj).every(([key, value]) => {
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH
  if (typeof value === 'number') return Number.isFinite(value)
  if (value === null || typeof value === 'boolean' || value === undefined) return true
  if (Array.isArray(value)) return objectKeys.includes(key) || value.every((item) => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))
  return false
})

const requiredTimestamp = (item, field) => isTimestamp(item[field])
const optionalTimestamp = (item, field) => item[field] === undefined || item[field] === null || isTimestamp(item[field])
const optionalNonNegative = (item, field) => item[field] === undefined || isNonNegativeNumber(item[field])

const validateEntry = (item) => {
  if (!validId(item.id) || !requiredTimestamp(item, 'startedAt') || !optionalTimestamp(item, 'endedAt')) return false
  if (item.endedAt !== undefined && item.endedAt !== null && !timestampAfterOrEqual(item.startedAt, item.endedAt)) return false
  // type and detailed quantities were absent in supported single-family records.
  if (item.type !== undefined && !FEED_TYPES.has(item.type)) return false
  if (!optionalNonNegative(item, 'leftSeconds') || !optionalNonNegative(item, 'rightSeconds')) return false
  if (item.bottleOunces !== undefined && !isNullableNonNegativeNumber(item.bottleOunces)) return false
  if (item.sourceSessionId !== undefined && !validId(item.sourceSessionId)) return false
  return isOptionalString(item.note) && (item.diaperKinds === undefined || validKinds(item.diaperKinds))
}

const validateDiaper = (item) => {
  if (!validId(item.id) || !requiredTimestamp(item, 'at')) return false
  if (item.kind !== undefined && !DIAPER_KINDS.has(item.kind)) return false
  if (item.kinds !== undefined && !validKinds(item.kinds)) return false
  if (item.kind === undefined && item.kinds === undefined) return false
  if (item.context !== undefined && item.context !== 'standalone' && item.context !== 'feed') return false
  return optionalTimestamp(item, 'feedStartedAt')
}

const validateMedicine = (item) => {
  if (!validId(item.id) || !requiredTimestamp(item, 'at')) return false
  // `name` is the explicit legacy equivalent of current `kind`.
  return (item.kind === undefined || MEDICINE_KINDS.has(item.kind)) && (item.name === undefined || isNonEmptyString(item.name)) && (item.kind !== undefined || item.name !== undefined)
}

const validateTummyTime = (item) => {
  if (!validId(item.id) || !requiredTimestamp(item, 'startedAt')) return false
  if (item.endedAt !== undefined && (!isTimestamp(item.endedAt) || !timestampAfterOrEqual(item.startedAt, item.endedAt))) return false
  // durationSeconds is the supported legacy completion representation.
  if (item.durationSeconds !== undefined && !isNonNegativeNumber(item.durationSeconds)) return false
  if (item.endedAt === undefined && item.durationSeconds === undefined) return false
  return isOptionalString(item.note) && (item.kind === undefined || CARE_TIMER_KINDS.has(item.kind))
}

const validatePumpEvent = (item) => validId(item.id) && requiredTimestamp(item, 'startedAt') && requiredTimestamp(item, 'endedAt') && timestampAfterOrEqual(item.startedAt, item.endedAt) && isNullableNonNegativeNumber(item.leftOunces) && isNullableNonNegativeNumber(item.rightOunces) && isOptionalString(item.note)

const validateGrowth = (item) => {
  if (!validId(item.id) || !(isTimestamp(item.measuredAt) || isTimestamp(item.at) || isValidDob(item.at))) return false
  // weightGrams/lengthCm are supported legacy fields; current values use weightLb.
  for (const field of ['ageMonths', 'weightLb', 'lengthCm', 'headCm', 'weightGrams']) {
    if (item[field] !== undefined && !isNullableNonNegativeNumber(item[field])) return false
  }
  return isOptionalString(item.note)
}

const validateSegments = (segments) => Array.isArray(segments) && segments.every((segment) => isPlainObject(segment) && SIDES.has(segment.side) && isTimestamp(segment.startedAt) && isTimestamp(segment.endedAt) && timestampAfterOrEqual(segment.startedAt, segment.endedAt))
const validateFeedSession = (item) => {
  // id/note/bottleOunces/diaperKinds are intentionally optional for LegacySession.
  if (!requiredTimestamp(item, 'startedAt') || (item.id !== undefined && !validId(item.id))) return false
  if (item.activeSide !== undefined && item.activeSide !== null && !SIDES.has(item.activeSide)) return false
  if (item.segmentStart !== undefined && item.segmentStart !== null && !isTimestamp(item.segmentStart)) return false
  if (item.segments !== undefined && !validateSegments(item.segments)) return false
  return (item.bottleOunces === undefined || isNonNegativeNumber(item.bottleOunces)) && isOptionalString(item.note) && (item.diaperKinds === undefined || validKinds(item.diaperKinds, { allowEmpty: true }))
}
const validatePumpSession = (item) => validId(item.id) && requiredTimestamp(item, 'startedAt') && PUMP_SIDES.has(item.side) && optionalTimestamp(item, 'runningStartedAt') && optionalNonNegative(item, 'elapsedSeconds')
const validateTummySession = (item) => (item.id === undefined || validId(item.id)) && requiredTimestamp(item, 'startedAt') && optionalTimestamp(item, 'runningStartedAt') && optionalNonNegative(item, 'elapsedSeconds') && isOptionalString(item.note) && (item.kind === undefined || CARE_TIMER_KINDS.has(item.kind))

const VALIDATORS = { entries: validateEntry, diapers: validateDiaper, medicines: validateMedicine, tummyTimes: validateTummyTime, pumpEvents: validatePumpEvent, growthMeasurements: validateGrowth }

export const validateStatePayload = (body) => {
  // Empty/missing payloads are the deliberate legacy bootstrap shape. A supplied
  // v1-like field, however, is validated rather than silently defaulted.
  if (body === undefined || body === null) return { ok: true }
  if (!isPlainObject(body)) return { ok: false, error: 'State payload must be a JSON object' }

  for (const key of COLLECTIONS) {
    const value = body[key]
    if (value === undefined) continue
    if (!Array.isArray(value)) return { ok: false, error: `${key} must be an array` }
    if (value.length > MAX_ITEMS_PER_COLLECTION) return { ok: false, error: `${key} exceeds the maximum of ${MAX_ITEMS_PER_COLLECTION} items` }
    const ids = new Set()
    for (const item of value) {
      if (!isPlainObject(item) || !hasSafeFields(item)) return { ok: false, error: `${key} entries must be valid objects` }
      if (!VALIDATORS[key](item)) return { ok: false, error: `${key} contains invalid domain data` }
      if (ids.has(item.id)) return { ok: false, error: `${key} contains duplicate IDs` }
      ids.add(item.id)
    }
  }

  for (const key of OBJECT_FIELDS) {
    const value = body[key]
    if (value === undefined || value === null) continue
    if (!isPlainObject(value) || !hasSafeFields(value, key === 'session' ? ['segments'] : [])) return { ok: false, error: `${key} must be a valid object` }
    const valid = key === 'session' ? validateFeedSession(value) : key === 'pumpSession' ? validatePumpSession(value) : validateTummySession(value)
    if (!valid) return { ok: false, error: `${key} contains invalid domain data` }
  }

  if (body.babyDob !== undefined && !isValidDob(body.babyDob)) return { ok: false, error: 'babyDob must use YYYY-MM-DD' }
  if (body.theme !== undefined && body.theme !== 'light' && body.theme !== 'dark') return { ok: false, error: 'theme must be light or dark' }
  if (body.tummyGoalMinutes !== undefined && (!isFiniteNumber(body.tummyGoalMinutes) || body.tummyGoalMinutes < 1 || body.tummyGoalMinutes > 240 || !Number.isInteger(body.tummyGoalMinutes))) return { ok: false, error: 'tummyGoalMinutes must be an integer from 1 to 240' }
  if (body.updatedAt !== undefined && body.updatedAt !== null && !isTimestamp(body.updatedAt)) return { ok: false, error: 'updatedAt must be a valid timestamp' }

  return { ok: true }
}
