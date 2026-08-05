import axios, { AxiosError, type AxiosInstance } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

// Access token lives in memory only (never localStorage/sessionStorage) —
// the refresh token is an HttpOnly cookie the browser sends automatically
// via `withCredentials`. AuthProvider is the only writer of this value.
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getCsrfToken(): string | null {
  return getCsrfTokenFromCookie()
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)medicore_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/v1`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  const csrfToken = getCsrfTokenFromCookie()
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token!)
    }
  })
  failedQueue = []
}

/** Set by AuthProvider so the interceptor can clear app state on a failed refresh. */
let onRefreshFailure: (() => void) | null = null
export function setOnRefreshFailure(handler: (() => void) | null): void {
  onRefreshFailure = handler
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post<{ data: { accessToken: string } }>(
          `${API_URL}/v1/auth/refresh`,
          undefined,
          { withCredentials: true, headers: { 'X-CSRF-Token': getCsrfTokenFromCookie() ?? '' } },
        )

        const newAccessToken = data.data.accessToken
        setAccessToken(newAccessToken)
        processQueue(null, newAccessToken)

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        setAccessToken(null)
        onRefreshFailure?.()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
