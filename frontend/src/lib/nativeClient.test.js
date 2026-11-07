import { afterEach, expect, it, vi } from 'vitest'
import { requestNative } from './nativeClient.js'

afterEach(() => vi.useRealTimers())

function createHost() {
  const listeners = new Set()
  const flutterObject = {
    postMessage: vi.fn(),
    addEventListener: (name, listener) => listeners.add(listener),
    removeEventListener: (name, listener) => listeners.delete(listener),
  }
  return { host: { flutterObject }, listeners, reply: (name, data) => {
    for (const listener of [...listeners]) listener({ data: JSON.stringify({ name, data }) })
  } }
}

it('handles matching synchronous replies and cleans listeners', async () => {
  const { host, reply, listeners } = createHost()
  host.flutterObject.postMessage.mockImplementation(() => reply('userinfo', { username: 'test' }))
  await expect(requestNative('userinfo', null, { host })).resolves.toEqual({ name: 'userinfo', data: { username: 'test' }, replied: true })
  expect(listeners.size).toBe(0)
})

it('rejects requests without a TownPass bridge', async () => {
  await expect(requestNative('location', null, { host: {} })).rejects.toMatchObject({ code: 'UNAVAILABLE' })
})

it('prevents overlapping requests and ignores unrelated replies', async () => {
  const { host, reply } = createHost()
  const pending = requestNative('location', null, { host })
  await expect(requestNative('userinfo', null, { host })).rejects.toMatchObject({ code: 'BUSY' })
  reply('deviceinfo', {})
  reply('location', false)
  await expect(pending).resolves.toMatchObject({ data: false, replied: true })
})

it('does not wait for methods with no success reply', async () => {
  const { host, listeners } = createHost()
  await expect(requestNative('open_link', 'https://www.gov.taipei/', { host })).resolves.toMatchObject({ replied: false })
  expect(listeners.size).toBe(0)
})

it('cleans up on timeout and cancellation', async () => {
  vi.useFakeTimers()
  const { host, listeners } = createHost()
  const timeout = expect(requestNative('location', null, { host, timeoutMs: 10 })).rejects.toMatchObject({ code: 'TIMEOUT' })
  await vi.advanceTimersByTimeAsync(10)
  await timeout
  expect(listeners.size).toBe(0)
  const controller = new AbortController()
  const cancelled = expect(requestNative('location', null, { host, signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' })
  controller.abort()
  await cancelled
  expect(listeners.size).toBe(0)
})
