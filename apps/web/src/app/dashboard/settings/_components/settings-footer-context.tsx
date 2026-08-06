'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Lets whichever section is currently active own the workspace's single save
 * affordance, without every section having to render its own Save/Discard
 * button in a different place. Most sections here have nothing to save
 * (Sessions, Devices, About, …) - `isDirty: false` is their default and the
 * header/footer render nothing for them.
 */
export interface SettingsFooterState {
  isDirty: boolean
  saving?: boolean
  onSave?: () => void
  onDiscard?: () => void
}

const EMPTY_STATE: SettingsFooterState = { isDirty: false }

interface SettingsFooterContextValue {
  state: SettingsFooterState
  setFooter: (state: SettingsFooterState) => void
  clearFooter: () => void
}

const SettingsFooterContext = createContext<SettingsFooterContextValue | null>(null)

export function SettingsFooterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsFooterState>(EMPTY_STATE)
  return (
    <SettingsFooterContext.Provider value={{ state, setFooter: setState, clearFooter: () => setState(EMPTY_STATE) }}>
      {children}
    </SettingsFooterContext.Provider>
  )
}

function useSettingsFooterContext(): SettingsFooterContextValue {
  const ctx = useContext(SettingsFooterContext)
  if (!ctx) throw new Error('Must be used within a SettingsFooterProvider')
  return ctx
}

/** Read-only access for the header/footer that render the Save/Discard controls. */
export function useSettingsFooterState(): SettingsFooterState {
  return useSettingsFooterContext().state
}

/**
 * A section calls this with its own dirty/save/discard state every render.
 * Registration is cleared on unmount, so switching sections never leaves a
 * stale "unsaved changes" bar for a section the user has navigated away from.
 */
export function useRegisterSettingsFooter(state: SettingsFooterState): void {
  const { setFooter, clearFooter } = useSettingsFooterContext()

  useEffect(() => {
    setFooter(state)
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps -- clear once on unmount only
  useEffect(() => () => clearFooter(), [])
}
