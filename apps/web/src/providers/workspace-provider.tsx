'use client'

import type { Hospital } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { listHospitals } from '@/lib/api/hospitals'
import { useAuth } from '@/lib/auth/auth-context'

/**
 * Which hospital the user is currently working in.
 *
 * MediCore is Organization → Hospital → Department (ADR-0025), and a user can
 * belong to several hospitals in one organization. This holds that selection in
 * one place so the sidebar's hospital switcher, the top bar, and page queries
 * all agree on the answer.
 *
 * ── Scope, stated plainly ─────────────────────────────────────────────────
 * This provider owns the *selection*. It does not yet filter any module's data:
 * page-level queries still request whatever the API scopes them to, and Phase 1
 * was explicitly forbidden from touching feature pages or APIs. Passing
 * `activeHospitalId` into each module's query is page work.
 *
 * Because of that, the switcher is rendered **read-only when the user has only
 * one hospital**, and when it can change the selection it says what the
 * selection currently affects rather than implying a filter that is not there.
 * Tracked as TD-0075.
 */

interface WorkspaceContextValue {
  hospitals: Hospital[]
  activeHospitalId: string | null
  activeHospital: Hospital | null
  setActiveHospitalId: (hospitalId: string | null) => void
  /** True when the user can actually pick between two or more hospitals. */
  canSwitch: boolean
  isLoading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)

const STORAGE_KEY = 'medicore.workspace.hospitalId'

function readStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, hasPermission } = useAuth()
  const [activeHospitalId, setActiveHospitalIdState] = useState<string | null>(null)

  const canListHospitals = isAuthenticated && hasPermission('hospitals.read')

  const query = useQuery({
    queryKey: ['workspace', 'hospitals', user?.organizationId],
    queryFn: listHospitals,
    enabled: canListHospitals,
    staleTime: 5 * 60 * 1000,
  })

  // A user's own `hospitalIds` claim is the authority on what they may work in;
  // `hospitals.read` (an admin permission) only determines whether we can put
  // *names* next to those ids.
  const hospitals = useMemo(() => {
    const all = query.data ?? []
    const assigned = user?.hospitalIds ?? []
    if (assigned.length === 0) return all
    const scoped = all.filter((hospital) => assigned.includes(hospital.id))
    return scoped.length > 0 ? scoped : all
  }, [query.data, user?.hospitalIds])

  // Restore the stored selection only if it is still one the user may access —
  // membership can be revoked between sessions.
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveHospitalIdState(null)
      return
    }

    const stored = readStored()
    const permitted = user?.hospitalIds ?? []

    if (stored && (permitted.length === 0 || permitted.includes(stored))) {
      setActiveHospitalIdState(stored)
      return
    }

    setActiveHospitalIdState(permitted.length === 1 ? permitted[0] : null)
  }, [isAuthenticated, user?.hospitalIds])

  const setActiveHospitalId = useCallback((hospitalId: string | null) => {
    setActiveHospitalIdState(hospitalId)
    if (typeof window === 'undefined') return
    try {
      if (hospitalId) window.localStorage.setItem(STORAGE_KEY, hospitalId)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Selection simply will not survive a reload.
    }
  }, [])

  const value = useMemo<WorkspaceContextValue>(() => {
    const assignedCount = user?.hospitalIds?.length ?? 0
    return {
      hospitals,
      activeHospitalId,
      activeHospital: hospitals.find((hospital) => hospital.id === activeHospitalId) ?? null,
      setActiveHospitalId,
      canSwitch: hospitals.length > 1 || assignedCount > 1,
      isLoading: query.isLoading,
    }
  }, [hospitals, activeHospitalId, setActiveHospitalId, query.isLoading, user?.hospitalIds])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return context
}
