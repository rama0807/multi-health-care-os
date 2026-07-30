import axios, { AxiosError, type AxiosInstance } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('medicore_access_token')
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('medicore_refresh_token')
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('medicore_access_token', accessToken)
  localStorage.setItem('medicore_refresh_token', refreshToken)
}

function clearTokens() {
  localStorage.removeItem('medicore_access_token')
  localStorage.removeItem('medicore_refresh_token')
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers!.Authorization = `Bearer ${token}`
          return apiClient(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(`${API_URL}/v1/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefreshToken } = data.data as {
          accessToken: string
          refreshToken: string
        }

        setTokens(accessToken, newRefreshToken)
        processQueue(null, accessToken)

        originalRequest.headers!.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch (err) {
        processQueue(err, null)
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export { setTokens, clearTokens, getAccessToken }
