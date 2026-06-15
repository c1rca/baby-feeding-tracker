import type { Dispatch, SetStateAction } from 'react'
import type { Session, Side } from '../types'
import { buildStartedSession, pauseActiveSession, resumeActiveSession, switchActiveSide } from './activeFeedModels'

type ActiveSessionLifecycleOptions = {
  selectedStartTime: number
  session: Session | null
  setNow: Dispatch<SetStateAction<number>>
  setSession: Dispatch<SetStateAction<Session | null>>
}

export function useActiveSessionLifecycle({ selectedStartTime, session, setNow, setSession }: ActiveSessionLifecycleOptions) {
  const startSession = (side: Side) => {
    const t = new Date().getTime()
    setNow(t)
    setSession(buildStartedSession(side, selectedStartTime, t))
  }

  const switchSide = (side: Side) => {
    if (!session || !session.activeSide || !session.segmentStart) return
    setSession(switchActiveSide(session, side, new Date().getTime()))
  }

  const pause = () => {
    if (!session || !session.activeSide || !session.segmentStart) return
    setSession(pauseActiveSession(session, new Date().getTime()))
  }

  const resume = (side: Side) => {
    if (!session) return
    const t = new Date().getTime()
    setNow(t)
    setSession(resumeActiveSession(session, side, t))
  }

  return { startSession, switchSide, pause, resume }
}
