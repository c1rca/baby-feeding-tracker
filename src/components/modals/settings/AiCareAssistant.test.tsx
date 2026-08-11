import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiCareAssistant } from './AiCareAssistant'

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })

describe('AiCareAssistant', () => {
  it('sends only the selected model and explicit question after the user asks', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, answer: 'One bottle feed is recorded.', model: 'gpt-4o-mini' }), { status: 200 }))
    render(<AiCareAssistant />)

    fireEvent.change(screen.getByLabelText('Assistant model'), { target: { value: 'gpt-4o-mini' } })
    fireEvent.change(screen.getByLabelText('Ask about your tracker data'), { target: { value: 'How many bottles are logged?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(screen.getByText('One bottle feed is recorded.')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledWith('/api/ai-care-assistant', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ question: 'How many bottles are logged?', model: 'gpt-4o-mini' }),
    }))
  })

  it('shows the clinician disclaimer and a friendly unavailable error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: false, error: 'The AI assistant is not configured yet. Please ask your administrator to add OPENAI_API_KEY.' }), { status: 503 }))
    render(<AiCareAssistant />)
    expect(screen.getByText(/not medical advice/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Ask about your tracker data'), { target: { value: 'What was logged?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not configured yet/i))
  })

  it('keeps a sent question and answer together in a chat thread while clearing the composer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, answer: 'Two bottle feeds are recorded.' }), { status: 200 }))
    render(<AiCareAssistant />)
    const composer = screen.getByLabelText('Ask about your tracker data')
    fireEvent.change(composer, { target: { value: 'How many bottles are logged?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(screen.getByText('Two bottle feeds are recorded.')).toBeTruthy())
    expect(screen.getByText('How many bottles are logged?')).toBeTruthy()
    expect((composer as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByLabelText('Feedr AI conversation')).toBeTruthy()
  })
})
