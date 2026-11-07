import { describe, expect, it } from 'vitest'
import { createReportDraft, measurementPayload } from './sensorySubmission.js'

const manual = { lat: 25.0386, lng: 121.5143, source: 'manual', areaId: 'zhongzheng', label: '中正區手動區域中心' }
const device = { lat: 25.05, lng: 121.55, source: 'device', areaId: 'zhongzheng', label: '目前位置' }

describe('report retry draft', () => {
  it('reuses the frozen payload when the same event is resent after a lost response', () => {
    let time = Date.parse('2026-11-07T10:00:00Z')
    const draft = createReportDraft(() => time)
    const first = draft.take({ kind: 'noisy', note: '施工', location: manual, intensity: 'high' })
    time += 30_000
    const retry = draft.take({ kind: 'noisy', note: '施工', location: { ...manual }, intensity: 'high' })
    expect(retry).toBe(first)
    expect(retry.observedAt).toBe('2026-11-07T10:00:00.000Z')
    expect(Object.isFrozen(retry.location)).toBe(true)
  })
  it('treats changed note, intensity or location as a new event', () => {
    let time = 0
    const draft = createReportDraft(() => (time += 1000))
    const first = draft.take({ kind: 'noisy', note: '', location: manual })
    expect(first).not.toHaveProperty('intensity')
    for (const inputs of [{ kind: 'noisy', note: '吵', location: manual }, { kind: 'noisy', note: '吵', location: device }, { kind: 'noisy', note: '吵', location: device, intensity: 'low' }]) {
      const next = draft.take(inputs)
      expect(next).not.toBe(first)
      expect(next.observedAt).not.toBe(first.observedAt)
    }
  })
  it('includes quick tags, persistence and setting only when chosen, and treats changing them as a new event', () => {
    let time = 0
    const draft = createReportDraft(() => (time += 1000))
    const plain = draft.take({ kind: 'noisy', note: '', location: device, tags: undefined, persistence: undefined, setting: undefined })
    for (const key of ['tags', 'persistence', 'setting']) expect(plain).not.toHaveProperty(key)
    const detailed = draft.take({ kind: 'noisy', note: '', location: device, tags: ['construction'], persistence: 'ended', setting: 'outdoor' })
    expect(detailed).toMatchObject({ tags: ['construction'], persistence: 'ended', setting: 'outdoor' })
    expect(detailed.observedAt).not.toBe(plain.observedAt)
    expect(draft.take({ kind: 'noisy', note: '', location: device, tags: [], persistence: 'ended', setting: 'outdoor' })).not.toHaveProperty('tags')
  })
  it('starts a new event after a successful submission is cleared', () => {
    let time = 0
    const draft = createReportDraft(() => (time += 1000))
    const inputs = { kind: 'quiet', note: '', location: manual }
    const first = draft.take(inputs)
    draft.clear()
    expect(draft.take(inputs).observedAt).not.toBe(first.observedAt)
  })
})

describe('measurement payload', () => {
  it('binds the session snapshot instead of later location changes', () => {
    const location = { ...device }
    const payload = measurementPayload({ sessionId: 's1', location, observedAt: '2026-11-07T10:00:00.000Z', summary: { sampleCount: 60, averageDbfs: -40, unit: 'dBFS', calibrated: false } })
    location.lat = 0
    expect(payload).toMatchObject({ protocolVersion: 1, sessionId: 's1', source: 'web_microphone', consent: true, observedAt: '2026-11-07T10:00:00.000Z', sampleCount: 60, location: { lat: 25.05 } })
    expect(Object.isFrozen(payload)).toBe(true)
  })
})
