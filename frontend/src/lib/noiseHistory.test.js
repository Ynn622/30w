import { describe, expect, it } from 'vitest'
import { NOISE_HISTORY_KEY, NOISE_HISTORY_LIMIT, createNoiseEntry, perceptionLabel, readNoiseHistory, saveNoiseEntry } from './noiseHistory.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return { getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = value }, data }
}
const summary = { sampleCount: 60, averageDbfs: -42.5, peakDbfs: -21, durationMs: 15_000, unit: 'dBFS', calibrated: false }
const entry = (id, minute, extra = {}) => createNoiseEntry({ sessionId: id, measuredAt: `2026-11-07T10:${String(minute).padStart(2, '0')}:00.000Z`, summary, locationLabel: '目前位置（中正區）', ...extra })

describe('local noise history', () => {
  it('stores summaries without coordinates and replaces the same session when perception is added', () => {
    const storage = memoryStorage()
    let { history, saved } = saveNoiseEntry([], entry('a', 1), storage)
    expect(saved).toBe(true)
    expect(history[0]).toEqual({ id: 'a', measuredAt: '2026-11-07T10:01:00.000Z', averageDbfs: -42.5, peakDbfs: -21, sampleCount: 60, durationMs: 15_000, locationLabel: '目前位置（中正區）', perception: null })
    history = saveNoiseEntry(history, { ...history[0], perception: 'noisy' }, storage).history
    expect(history).toHaveLength(1)
    expect(readNoiseHistory(storage)[0].perception).toBe('noisy')
    expect(perceptionLabel('noisy')).toBe('吵雜')
  })
  it('keeps the newest entries within the limit and ignores corrupted storage', () => {
    let history = []
    for (let minute = 0; minute < NOISE_HISTORY_LIMIT + 5; minute++) history = saveNoiseEntry(history, entry(`s${minute}`, minute), null).history
    expect(history).toHaveLength(NOISE_HISTORY_LIMIT)
    expect(history[0].id).toBe(`s${NOISE_HISTORY_LIMIT + 4}`)
    expect(readNoiseHistory(memoryStorage({ [NOISE_HISTORY_KEY]: 'not json' }))).toEqual([])
    expect(readNoiseHistory(memoryStorage({ [NOISE_HISTORY_KEY]: JSON.stringify([{ id: 'x', averageDbfs: 5 }, entry('ok', 3)]) })).map(item => item.id)).toEqual(['ok'])
  })
  it('reports when storage is unavailable but keeps the list in memory', () => {
    const result = saveNoiseEntry([], entry('a', 1, { perception: 'bogus' }), null)
    expect(result).toMatchObject({ saved: false, history: [{ id: 'a', perception: null }] })
  })
})
