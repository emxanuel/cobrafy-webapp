import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { useSessionStore, notifyUnauthorized } from '@/features/auth/stores/session-store'
import { useBusinessStore } from '@/features/business/stores/business-store'
import { toApiError } from '@/features/shared/lib/api-error'
import { logHttpError } from '@/features/shared/lib/logger'

const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''

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
  const businessId = useBusinessStore.getState().activeBusinessId
  if (businessId) {
    config.headers['X-Business-Id'] = businessId
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
      url.includes('/auth/pin/unlock') ||
      url.includes('/invitations/')

    if (apiError.status === 401 && !isAuthAttempt) {
      notifyUnauthorized()
    }

    return Promise.reject(apiError)
  },
)
