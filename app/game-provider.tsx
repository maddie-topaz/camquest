'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adminAction, loadSave, sendCommand, type SaveView } from '@/lib/game/client'
import type { Command } from '@/lib/game/types'

// One save for the whole app. Screens read `view` and change it only
// through `dispatch` (rule-checked) or `admin` (debug page). Both replace
// the view with what the server returns, so the UI never drifts from the
// database.
type GameContextValue = {
  view: SaveView | null
  error: Error | null
  loading: boolean
  // Resolves with the current view, fetching if none is loaded yet. The
  // START screen awaits this during the boot animation.
  load: () => Promise<SaveView>
  refresh: () => Promise<SaveView>
  dispatch: (command: Command) => Promise<SaveView>
  admin: (body: Record<string, unknown>) => Promise<SaveView>
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<SaveView | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const inFlight = useRef<Promise<SaveView> | null>(null)

  const refresh = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = loadSave()
        .then((next) => {
          setView(next)
          setError(null)
          return next
        })
        .catch((loadError: Error) => {
          setError(loadError)
          throw loadError
        })
        .finally(() => {
          inFlight.current = null
        })
    }
    return inFlight.current
  }, [])

  const load = useCallback(() => (view ? Promise.resolve(view) : refresh()), [view, refresh])

  const dispatch = useCallback(async (command: Command) => {
    const { view: next } = await sendCommand(command)
    setView(next)
    return next
  }, [])

  const admin = useCallback(async (body: Record<string, unknown>) => {
    const { view: next } = await adminAction(body)
    setView(next)
    return next
  }, [])

  useEffect(() => {
    void refresh().catch(() => {})
  }, [refresh])

  const value = useMemo<GameContextValue>(
    () => ({ view, error, loading: !view && !error, load, refresh, dispatch, admin }),
    [view, error, load, refresh, dispatch, admin],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export const useGame = () => {
  const context = useContext(GameContext)
  if (!context) throw new Error('useGame must be used inside GameProvider')
  return context
}
