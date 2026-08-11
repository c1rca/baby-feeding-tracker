import { render, screen, act, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { LiveSyncConflictBanner } from './LiveSyncConflictBanner'
import type { ServerState } from '../types'

const topbarProps = {
  activeWorkspace: 'track' as const,
  navigateWorkspace: () => {},
  setSettingsOpen: () => {},
  careNotifications: [],
  babies: [],
  selectedBabyId: 'default-baby',
  onSelectedBabyIdChange: () => {},
}

describe('the top bar never flashes a transient sync warning', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  // The reported symptom: a device closed mid-write starts up already marked
  // pending, so it briefly rendered "Offline changes saved" on an ordinary
  // refresh before the first sync landed.
  it('says nothing when an offline state resolves quickly', () => {
    const { rerender } = render(<WorkspaceTopbar {...topbarProps} syncStatus="offline" />)
    act(() => { vi.advanceTimersByTime(900) })
    expect(screen.queryByText(/Offline changes saved/i)).toBeNull()

    rerender(<WorkspaceTopbar {...topbarProps} syncStatus="synced" />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.queryByText(/Offline changes saved/i)).toBeNull()
  })

  it('still reports an offline state that genuinely persists', () => {
    render(<WorkspaceTopbar {...topbarProps} syncStatus="offline" />)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(screen.getByText(/Offline changes saved/i)).toBeTruthy()
  })

  it('never shows the normal syncing/synced states at all', () => {
    const { rerender } = render(<WorkspaceTopbar {...topbarProps} syncStatus="syncing" />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.queryByText(/Syncing/i)).toBeNull()

    rerender(<WorkspaceTopbar {...topbarProps} syncStatus="synced" />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.queryByText(/Online/i)).toBeNull()
  })

  it('promotes a due Vitamin D reminder beside the brand and keeps it out of the bell', () => {
    const logVitaminD = vi.fn()
    const dismissVitaminD = vi.fn()
    render(<WorkspaceTopbar {...topbarProps} syncStatus="synced" careNotifications={[
      { id: 'vitamin-due', kind: 'vitamin_d', priority: 2, title: 'Vitamin D reminder', summary: 'Take Vitamin D. Last dose was 18+ hours ago.', actionLabel: 'Log Vitamin D', ariaActionLabel: 'Log Vitamin D now', announcedRole: 'alert', dismissible: true, occurredAt: 1, action: logVitaminD, dismiss: dismissVitaminD },
      { id: 'tylenol-due', kind: 'medicine', priority: 1, title: 'Medicine reminder', summary: 'Take Tylenol now.', actionLabel: 'Log Tylenol', ariaActionLabel: 'Log Tylenol now', announcedRole: 'alert', dismissible: true, occurredAt: 2, action: vi.fn(), dismiss: vi.fn() },
    ]} />)

    const logButton = screen.getByRole('button', { name: /Log Vitamin D now/i })
    const dismissButton = screen.getByRole('button', { name: /Dismiss Vitamin D reminder/i })
    expect(logButton).toBeTruthy()
    expect(dismissButton).toBeTruthy()
    fireEvent.click(logButton)
    fireEvent.click(dismissButton)
    expect(logVitaminD).toHaveBeenCalledOnce()
    expect(dismissVitaminD).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /Open care notifications, 1 unresolved/i })).toBeTruthy()
  })
})

describe('the conflict banner never flashes', () => {
  const conflict = { updatedAt: 'v2', entries: [] } as unknown as ServerState
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('stays hidden for a conflict that resolves itself', () => {
    const { rerender } = render(<LiveSyncConflictBanner conflict={conflict} onResolve={() => {}} />)
    act(() => { vi.advanceTimersByTime(800) })
    expect(screen.queryByRole('alertdialog')).toBeNull()

    // The local write landed and cleared it.
    rerender(<LiveSyncConflictBanner conflict={null} onResolve={() => {}} />)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('still asks the caregiver about a disagreement that persists', () => {
    render(<LiveSyncConflictBanner conflict={conflict} onResolve={() => {}} />)
    act(() => { vi.advanceTimersByTime(4000) })
    expect(screen.getByRole('alertdialog', { name: /Sync conflict/i })).toBeTruthy()
  })
})
