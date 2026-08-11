const ALLOWED_MODELS = new Set(['gpt-4o-mini', 'gpt-4.1-mini'])
const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_QUESTION_LENGTH = 1000
const MAX_ITEMS_PER_KIND = 20
const REQUEST_TIMEOUT_MS = 15_000

const safeArray = (value) => Array.isArray(value) ? value : []
const eventTime = (item) => Number(item?.endedAt ?? item?.timestamp ?? item?.startTime ?? item?.date ?? 0) || 0
const compactItem = (item) => {
  if (!item || typeof item !== 'object') return null
  const allowed = ['id', 'startTime', 'endedAt', 'timestamp', 'date', 'type', 'side', 'amount', 'unit', 'duration', 'durationMinutes', 'kinds', 'kind', 'weight', 'weightUnit', 'length', 'lengthUnit', 'temperature', 'temperatureUnit', 'name']
  return Object.fromEntries(allowed.filter((key) => item[key] !== undefined && item[key] !== null && item[key] !== '').map((key) => [key, item[key]]))
}

export const compactTrackerContext = (rawState) => {
  let state = rawState
  if (typeof rawState === 'string') {
    try { state = JSON.parse(rawState) } catch { state = {} }
  }
  if (!state || typeof state !== 'object') state = {}
  const categories = ['entries', 'diapers', 'medicines', 'tummyTimes', 'pumpEvents', 'growthMeasurements', 'healthRecords']
  return Object.fromEntries(categories.map((category) => [
    category,
    safeArray(state[category])
      .sort((a, b) => eventTime(b) - eventTime(a))
      .slice(0, MAX_ITEMS_PER_KIND)
      .map(compactItem)
      .filter(Boolean),
  ]))
}

const error = (res, status, message) => res.status(status).json({ ok: false, error: message })

export const createAiCareAssistantRouter = ({ apiKey = '', selectStateForBaby, fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) => (app) => {
  app.post('/api/ai-care-assistant', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''
    const model = typeof req.body?.model === 'string' ? req.body.model : DEFAULT_MODEL
    if (!Object.keys(body).every((key) => key === 'question' || key === 'model') || !question || question.length > MAX_QUESTION_LENGTH || !ALLOWED_MODELS.has(model)) {
      error(res, 400, 'Please provide a question up to 1,000 characters and choose an available model.')
      return
    }
    const householdId = req.auth?.householdId
    const babyId = req.auth?.babyId
    if (!householdId || !babyId) {
      error(res, 403, 'Your active household and baby are required to use the AI assistant.')
      return
    }
    if (!apiKey) {
      error(res, 503, 'The AI assistant is not configured yet. Please ask your administrator to add OPENAI_API_KEY.')
      return
    }

    const row = selectStateForBaby?.get(householdId, babyId)
    const context = compactTrackerContext(row?.state_json)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          max_tokens: 350,
          temperature: 0.2,
          messages: [
            { role: 'system', content: 'You are Feedr’s informational tracker-data support assistant. Answer only from the supplied tracker data, clearly state uncertainty or missing data, and be concise. Do not diagnose, prescribe, or provide medical advice; for health concerns or clinician questions, recommend contacting a qualified clinician.' },
            { role: 'user', content: `Question: ${question}\n\nCompact tracker data (most recent records only):\n${JSON.stringify(context)}` },
          ],
        }),
      })
      if (!response.ok) {
        error(res, 503, 'The AI assistant is temporarily unavailable. Please try again shortly.')
        return
      }
      const payload = await response.json().catch(() => null)
      const answer = typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content.trim() : ''
      if (!answer) {
        error(res, 503, 'The AI assistant could not complete that request. Please try again.')
        return
      }
      res.json({ ok: true, answer: answer.slice(0, 4000), model })
    } catch {
      error(res, 503, 'The AI assistant is temporarily unavailable. Please try again shortly.')
    } finally {
      clearTimeout(timer)
    }
  })
}

export { ALLOWED_MODELS, DEFAULT_MODEL }
