'use client'

import type { AuthenticatedUser, LoginDto } from '@medicore/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'


import { apiClient, getAccessToken, setAccessToken, setOnRefreshFailure } from '@/lib/api/client'

interface LoginResponseBody {
  accessToken: string
  expiresIn: number
  user: AuthenticatedUser
}

interface AuthContextValue {
  user: AuthenticatedUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (dto: LoginDto) => Promise<AuthenticatedUser>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setOnRefreshFailure(clearSession)
    return () => setOnRefreshFailure(null)
  }, [clearSession])

  // Silently rehydrate a session from the httpOnly refresh cookie on load,
  // so a valid session never flashes the login page before redirecting.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const { data } = await apiClient.post<{ data: LoginResponseBody }>('/auth/refresh')
        if (cancelled) return
        setAccessToken(data.data.accessToken)
        setUser(data.data.user)
      } catch {
        if (cancelled) return
        clearSession()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [clearSession])

  const login = useCallback(async (dto: LoginDto): Promise<AuthenticatedUser> => {
    const { data } = await apiClient.post<{ data: LoginResponseBody }>('/auth/login', dto)
    setAccessToken(data.data.accessToken)
    setUser(data.data.user)
    return data.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearSession()
    }
  }, [clearSession])

  const logoutAll = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout-all')
    } finally {
      clearSession()
    }
  }, [clearSession])

  const hasPermission = useCallback(
    (permission: string) =>
      Boolean(
        user?.permissions.some((p) => p === `${permission}.all` || p === `${permission}.own`),
      ),
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user) && Boolean(getAccessToken()),
      login,
      logout,
      logoutAll,
      hasPermission,
    }),
    [user, isLoading, login, logout, logoutAll, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
