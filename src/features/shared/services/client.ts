import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { notifyUnauthorized, useSessionStore } from '@/features/auth/stores/session-store'
import { toApiError } from '@/features/shared/lib/api-error'
import { logHttpError } from '@/features/shared/lib/logger'

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

export const SELECT_BUSINESS_EVENT = 'cobrafy:select-business'

type StampedConfig = InternalAxiosRequestConfig & {
  cobrafyAccessToken?: string | null
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
  (error: AxiosError) => {
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
      const sent = (error.config as StampedConfig | undefined)?.cobrafyAccessToken
      queueMicrotask(() => {
        const current = useSessionStore.getState().accessToken
        if (sent && current && sent !== current) return
        notifyUnauthorized()
      })
    }

    return Promise.reject(apiError)
  },
)
