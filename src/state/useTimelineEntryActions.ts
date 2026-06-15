import { useCallback } from 'react'
import type { TimelineEntryActionsOptions } from './timelineEntryActionTypes'
import { useTimelineDiaperEditActions } from './useTimelineDiaperEditActions'
import { useTimelineEntryMutationActions } from './useTimelineEntryMutationActions'

export function useTimelineEntryActions(options: TimelineEntryActionsOptions) {
  const { undoState } = options
  const clearUndoTimeout = useCallback(() => {
    if (undoState) window.clearTimeout(undoState.timeoutId)
  }, [undoState])

  return {
    ...useTimelineEntryMutationActions(options, { clearUndoTimeout }),
    ...useTimelineDiaperEditActions(options),
  }
}
