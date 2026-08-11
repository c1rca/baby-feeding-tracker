import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { authFetch } from '../../../auth/authSession'
import { InlineMessage, SettingsSection } from './SettingsPrimitives'

const MODEL_STORAGE_KEY = 'baby-feeding-tracker:v1:ai-care-model'
const MODELS = [
  { value: 'gpt-4o-mini', label: 'Balanced · GPT-4o mini' },
  { value: 'gpt-4.1-mini', label: 'More reasoning · GPT-4.1 mini' },
]

type Message = { id: number; role: 'user' | 'assistant'; text: string }

const initialModel = () => {
  try {
    const stored = localStorage.getItem(MODEL_STORAGE_KEY)
    return stored && MODELS.some((model) => model.value === stored) ? stored : 'gpt-4o-mini'
  } catch { return 'gpt-4o-mini' }
}

const persistModel = (value: string) => {
  try { localStorage.setItem(MODEL_STORAGE_KEY, value) } catch { return undefined }
}

export function AiCareAssistant() {
  const [model, setModel] = useState(initialModel)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const ask = async () => {
    const trimmed = question.trim()
    if (!trimmed || isAsking) return
    const id = Date.now()
    setQuestion('')
    setMessages((current) => [...current, { id, role: 'user', text: trimmed }])
    setIsAsking(true)
    setError('')
    try {
      const response = await authFetch('/api/ai-care-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, model }),
      })
      const data = await response.json().catch(() => null) as { answer?: string; error?: string } | null
      if (!response.ok || !data?.answer) throw new Error(data?.error || 'The AI assistant could not complete that request. Please try again.')
      const answer = data.answer
      setMessages((current) => [...current, { id: id + 1, role: 'assistant', text: answer }])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AI assistant is temporarily unavailable. Please try again shortly.')
    } finally {
      setIsAsking(false)
    }
  }
  return (
    <SettingsSection label="Ask Feedr AI" lead="Private answers grounded in a compact view of your active baby’s recent tracker data—only when you ask.">
      <div className="settings-card ai-care-assistant">
        <div className="ai-care-thread" aria-label="Feedr AI conversation" aria-live="polite">
          {messages.length ? messages.map((message) => (
            <div key={message.id} className={`ai-care-message is-${message.role}`}>
              {message.role === 'assistant' ? <Sparkles size={15} aria-hidden="true" /> : null}
              <p>{message.text}</p>
            </div>
          )) : <div className="ai-care-empty"><Sparkles size={18} aria-hidden="true" /><p>Ask about feeds, diapers, pumping, or recent care activity.</p></div>}
          {isAsking ? <div className="ai-care-message is-assistant is-pending"><Sparkles size={15} aria-hidden="true" /><p>Checking your tracker…</p></div> : null}
        </div>
        <div className="ai-care-composer">
          <label className="settings-field">
            <span className="settings-field-label">Ask about your tracker data</span>
            <textarea aria-label="Ask about your tracker data" maxLength={1000} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask() } }} placeholder="How many bottle feeds were logged today?" />
          </label>
          <div className="ai-care-composer-actions">
            <label className="settings-select"><span className="sr-only">Assistant model</span><select aria-label="Assistant model" value={model} onChange={(event) => { setModel(event.target.value); persistModel(event.target.value) }}>
              {MODELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <button type="button" onClick={() => void ask()} disabled={!question.trim() || isAsking}>{isAsking ? 'Checking…' : 'Send'}</button>
          </div>
        </div>
        <p className="ai-care-disclaimer">Informational tracker-data support only — not medical advice. For health concerns or clinician questions, contact a qualified clinician.</p>
        {error ? <InlineMessage kind="error">{error}</InlineMessage> : null}
      </div>
    </SettingsSection>
  )
}
