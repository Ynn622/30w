import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNoiseSession, noiseSummary } from './noiseClient.js'
function harness() {
  const listeners = new Set()
  const host = { flutterObject: {
    postMessage: vi.fn(),
    addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn),
  } }
  const send = (name, data) => [...listeners].forEach(fn => fn({ data: JSON.stringify({ name, data: { protocolVersion: 1, ...data } }) }))
  return { host, send, listeners }
}
afterEach(() => vi.useRealTimers())
describe('native noise sessions', () => {
  it('rejects browser mode without fabricated noise values', () => {
    expect(() => createNoiseSession({ host: {} })).toThrow('Flutter')
  })
  it('isolates sessions, validates data, completes and cleans listeners', () => {
    const { host, send, listeners } = harness()
    const onStatus = vi.fn(), onSample = vi.fn()
    const session = createNoiseSession({ host, onStatus, onSample })
    send('noise_status', { sessionId: 'old-session', status: 'measuring' })
    expect(onStatus).not.toHaveBeenCalled()
    send('noise_status', { sessionId: session.sessionId, status: 'measuring' })
    send('noise_sample', { sessionId: session.sessionId, averageDbfs: 50, peakDbfs: 70, elapsedMs: 100 })
    send('noise_sample', { sessionId: session.sessionId, averageDbfs: -40, peakDbfs: -25, elapsedMs: 15000 })
    send('noise_sample', { sessionId: session.sessionId, averageDbfs: -35, peakDbfs: -20, elapsedMs: 15000 })
    expect(onSample).toHaveBeenCalledTimes(1)
    send('noise_status', { sessionId: session.sessionId, status: 'completed' })
    expect(onStatus.mock.lastCall[0]).toMatchObject({ status: 'completed', summary: { sampleCount: 1, averageDbfs: -40, unit: 'dBFS', calibrated: false } })
    expect(listeners.size).toBe(0)
    session.stop()
    expect(onStatus).toHaveBeenCalledTimes(2)
  })
  it('records observedAt when the App starts measuring, not while waiting for permission', () => {
    let time = Date.parse('2026-11-07T10:00:00Z')
    const { host, send } = harness()
    const onStatus = vi.fn()
    const session = createNoiseSession({ host, onStatus, now: () => time })
    expect(session.getStartedAt()).toBeNull()
    time += 8_000
    send('noise_status', { sessionId: session.sessionId, status: 'measuring' })
    expect(onStatus.mock.lastCall[0]).toEqual({ status: 'measuring', startedAt: '2026-11-07T10:00:08.000Z' })
    expect(session.getStartedAt()).toBe('2026-11-07T10:00:08.000Z')
    session.stop()
  })
  it('stops on denied permission and acknowledgement timeout', () => {
    vi.useFakeTimers()
    const { host, send, listeners } = harness()
    const onStatus = vi.fn()
    const session = createNoiseSession({ host, onStatus })
    send('noise_status', { sessionId: session.sessionId, status: 'denied' })
    expect(onStatus.mock.lastCall[0].status).toBe('denied')
    expect(listeners.size).toBe(0)
    createNoiseSession({ host, onStatus })
    vi.advanceTimersByTime(30_001)
    expect(onStatus.mock.lastCall[0].status).toBe('error')
    expect(listeners.size).toBe(0)
  })
  it('cleans up on explicit stop and missing sample completion', () => {
    const { host, send, listeners } = harness()
    const onStatus = vi.fn()
    let session = createNoiseSession({ host, onStatus })
    session.stop(); session.stop()
    expect(host.flutterObject.postMessage).toHaveBeenCalledTimes(2)
    expect(listeners.size).toBe(0)
    session = createNoiseSession({ host, onStatus })
    send('noise_status', { sessionId: session.sessionId, status: 'completed' })
    expect(onStatus.mock.lastCall[0].status).toBe('error')
    expect(listeners.size).toBe(0)
  })
  it('averages power rather than arithmetic decibels', () => {
    expect(noiseSummary([{ averageDbfs: -40, peakDbfs: -30, elapsedMs: 250 }, { averageDbfs: -20, peakDbfs: -10, elapsedMs: 500 }])).toMatchObject({ averageDbfs: -23, peakDbfs: -10, durationMs: 500 })
  })
})
