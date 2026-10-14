import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { notifyUnauthorized, useSessionStore } from '@/features/auth/stores/session-store'
import { toApiError } from '@/features/shared/lib/api-error'
import { logHttpError } from '@/features/shared/lib/logger'

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

export const SELECT_BUSINESS_EVENT = 'cobrafy:select-business'

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useSessionStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
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
      notifyUnauthorized()
    }

    return Promise.reject(apiError)
  },
)

