import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient.js'
import { createTestPlacesApi, validTestPlace } from './testPlacesApi.js'
import { testMetaFor, testPlaceFor } from './placeSources.fixture.js'

const ok = payload => vi.fn(async () => ({ data: payload }))

describe('test place scenario adapter (issue #7)', () => {
  it('requests test/places with only allowed keys and the scenario', async () => {
    const request = ok({ data: { places: [testPlaceFor()] }, meta: testMetaFor() })
    const result = await createTestPlacesApi({ request }).getPlaces({ areaId: 'shilin', lat: 25.1161, lng: 121.5349, radius: 1999.6, max: 100, scenario: 'weekday_day', noise: 'low', dayType: 'weekday' })
    expect(request).toHaveBeenCalledWith('test/places', { query: { areaId: 'shilin', lat: 25.1161, lng: 121.5349, radius: 2000, max: 100, scenario: 'weekday_day' }, signal: undefined })
    expect(request.mock.calls.flat().join(' ')).not.toContain('test/mock')
    expect(result.data.places).toHaveLength(1)
  })
  it('refuses unknown scenarios before calling the backend', async () => {
    const request = ok({})
    await expect(createTestPlacesApi({ request }).getPlaces({ scenario: 'holiday' })).rejects.toThrow('未知的場所情境')
    await expect(createTestPlacesApi({ request }).getPlace('p-1', 'night')).rejects.toThrow('未知的場所情境')
    expect(request).not.toHaveBeenCalled()
  })
  it('rejects payloads whose markers, version, scenario or observation fields do not match', async () => {
    const meta = testMetaFor()
    const cases = [
      { data: { places: [testPlaceFor()] }, meta: { ...meta, test: false } },
      { data: { places: [testPlaceFor()] }, meta: { ...meta, datasetVersion: 'tianmu-places-test-v1' } },
      { data: { places: [testPlaceFor()] }, meta: { ...meta, timeBasis: 'simulated_request_time' } },
      { data: { places: [testPlaceFor()] }, meta: { ...meta, scenario: 'weekend_day' } },
      { data: { places: [testPlaceFor({ observedAt: '2026-11-08T06:00:00Z' })] }, meta },
      { data: { places: [testPlaceFor({ sensoryIndex: { scoreVersion: 'ssi-v0.1' } })] }, meta },
      { data: { places: [testPlaceFor({ location: null })] }, meta },
    ]
    for (const payload of cases) await expect(createTestPlacesApi({ request: ok(payload) }).getPlaces({ scenario: 'weekday_day' })).rejects.toThrow('格式不符')
    expect(validTestPlace(testPlaceFor(), 'weekend_day')).toBe(false)
  })
  it('drops the placeholder tag and keeps real tags', async () => {
    const result = await createTestPlacesApi({ request: ok({ data: { places: [testPlaceFor({ tag: '場所情境測試' }), testPlaceFor({ id: 'p-2', tag: '樹蔭' })] }, meta: testMetaFor() }) }).getPlaces({ scenario: 'weekday_day' })
    expect(result.data.places.map(place => place.tag)).toEqual([null, '樹蔭'])
  })
  it('loads details with the scenario and checks the returned id', async () => {
    const request = ok({ data: testPlaceFor({ testData: { ...testPlaceFor().testData, scenario: 'weekend_day' } }), meta: testMetaFor('weekend_day') })
    await createTestPlacesApi({ request }).getPlace('p-1', 'weekend_day')
    expect(request).toHaveBeenCalledWith('test/places/p-1', { query: { scenario: 'weekend_day' }, signal: undefined })
    await expect(createTestPlacesApi({ request }).getPlace('other', 'weekend_day')).rejects.toThrow('編號不一致')
  })
  it('shows HTTP errors and passes cancellation through', async () => {
    for (const status of [400, 404, 429, 503]) {
      const request = vi.fn(async () => { throw new ApiError('x', { status }) })
      await expect(createTestPlacesApi({ request }).getPlaces({ scenario: 'weekday_day' })).rejects.toMatchObject({ name: 'TestPlacesError', status, message: expect.stringContaining(String(status)) })
    }
    const cancelled = new ApiError('請求已取消。', { code: 'CANCELLED' })
    await expect(createTestPlacesApi({ request: vi.fn(async () => { throw cancelled }) }).getPlace('p-1', 'weekday_day')).rejects.toBe(cancelled)
  })
})
