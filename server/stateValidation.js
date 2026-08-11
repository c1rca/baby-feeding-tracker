// Guards the whole-state PUT payload before it reaches merge/persistence. Normal
// writes must contain domain-shaped data; only deliberately supported pre-v1
// payload shapes may omit newer fields.
const MAX_ITEMS_PER_COLLECTION = 20000
const MAX_STRING_LENGTH = 10000
const MAX_ID_LENGTH = 200
const COLLECTIONS = ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements', 'healthRecords', 'customTrackers', 'customEvents']
const OBJECT_FIELDS = ['session', 'tummySession', 'pumpSession']
const DIAPER_KINDS = new Set(['wet', 'stool'])
const FEED_TYPES = new Set(['breast', 'bottle', 'mixed'])
const BOTTLE_CONTENTS = new Set(['breastmilk', 'formula', 'mixed'])
const MEDICINE_KINDS = new Set(['tylenol', 'motrin', 'vitamin_d', 'custom'])
const CARE_TIMER_KINDS = new Set(['tummy', 'sleep', 'custom'])
const HEALTH_RECORD_KINDS = new Set(['vaccine', 'milestone', 'appointment'])
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
// `nestedKeys` names the few fields allowed to hold a plain object, checked
// recursively so their leaves are still scalars. Custom trackers carry a goal
// as a discriminated union; without this every nested object is refused, which
// is the right default for everything else.
const hasSafeFields = (obj, objectKeys = [], nestedKeys = []) => Object.entries(obj).every(([key, value]) => {
  if (typeof value === 'string') return value.length <= MAX_STRING_LENGTH
  if (typeof value === 'number') return Number.isFinite(value)
  if (value === null || typeof value === 'boolean' || value === undefined) return true
  if (Array.isArray(value)) return objectKeys.includes(key) || value.every((item) => typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))
  if (isPlainObject(value)) return nestedKeys.includes(key) && hasSafeFields(value)
  return false
})

// Only these collections may nest, and only in these fields.
const COLLECTION_NESTED_FIELDS = { customTrackers: ['goal', 'reminder'], customEvents: ['goalAtLog'] }

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
  // bottleContent postdates the original record shape, so it stays optional.
  if (item.bottleContent !== undefined && !BOTTLE_CONTENTS.has(item.bottleContent)) return false
  if (item.sourceSessionId !== undefined && !validId(item.sourceSessionId)) return false
  // An empty diaperKinds is what a feed with no diaper attached actually looks
  // like on disk — the shipped client writes `[]` on every entry — so rejecting
  // it would 400 the whole payload and strand every other change on the device.
  // A *diaper* record with no kinds is still meaningless and stays rejected.
  return isOptionalString(item.note) && (item.diaperKinds === undefined || validKinds(item.diaperKinds, { allowEmpty: true }))
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
  if (item.kind !== undefined && !MEDICINE_KINDS.has(item.kind)) return false
  if (item.name !== undefined && !isNonEmptyString(item.name, MAX_ID_LENGTH)) return false
  // A custom dose is only identifiable by its name, so that name is required.
  if (item.kind === 'custom' && !isNonEmptyString(item.name, MAX_ID_LENGTH)) return false
  return item.kind !== undefined || item.name !== undefined
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

const CUSTOM_GOAL_KINDS = new Set(['once', 'count', 'duration'])
const validCustomGoal = (goal) => {
  if (!isPlainObject(goal) || !CUSTOM_GOAL_KINDS.has(goal.kind)) return false
  if (goal.kind === 'count') return Number.isInteger(goal.target) && goal.target > 0
  if (goal.kind === 'duration') return Number.isInteger(goal.targetMinutes) && goal.targetMinutes > 0
  return true
}

// Deliberately permissive about icon and hue: those are curated keys on the
// client, and a newer build choosing a key this one has not heard of must not
// make the whole payload invalid — one bad item rejects every other change on
// the device. The view falls back to a default instead.
// Deliberately permissive about which schedule shapes exist: a newer client
// may define one this build has not heard of, and rejecting it would fail the
// whole payload rather than one field.
const validCustomReminder = (reminder) => {
  if (!isPlainObject(reminder)) return false
  if (reminder.kind === 'interval') return isNonNegativeNumber(reminder.everyHours) && reminder.everyHours <= 24
  if (reminder.kind === 'timeOfDay') return isNonNegativeNumber(reminder.atMinutes) && reminder.atMinutes < 1440
  return false
}

const validateCustomTracker = (item) => {
  if (!validId(item.id) || !isNonEmptyString(item.name, MAX_ID_LENGTH)) return false
  if (!isNonNegativeNumber(item.createdAt)) return false
  if (item.archivedAt !== undefined && item.archivedAt !== null && !isTimestamp(item.archivedAt)) return false
  if (item.timer !== undefined && typeof item.timer !== 'boolean') return false
  if (item.icon !== undefined && !isOptionalString(item.icon)) return false
  if (item.hue !== undefined && !isOptionalString(item.hue)) return false
  if (item.reminder !== undefined && item.reminder !== null && !validCustomReminder(item.reminder)) return false
  return validCustomGoal(item.goal)
}

const validateCustomEvent = (item) => {
  if (!validId(item.id) || !validId(item.trackerId) || !requiredTimestamp(item, 'at')) return false
  if (item.durationSeconds !== undefined && !isNonNegativeNumber(item.durationSeconds)) return false
  if (item.goalAtLog !== undefined && !validCustomGoal(item.goalAtLog)) return false
  return isOptionalString(item.note)
}

const validateHealthRecord = (item) => {
  if (!validId(item.id) || !requiredTimestamp(item, 'at')) return false
  if (!HEALTH_RECORD_KINDS.has(item.kind) || !isNonEmptyString(item.name, MAX_ID_LENGTH)) return false
  if (item.completed !== undefined && typeof item.completed !== 'boolean') return false
  return isOptionalString(item.note)
}

const validateSegments = (segments) => Array.isArray(segments) && segments.every((segment) => isPlainObject(segment) && SIDES.has(segment.side) && isTimestamp(segment.startedAt) && isTimestamp(segment.endedAt) && timestampAfterOrEqual(segment.startedAt, segment.endedAt))
const validateFeedSession = (item) => {
  // id/note/bottleOunces/diaperKinds are intentionally optional for LegacySession.
  if (!requiredTimestamp(item, 'startedAt') || (item.id !== undefined && !validId(item.id))) return false
  if (item.activeSide !== undefined && item.activeSide !== null && !SIDES.has(item.activeSide)) return false
  if (item.segmentStart !== undefined && item.segmentStart !== null && !isTimestamp(item.segmentStart)) return false
  if (item.segments !== undefined && !validateSegments(item.segments)) return false
  if (item.bottleContent !== undefined && !BOTTLE_CONTENTS.has(item.bottleContent)) return false
  return (item.bottleOunces === undefined || isNonNegativeNumber(item.bottleOunces)) && isOptionalString(item.note) && (item.diaperKinds === undefined || validKinds(item.diaperKinds, { allowEmpty: true }))
}
const validatePumpSession = (item) => validId(item.id) && requiredTimestamp(item, 'startedAt') && PUMP_SIDES.has(item.side) && optionalTimestamp(item, 'runningStartedAt') && optionalNonNegative(item, 'elapsedSeconds')
const validateTummySession = (item) => (item.id === undefined || validId(item.id)) && requiredTimestamp(item, 'startedAt') && optionalTimestamp(item, 'runningStartedAt') && optionalNonNegative(item, 'elapsedSeconds') && isOptionalString(item.note) && (item.kind === undefined || CARE_TIMER_KINDS.has(item.kind))

const VALIDATORS = { entries: validateEntry, diapers: validateDiaper, medicines: validateMedicine, tummyTimes: validateTummyTime, pumpEvents: validatePumpEvent, growthMeasurements: validateGrowth, healthRecords: validateHealthRecord, customTrackers: validateCustomTracker, customEvents: validateCustomEvent }

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
      if (!isPlainObject(item) || !hasSafeFields(item, [], COLLECTION_NESTED_FIELDS[key] ?? [])) return { ok: false, error: `${key} entries must be valid objects` }
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
  if (body.pumpGoalOunces !== undefined && (!isFiniteNumber(body.pumpGoalOunces) || body.pumpGoalOunces < 0 || body.pumpGoalOunces > 500 || !Number.isInteger(body.pumpGoalOunces))) return { ok: false, error: 'pumpGoalOunces must be an integer from 0 to 500' }
  if (body.pumpGoalSessions !== undefined && (!isFiniteNumber(body.pumpGoalSessions) || body.pumpGoalSessions < 0 || body.pumpGoalSessions > 50 || !Number.isInteger(body.pumpGoalSessions))) return { ok: false, error: 'pumpGoalSessions must be an integer from 0 to 50' }
  if (body.updatedAt !== undefined && body.updatedAt !== null && !isTimestamp(body.updatedAt)) return { ok: false, error: 'updatedAt must be a valid timestamp' }

  return { ok: true }
}
