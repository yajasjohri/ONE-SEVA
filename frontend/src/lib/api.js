import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001/api'

export const api = axios.create({ baseURL: API_BASE, timeout: 10000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let requestQueue = []

async function processQueue(error, token = null) {
  requestQueue.forEach(({ resolve, reject, config }) => {
    if (error) return reject(error)
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    resolve(api(config))
  })
  requestQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        return Promise.reject(error)
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          requestQueue.push({ resolve, reject, config: originalRequest })
        })
      }
      isRefreshing = true
      try {
        const { data } = await axios.post((import.meta.env.VITE_API_BASE || 'http://localhost:5001/api') + '/auth/refresh', {}, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        })
        const newAccess = data.access_token
        localStorage.setItem('access_token', newAccess)
        isRefreshing = false
        await processQueue(null, newAccess)
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return api(originalRequest)
      } catch (e) {
        isRefreshing = false
        await processQueue(e, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        return Promise.reject(e)
      }
    }
    return Promise.reject(error)
  }
)

export async function fetchHealth() {
  const res = await axios.get((import.meta.env.VITE_API_BASE || 'http://localhost:5001') + '/health')
  return res.data
}

export async function getMapLayers() {
  const { data } = await api.get('/map/layers')
  return data.layers
}

export async function getRecommendations(params) {
  const { data } = await api.get('/decisions/recommendations', { params })
  return data
}

export async function getInsights() {
  const { data } = await api.get('/ai/insights')
  return data.insights
}

export async function getDashboardSummary() {
  const { data } = await api.get('/dashboard/summary')
  return data
}

export async function getDashboardAggregates() {
  const { data } = await api.get('/dashboard/aggregates')
  return data
}

export async function getLandUseInsights() {
  const { data } = await api.get('/ai/landuse-insights')
  return data.land_use
}

export async function listClaims() {
  const { data } = await api.get('/claims')
  return data.claims
}

export async function login(identifier, password) {
  const { data } = await api.post('/auth/login', { identifier, password })
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  return data
}

export function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export async function dssScore(claim) {
  const { data } = await api.post('/dss/score', claim)
  return data
}

export async function dssScoreBatch(claims) {
  const { data } = await api.post('/dss/score-batch', { claims })
  return data
}

export async function dssMlScore(claim) {
  const { data } = await api.post('/dss/ml/score', claim)
  return data
}

export async function dssMlScoreBatch(claims) {
  const { data } = await api.post('/dss/ml/score-batch', { claims })
  return data
}


