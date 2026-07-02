const parseJsonArray = (value) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseJsonValue = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const byId = (items) => new Map((Array.isArray(items) ? items : []).filter((item) => item?.id).map((item) => [item.id, item]))

const pickDefined = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))

export const compactEntry = (entry) => pickDefined({
  id: entry?.id,
  type: entry?.type,
  startedAt: entry?.startedAt,
  endedAt: entry?.endedAt,
  leftSeconds: entry?.leftSeconds,
  rightSeconds: entry?.rightSeconds,
  bottleOunces: entry?.bottleOunces,
  note: entry?.note || undefined,
  diaperKinds: Array.isArray(entry?.diaperKinds) && entry.diaperKinds.length ? entry.diaperKinds : undefined,
})

export const compactDiaper = (diaper) => pickDefined({
  id: diaper?.id,
  at: diaper?.at,
  kinds: Array.isArray(diaper?.kinds) ? diaper.kinds : undefined,
  context: diaper?.context,
})

export const compactMedicine = (medicine) => pickDefined({
  id: medicine?.id,
  at: medicine?.at,
  kind: medicine?.kind,
})

export const compactTummyTime = (tummyTime) => pickDefined({
  id: tummyTime?.id,
  startedAt: tummyTime?.startedAt,
  endedAt: tummyTime?.endedAt,
  note: tummyTime?.note || undefined,
})

export const compactGrowthMeasurement = (measurement) => pickDefined({
  id: measurement?.id,
  at: measurement?.at,
  weightKg: measurement?.weightKg,
  lengthCm: measurement?.lengthCm,
  headCircumferenceCm: measurement?.headCircumferenceCm,
})

export const compactSession = (session) => session ? pickDefined({
  startedAt: session.startedAt,
  activeSide: session.activeSide,
  segmentStart: session.segmentStart,
  segments: Array.isArray(session.segments) ? session.segments : undefined,
  bottleOunces: session.bottleOunces,
  note: session.note || undefined,
  diaperKinds: Array.isArray(session.diaperKinds) && session.diaperKinds.length ? session.diaperKinds : undefined,
}) : null

const changedItems = (beforeItems, afterItems, compact) => {
  const before = byId(beforeItems)
  const after = byId(afterItems)
  const added = []
  const updated = []
  const removed = []

  for (const [id, item] of after.entries()) {
    if (!before.has(id)) added.push(compact(item))
    else if (JSON.stringify(before.get(id)) !== JSON.stringify(item)) updated.push(compact(item))
  }
  for (const [id, item] of before.entries()) {
    if (!after.has(id)) removed.push(compact(item))
  }

  return { added, updated, removed }
}

export function buildStateAudit(existingRow, nextState, options = {}) {
  const before = existingRow ? {
    entries: parseJsonArray(existingRow.entries_json),
    diapers: parseJsonArray(existingRow.diapers_json),
    medicines: parseJsonArray(existingRow.medicines_json),
    tummyTimes: parseJsonArray(existingRow.tummy_times_json),
    growthMeasurements: parseJsonArray(existingRow.growth_measurements_json),
    session: parseJsonValue(existingRow.session_json, null),
    tummySession: parseJsonValue(existingRow.tummy_session_json, null),
    theme: existingRow.theme || 'light',
    updatedAt: existingRow.updated_at,
  } : { entries: [], diapers: [], medicines: [], tummyTimes: [], growthMeasurements: [], session: null, tummySession: null, theme: 'light', updatedAt: null }

  const entries = changedItems(before.entries, nextState.entries ?? [], compactEntry)
  const diapers = changedItems(before.diapers, nextState.diapers ?? [], compactDiaper)
  const medicines = changedItems(before.medicines, nextState.medicines ?? [], compactMedicine)
  const tummyTimes = changedItems(before.tummyTimes, nextState.tummyTimes ?? [], compactTummyTime)
  const growthMeasurements = changedItems(before.growthMeasurements, nextState.growthMeasurements ?? [], compactGrowthMeasurement)
  const beforeSession = compactSession(before.session)
  const afterSession = compactSession(nextState.session)
  const sessionChanged = JSON.stringify(beforeSession) !== JSON.stringify(afterSession)

  return {
    event: 'state_write_audit',
    staleWriteMerged: Boolean(options.staleWriteMerged),
    clientUpdatedAt: options.clientUpdatedAt ?? null,
    previousUpdatedAt: before.updatedAt,
    nextUpdatedAt: options.nextUpdatedAt ?? null,
    entries,
    diapers,
    medicines,
    tummyTimes,
    growthMeasurements,
    session: sessionChanged ? { before: beforeSession, after: afterSession } : undefined,
    theme: before.theme !== nextState.theme ? { before: before.theme, after: nextState.theme } : undefined,
    counts: {
      entries: (nextState.entries ?? []).length,
      diapers: (nextState.diapers ?? []).length,
      medicines: (nextState.medicines ?? []).length,
      tummyTimes: (nextState.tummyTimes ?? []).length,
      growthMeasurements: (nextState.growthMeasurements ?? []).length,
      hasSession: Boolean(nextState.session),
      hasTummySession: Boolean(nextState.tummySession),
    },
  }
}
