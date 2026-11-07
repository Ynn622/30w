import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient.js'
import { assessMockPlace, createMockApi, mockPhotoUrl, rankMockPlaces, validMockMeta, validMockPlace } from './mockApi.js'
import { CLOSED_ID, DAAN_ID, DAAN_PHOTO, PLAIN_ID, UNKNOWN_ID, mockMetaFor, mockPayloadFor, mockPlaceFor, mockPlacesFor } from './mockApi.fixture.js'

const ok = payload => vi.fn(async () => ({ data: payload }))

describe('mock API adapter (issue #4)', () => {
  it('sends only the scenario, validates the whole response and keeps the point map', async () => {
    const request = ok(mockPayloadFor('weekday_evening'))
    const result = await createMockApi({ request }).getPlaces({ scenario: 'weekday_evening', radius: 1500, max: 100 })
    expect(request).toHaveBeenCalledWith('test/mock/places', { query: { scenario: 'weekday_evening' }, signal: undefined })
    expect(result.data.places).toHaveLength(4)
    expect(result.data.map.features[0].geometry.type).toBe('Point')
    expect(result.meta.mode).toBe('test-only')
  })
  it('rejects responses whose version, scenario, ids, scores, noise or point map do not match', async () => {
    const cases = [
      { ...mockPayloadFor(), meta: { ...mockMetaFor(), datasetVersion: 'taipei-sensory-mock-v2' } },
      { ...mockPayloadFor(), meta: { ...mockMetaFor(), mapping: { version: 'other' } } },
      mockPayloadFor('weekend_day').data && { data: mockPayloadFor('weekend_day').data, meta: mockMetaFor('weekday_day') },
      mockPayloadFor('weekday_day', [mockPlaceFor({ id: 'not-a-uuid' })]),
      mockPayloadFor('weekday_day', [mockPlaceFor({ senses: { noise: null, light: 101, crowd: 1, odor: 1 } })]),
      mockPayloadFor('weekday_day', [mockPlaceFor({ senses: { noise: 40, light: 1, crowd: 1, odor: 1 } })]),
      mockPayloadFor('weekday_day', [mockPlaceFor({ openStatus: 'busy' })]),
      mockPayloadFor('weekday_day', [mockPlaceFor({ photo: { ...DAAN_PHOTO, url: 'https://evil.example/x.jpg' } })]),
      { data: { ...mockPayloadFor().data, map: { type: 'FeatureCollection', features: [{ id: PLAIN_ID, geometry: { type: 'Polygon', coordinates: [] } }] } }, meta: mockMetaFor() },
    ]
    for (const payload of cases) await expect(createMockApi({ request: ok(payload) }).getPlaces({ scenario: 'weekday_day' })).rejects.toThrow('測試資料格式不符')
  })
  it('refuses unknown scenarios before calling the backend', async () => {
    const request = ok(mockPayloadFor())
    await expect(createMockApi({ request }).getPlaces({ scenario: 'holiday' })).rejects.toThrow('未知的測試情境')
    expect(request).not.toHaveBeenCalled()
  })
  it('turns 400/404/429/503 into visible messages instead of falling back to built-in mock data', async () => {
    for (const [status, text] of [[400, '400'], [404, '404'], [429, '429'], [503, '503']]) {
      const request = vi.fn(async () => { throw new ApiError('HTTP', { status, code: 'HTTP_ERROR' }) })
      await expect(createMockApi({ request }).getPlaces({ scenario: 'weekday_day' })).rejects.toMatchObject({ name: 'MockDataError', status, message: expect.stringContaining(text) })
    }
  })
  it('passes cancellation through untouched', async () => {
    const cancelled = new ApiError('取消', { code: 'CANCELLED' })
    const api = createMockApi({ request: vi.fn(async () => { throw cancelled }) })
    await expect(api.getPlaces({ scenario: 'weekday_day' })).rejects.toBe(cancelled)
  })
  it('loads a detail with the same UUID and scenario and rejects a mismatched id', async () => {
    const request = ok({ data: mockPlaceFor({ id: DAAN_ID, photo: DAAN_PHOTO }), meta: mockMetaFor() })
    const result = await createMockApi({ request }).getPlace(DAAN_ID, { scenario: 'weekday_day' })
    expect(request).toHaveBeenCalledWith(`test/mock/places/${DAAN_ID}`, { query: { scenario: 'weekday_day' }, signal: undefined })
    expect(result.data.id).toBe(DAAN_ID)
    await expect(createMockApi({ request }).getPlace(PLAIN_ID, { scenario: 'weekday_day' })).rejects.toThrow('編號不一致')
    await expect(createMockApi({ request }).getPlace('../places', { scenario: 'weekday_day' })).rejects.toThrow('編號不正確')
  })
  it('validates meta and places independently', () => {
    expect(validMockMeta(mockMetaFor('weekend_day'), 'weekend_day')).toBe(true)
    expect(validMockMeta({ ...mockMetaFor(), mock: false }, 'weekday_day')).toBe(false)
    expect(validMockPlace(mockPlaceFor(), 'weekday_day')).toBe(true)
    expect(validMockPlace(mockPlaceFor({ sound: { value: 50, unit: 'dB', low: 1, high: 2 } }), 'weekday_day')).toBe(false)
  })
})

describe('mock photos', () => {
  it('resolves only the exact test photo path against the API origin', () => {
    const place = mockPlaceFor({ id: DAAN_ID, photo: DAAN_PHOTO })
    expect(mockPhotoUrl(place, 'https://30wbackend.idfc.dev/api/v1')).toBe(`https://30wbackend.idfc.dev/api/v1/test/mock/places/${DAAN_ID}/photo`)
    expect(mockPhotoUrl({ ...place, photo: { ...DAAN_PHOTO, url: `/api/v1/test/mock/places/${PLAIN_ID}/photo` } }, 'https://30wbackend.idfc.dev/api/v1')).toBeNull()
    expect(mockPhotoUrl({ ...place, photo: { ...DAAN_PHOTO, url: `https://evil.example/api/v1/test/mock/places/${DAAN_ID}/photo` } }, 'https://30wbackend.idfc.dev/api/v1')).toBeNull()
    expect(mockPhotoUrl(mockPlaceFor(), 'https://30wbackend.idfc.dev/api/v1')).toBeNull()
  })
})

describe('synthetic quiet score and ranking', () => {
  it('weights only light, crowd and odor, ignores sound and gives no score to closed or unknown places', () => {
    const open = assessMockPlace(mockPlaceFor({ senses: { noise: null, light: 60, crowd: 0, odor: 0 } }), { noise: 5, light: 1, crowd: 1, odor: 2 })
    expect(open).toMatchObject({ quiet: 85, available: 3, dimensions: { noise: null, light: 60 } })
    expect(assessMockPlace(mockPlaceFor({ openStatus: 'closed' })).quiet).toBeNull()
    expect(assessMockPlace(mockPlaceFor({ openStatus: 'unknown' })).quiet).toBeNull()
    const partial = assessMockPlace(mockPlaceFor({ openStatus: 'partial', senses: { noise: null, light: null, crowd: 40, odor: null } }))
    expect(partial).toMatchObject({ quiet: 60, available: 1, dimensions: { light: null, odor: null } })
    expect(assessMockPlace(mockPlaceFor({ senses: { noise: null, light: null, crowd: null, odor: null } })).quiet).toBeNull()
  })
  it('keeps closed and unknown places but lists them last', () => {
    const places = mockPlacesFor().map((place, index) => ({ ...place, distanceM: [100, 300, 10, 20][index], mockAssessment: assessMockPlace(place) }))
    expect(rankMockPlaces(places, 'distance').map(place => place.id)).toEqual([DAAN_ID, PLAIN_ID, CLOSED_ID, UNKNOWN_ID])
    expect(rankMockPlaces(places, 'fit').map(place => place.id)).toEqual([PLAIN_ID, DAAN_ID, CLOSED_ID, UNKNOWN_ID])
  })
})
