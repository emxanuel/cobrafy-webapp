import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { getSwitchingFromToken } from '@/features/auth/lib/switching-token'
import { notifyUnauthorized, useSessionStore } from '@/features/auth/stores/session-store'
import { toApiError } from '@/features/shared/lib/api-error'
import { logHttpError } from '@/features/shared/lib/logger'

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

export const SELECT_BUSINESS_EVENT = 'cobrafy:select-business'

type StampedConfig = InternalAxiosRequestConfig & {
  cobrafyAccessToken?: string | null
}

function bearerFromHeader(header: unknown): string | null {
  const value =
    typeof header === 'string'
      ? header
      : Array.isArray(header)
        ? header[0]
        : header == null
          ? null
          : String(header)
  if (typeof value === 'string' && value.startsWith('Bearer ')) {
    return value.slice('Bearer '.length)
  }
  return null
}

function tokenUsedOnRequest(config?: StampedConfig): string | null {
  if (!config) return null
  if (config.cobrafyAccessToken !== undefined) return config.cobrafyAccessToken
  const headers = config.headers
  const header =
    headers && typeof headers.get === 'function'
      ? headers.get('Authorization')
      : headers?.Authorization
  return bearerFromHeader(header)
}

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const stamped = config as StampedConfig
  const token = useSessionStore.getState().accessToken
  stamped.cobrafyAccessToken = token
  if (token) {
    stamped.headers.Authorization = `Bearer ${token}`
  }
  return stamped
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text()
      try {
        error.response.data = JSON.parse(text)
      } catch {
        /* keep the blob when the body is not JSON */
      }
    }
    const apiError = toApiError(error)
    logHttpError({
      method: error.config?.method?.toUpperCase(),
      path: error.config?.url,
      status: apiError.status,
    })

    const url = error.config?.url ?? ''
    const isAuthAttempt =
      url.includes('/auth/login') ||
      url.includes('/auth/pin') ||
      url.includes('/auth/password') ||
      url.includes('/invitations/accept')

    if (apiError.status === 401 && apiError.message === 'selecciona un negocio') {
      window.dispatchEvent(new Event(SELECT_BUSINESS_EVENT))
    } else if (apiError.status === 401 && !isAuthAttempt) {
      const sent = tokenUsedOnRequest(error.config as StampedConfig | undefined)
      if (sent && sent === getSwitchingFromToken()) {
        return Promise.reject(apiError)
      }
      queueMicrotask(() => {
        const current = useSessionStore.getState().accessToken
        if (sent && current && sent !== current) return
        if (sent && sent === getSwitchingFromToken()) return
        notifyUnauthorized()
      })
    }

    return Promise.reject(apiError)
  },
)
