import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSensoryApi } from './sensoryApi.js'
import { AREAS, filterPlaces, isCoordinate, levelText, readPreferences } from './sensoryDomain.js'
import { demoPlaces, DEMO_TIME } from '../data/quietDemo.js'
afterEach(() => vi.useRealTimers())

describe('sensory data boundary', () => {
  it('uses explicit demo mode without network and includes provenance', async () => {
    const request = vi.fn()
    const api = createSensoryApi({ mode: 'demo', request })
    const result = await api.getPlaces({ ...AREAS[0], radius: 500, noise: 'low' })
    expect(result.meta.demo).toBe(true)
    expect(result.meta.updatedAt).toBe(DEMO_TIME)
    expect(result.data.places).toHaveLength(3)
    expect(request).not.toHaveBeenCalled()
  })
  it('never falls back to fake data on an API error', async () => {
    const api = createSensoryApi({ mode: 'api', request: vi.fn().mockRejectedValue(new Error('offline')) })
    await expect(api.getOverview({})).rejects.toThrow('offline')
  })
  it('rejects malformed successful responses', async () => {
    const api = createSensoryApi({ mode: 'api', request: vi.fn().mockResolvedValue({ data: {} }) })
    await expect(api.getMap({})).rejects.toThrow('格式不符')
  })
  it('checks live places again so stale and out-of-range API results cannot pass low-stimulus filters', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(DEMO_TIME))
    const places = demoPlaces()
    places[0].updatedAt = '2026-11-06T10:30:00+08:00'
    places[1].senses.noise = null
    const api = createSensoryApi({ mode: 'api', request: vi.fn().mockResolvedValue({ data: { data: { places }, meta: { demo: false, sources: [] } } }) })
    const result = await api.getPlaces({ ...AREAS[0], radius: 500, noise: 'low' })
    expect(result.data.places.map(place => place.id)).toEqual(['zhongzheng-hall'])
  })
  it('sends a report as POST only after valid location and kind', async () => {
    const request = vi.fn().mockResolvedValue({ data: { data: { accepted: true } } })
    const api = createSensoryApi({ mode: 'api', request })
    const body = { kind: 'noisy', location: { ...AREAS[0], source: 'manual' }, note: '' }
    await api.createReport(body)
    expect(request).toHaveBeenCalledWith('reports', { method: 'POST', body })
    await expect(api.createReport({ ...body, location: null })).rejects.toThrow('位置')
  })
  it('does not upload measurements without separate sharing consent', async () => {
    const request = vi.fn()
    const api = createSensoryApi({ mode: 'api', request })
    await expect(api.createMeasurement({ location: { ...AREAS[0], source: 'manual' }, consent: false })).rejects.toThrow('同意')
    expect(request).not.toHaveBeenCalled()
  })
})
describe('honest sensory values', () => {
  it('keeps zero valid and null or out of range unknown', () => {
    expect(levelText(0)).toBe('低')
    expect(levelText(null)).toBe('未知')
    expect(levelText(101)).toBe('未知')
    expect(isCoordinate({ lat: null, lng: 121 })).toBe(false)
    expect(isCoordinate({ lat: 91, lng: 121 })).toBe(false)
  })
  it('excludes unknown, stale and insufficient readings from low-stimulus filters', () => {
    const places = demoPlaces()
    places[0].senses.noise = null
    places[1].updatedAt = '2026-11-06T10:30:00+08:00'
    places[2].confidence = 'insufficient'
    expect(filterPlaces(places, { ...AREAS[0], radius: 500, noise: 'low' }, DEMO_TIME)).toEqual([])
  })
  it('respects radius, indoor and all selected preferences together', () => {
    expect(filterPlaces(demoPlaces(), { ...AREAS[0], radius: 300, indoor: true, light: 'low' }, DEMO_TIME)).toEqual([])
    expect(filterPlaces(demoPlaces(), { ...AREAS[0], radius: 500, indoor: true, light: 'low' }, DEMO_TIME)).toHaveLength(1)
  })
  it('restores only supported preferences and tolerates unavailable storage', () => {
    const restored = readPreferences({ getItem: () => '{"radius":3,"noise":"yes","shareMeasurement":true}' })
    expect(restored).toMatchObject({ radius: 500, noise: true })
    expect(restored).not.toHaveProperty('shareMeasurement')
    expect(readPreferences({ getItem: () => { throw new Error('blocked') } })).toMatchObject({ radius: 500 })
  })
})
