import apiConfig from '../config/apiConfig.js'

export class ApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, details)
  }
}

// 相對路徑接在 API base 後；/health 這類根路徑需使用完整 URL。
export async function apiRequest(path, { query, body, signal, timeoutMs = 15_000, headers, ...options } = {}) {
  const url = new URL(path, `${apiConfig.baseURL}/`)
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  })
  const controller = new AbortController()
  let timedOut = false
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  const timer = setTimeout(() => { timedOut = true; cancel() }, timeoutMs)
  const started = performance.now()
  try {
    const requestHeaders = new Headers(headers)
    if (!requestHeaders.has('Accept')) requestHeaders.set('Accept', 'application/json')
    if (body !== undefined && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json')
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    let data = text || null
    try { data = JSON.parse(text) } catch { /* 保留非 JSON 錯誤回應。 */ }
    const result = { url: url.href, status: response.status, data, elapsed: Math.round(performance.now() - started) }
    if (!response.ok) {
      throw new ApiError(data?.error?.message || `HTTP ${response.status}`, {
        code: 'HTTP_ERROR', ...result, requestId: response.headers.get('X-Request-Id') || data?.requestId,
      })
    }
    return result
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timedOut) throw new ApiError('請求逾時，請稍後重試。', { code: 'TIMEOUT' })
    if (signal?.aborted) throw new ApiError('請求已取消。', { code: 'CANCELLED' })
    throw new ApiError('無法連接後端，請檢查網路或 CORS 設定。', { code: 'NETWORK_ERROR' })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
