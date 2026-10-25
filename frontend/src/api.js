/**
 * Sentinel AI API Client
 * Centralized API service for communicating with the FastAPI backend.
 */

const API_BASE = '/api'

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`)
  }
  return response.json()
}

export async function investigateAlert(alertId) {
  const response = await fetch(`${API_BASE}/investigate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ alert_id: alertId }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : `Investigation failed with HTTP ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export async function getInvestigations(limit = 100) {
  const response = await fetch(`${API_BASE}/investigations?limit=${limit}`)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : `Failed to load investigations (HTTP ${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export async function getInvestigationDetail(historyId) {
  const response = await fetch(`${API_BASE}/investigations/${historyId}`)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : `Failed to load investigation #${historyId} (HTTP ${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export async function getLogs(username = null, limit = 200) {
  const params = new URLSearchParams()
  if (username && username.trim()) {
    params.set('username', username.trim())
  }
  if (limit) {
    params.set('limit', String(limit))
  }

  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await fetch(`${API_BASE}/logs${query}`)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : `Failed to load security logs (HTTP ${response.status})`
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export async function importLogs(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/logs/import`, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : `Log import failed with HTTP ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}
