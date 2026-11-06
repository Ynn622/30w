import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startVersionChecker } from './versionChecker.js'

let stop = () => {}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('DEV', false)
})

afterEach(() => {
  stop()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('checks immediately and every minute using the project base path', async () => {
  vi.stubEnv('BASE_URL', '/30w/')
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 'v1' }) })
  vi.stubGlobal('fetch', fetchMock)
  const onVersionMismatch = vi.fn()
  stop = startVersionChecker({ currentVersion: 'v1', onVersionMismatch })
  await vi.advanceTimersByTimeAsync(0)
  expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/30w\/version.json\?t=/), expect.objectContaining({ cache: 'no-store' }))
  await vi.advanceTimersByTimeAsync(59_999)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(onVersionMismatch).not.toHaveBeenCalled()
  stop()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('retries after network failures and reports a changed version only once', async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ ok: true, json: async () => ({ version: 'v2' }) })
  vi.stubGlobal('fetch', fetchMock)
  const onVersionMismatch = vi.fn()
  stop = startVersionChecker({ currentVersion: 'v1', onVersionMismatch })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onVersionMismatch).toHaveBeenCalledWith(expect.objectContaining({ currentVersion: 'v1', remoteVersion: 'v2' }))
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onVersionMismatch).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('ignores in-flight responses after cleanup', async () => {
  let resolveFetch
  vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve })))
  const onVersionMismatch = vi.fn()
  stop = startVersionChecker({ currentVersion: 'v1', onVersionMismatch })
  stop()
  resolveFetch({ ok: true, json: async () => ({ version: 'v2' }) })
  await vi.advanceTimersByTimeAsync(0)
  expect(onVersionMismatch).not.toHaveBeenCalled()
})
