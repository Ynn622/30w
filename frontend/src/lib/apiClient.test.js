import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from './apiClient.js'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('encodes query values and returns response metadata', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{"data":{"message":"ok"}}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  const result = await apiRequest('hello', { query: { name: '市民 & A' } })
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('name')).toBe('市民 & A')
  expect(result).toMatchObject({ status: 200, data: { data: { message: 'ok' } } })
})

it('preserves HTTP errors and their response bodies', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"message":"Invalid name"},"requestId":"test"}', { status: 400 })))
  await expect(apiRequest('hello')).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 400, message: 'Invalid name', requestId: 'test' })
})

it('distinguishes a timeout from user cancellation', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn((url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'))
    else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })))
  const result = expect(apiRequest('hello', { timeoutMs: 10 })).rejects.toMatchObject({ code: 'TIMEOUT' })
  await vi.advanceTimersByTimeAsync(10)
  await result
  const controller = new AbortController()
  controller.abort()
  await expect(apiRequest('hello', { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' })
})

it('handles non-JSON responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Maintenance', { status: 503 })))
  await expect(apiRequest('hello')).rejects.toMatchObject({ status: 503, data: 'Maintenance' })
})
