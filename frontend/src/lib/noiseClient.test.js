import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNoiseSession, measureFrame, microphoneSupport, noiseSummary, windowLevels } from './noiseClient.js'

function harness({ getUserMedia } = {}) {
  const track = { stop: vi.fn(), onended: null }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  let level = 0.1
  const analyser = { fftSize: 0, getFloatTimeDomainData: buffer => buffer.fill(level) }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const context = {
    state: 'running', onstatechange: null,
    createAnalyser: () => analyser,
    createMediaStreamSource: vi.fn(() => source),
    resume: vi.fn(async () => { context.state = 'running' }),
    close: vi.fn(async () => { context.state = 'closed' }),
  }
  function AudioContext() { return context }
  const media = getUserMedia || vi.fn(async () => stream)
  const host = { isSecureContext: true, AudioContext, navigator: { mediaDevices: { getUserMedia: media } } }
  return { host, track, stream, context, source, media, setLevel: value => { level = value } }
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(Date.parse('2026-11-07T10:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('web microphone noise sessions', () => {
  it('refuses unsupported or insecure environments without fabricated values', () => {
    expect(() => createNoiseSession({ host: {} })).toThrow('不支援麥克風')
    const { host } = harness()
    expect(() => createNoiseSession({ host: { ...host, isSecureContext: false } })).toThrow('HTTPS')
    expect(microphoneSupport(host).supported).toBe(true)
  })
  it('measures on device, completes with a power-averaged summary and releases the microphone', async () => {
    const { host, track, context, source, media } = harness()
    const onStatus = vi.fn(), onSample = vi.fn()
    createNoiseSession({ host, onStatus, onSample })
    expect(media).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(onStatus).toHaveBeenLastCalledWith({ status: 'measuring', startedAt: '2026-11-07T10:00:00.000Z' })
    expect(source.connect).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(onSample).toHaveBeenCalledTimes(60)
    expect(onSample.mock.calls[0][0]).toEqual({ averageDbfs: -20, peakDbfs: -20, elapsedMs: 250 })
    expect(onStatus.mock.lastCall[0]).toMatchObject({ status: 'completed', summary: { sampleCount: 60, averageDbfs: -20, peakDbfs: -20, durationMs: 15_000, unit: 'dBFS', calibrated: false } })
    expect(track.stop).toHaveBeenCalled()
    expect(context.close).toHaveBeenCalled()
  })
  it('records observedAt when measuring starts, not while waiting for permission', async () => {
    let grant
    const { host, stream } = harness({ getUserMedia: () => new Promise(resolve => { grant = resolve }) })
    const onStatus = vi.fn()
    const session = createNoiseSession({ host, onStatus })
    expect(session.getStartedAt()).toBeNull()
    await vi.advanceTimersByTimeAsync(8_000)
    grant(stream)
    await vi.advanceTimersByTimeAsync(0)
    expect(onStatus.mock.lastCall[0]).toEqual({ status: 'measuring', startedAt: '2026-11-07T10:00:08.000Z' })
    session.stop()
  })
  it('reports denied permission and permission timeout', async () => {
    const denied = harness({ getUserMedia: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })) })
    const onStatus = vi.fn()
    createNoiseSession({ host: denied.host, onStatus })
    await vi.advanceTimersByTimeAsync(0)
    expect(onStatus.mock.lastCall[0]).toMatchObject({ status: 'denied', summary: null })
    expect(denied.context.close).toHaveBeenCalled()
    const pending = harness({ getUserMedia: () => new Promise(() => {}) })
    createNoiseSession({ host: pending.host, onStatus })
    await vi.advanceTimersByTimeAsync(30_001)
    expect(onStatus.mock.lastCall[0].status).toBe('error')
  })
  it('stops tracks granted after the user already cancelled', async () => {
    let grant
    const { host, stream, track } = harness({ getUserMedia: () => new Promise(resolve => { grant = resolve }) })
    const onStatus = vi.fn()
    const session = createNoiseSession({ host, onStatus })
    session.stop(); session.stop()
    expect(onStatus).toHaveBeenCalledTimes(1)
    expect(onStatus.mock.lastCall[0].status).toBe('stopped')
    grant(stream)
    await vi.advanceTimersByTimeAsync(0)
    expect(track.stop).toHaveBeenCalled()
    expect(onStatus).toHaveBeenCalledTimes(1)
  })
  it('ends without a summary when the system interrupts the microphone', async () => {
    const { host, track } = harness()
    const onStatus = vi.fn()
    createNoiseSession({ host, onStatus })
    await vi.advanceTimersByTimeAsync(3_000)
    track.onended()
    expect(onStatus.mock.lastCall[0]).toMatchObject({ status: 'error', summary: null })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(onStatus.mock.lastCall[0].status).toBe('error')
  })
  it('keeps silence as a valid -160 dBFS sample', async () => {
    const { host, setLevel } = harness()
    setLevel(0)
    const onSample = vi.fn()
    const session = createNoiseSession({ host, onSample })
    await vi.advanceTimersByTimeAsync(300)
    expect(onSample.mock.calls[0][0]).toMatchObject({ averageDbfs: -160, peakDbfs: -160 })
    session.stop()
  })
  it('averages power rather than arithmetic decibels', () => {
    expect(noiseSummary([{ averageDbfs: -40, peakDbfs: -30, elapsedMs: 250 }, { averageDbfs: -20, peakDbfs: -10, elapsedMs: 500 }])).toMatchObject({ averageDbfs: -23, peakDbfs: -10, durationMs: 500 })
    expect(measureFrame(new Float32Array([0.5, -0.5]))).toEqual({ meanSquare: 0.25, peak: 0.5 })
    expect(windowLevels([{ meanSquare: 0.0001, peak: 0.01 }, { meanSquare: 0.01, peak: 0.1 }])).toEqual({ averageDbfs: -23, peakDbfs: -20 })
  })
})
