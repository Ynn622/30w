import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient.js'
import { createTianmuMockPlacesApi, validTianmuMeta } from './tianmuApi.js'

const META = { mock: true, demo: true, mode: 'test-only', datasetVersion: 'tianmu-places-mock-v1', dataBasis: 'reviewed_public_place_snapshot', notice: '天母2公里公開場所靜態Mock' }
const PLACE = { id: 'f7e31d9b-44b0-404d-8d25-b8eaee315556', name: '天福綠地', address: '天母東路22巷23號對面', location: { lat: 25.1185, lng: 121.5329 }, senses: { noise: null, light: null, crowd: null, odor: null }, confidence: 'insufficient', image: null, photo: null }
const ok = payload => vi.fn(async () => ({ data: payload }))

describe('Tianmu place snapshot adapter (issue #7)', () => {
  it('sends only accepted query keys and returns the places with their meta', async () => {
    const request = ok({ data: { places: [PLACE] }, meta: META })
    const result = await createTianmuMockPlacesApi({ request }).getPlaces({ areaId: 'shilin', lat: 25.1145, lng: 121.5352, radius: 1234.6, max: 100, noise: 'low', dayType: 'weekday', source: 'tianmu' })
    expect(request).toHaveBeenCalledWith('test/mock/tianmu/places', { query: { areaId: 'shilin', lat: 25.1145, lng: 121.5352, radius: 1235, max: 100 }, signal: undefined })
    expect(result.data.places).toEqual([PLACE])
    expect(result.meta.dataBasis).toBe('reviewed_public_place_snapshot')
  })
  it('rejects responses that are not the reviewed public snapshot', async () => {
    for (const meta of [{ ...META, datasetVersion: 'other' }, { ...META, dataBasis: 'fictional' }, { ...META, mode: 'live' }, { ...META, mock: false }]) {
      await expect(createTianmuMockPlacesApi({ request: ok({ data: { places: [PLACE] }, meta }) }).getPlaces()).rejects.toThrow('格式不符')
    }
    await expect(createTianmuMockPlacesApi({ request: ok({ data: { places: [{ ...PLACE, location: null }] }, meta: META }) }).getPlaces()).rejects.toThrow('格式不符')
    expect(validTianmuMeta(META)).toBe(true)
  })
  it('loads a detail without a query and keeps the requested id for aliases', async () => {
    const request = ok({ data: { ...PLACE, id: 'alias-1', canonicalId: PLACE.id }, meta: META })
    const result = await createTianmuMockPlacesApi({ request }).getPlace('alias-1')
    expect(request).toHaveBeenCalledWith('test/mock/tianmu/places/alias-1', { signal: undefined })
    expect(result.data).toMatchObject({ id: 'alias-1', canonicalId: PLACE.id })
    await expect(createTianmuMockPlacesApi({ request }).getPlace('other')).rejects.toThrow('編號不一致')
  })
  it('reports 400/404/429/503 without falling back and passes cancellation through', async () => {
    for (const status of [400, 404, 429, 503]) {
      const request = vi.fn(async () => { throw new ApiError('HTTP', { status, code: 'HTTP_ERROR' }) })
      await expect(createTianmuMockPlacesApi({ request }).getPlaces()).rejects.toMatchObject({ name: 'TianmuDataError', status, message: expect.stringContaining(String(status)) })
    }
    const cancelled = new ApiError('取消', { code: 'CANCELLED' })
    await expect(createTianmuMockPlacesApi({ request: vi.fn(async () => { throw cancelled }) }).getPlace(PLACE.id)).rejects.toBe(cancelled)
  })
})

describe('Tianmu place tags', () => {
  it('drops the backend placeholder tag 靜態Mock場地 from lists and details but keeps real tags', async () => {
    const list = await createTianmuMockPlacesApi({ request: ok({ data: { places: [{ ...PLACE, tag: '靜態Mock場地' }, { ...PLACE, id: 'p2', tag: '樹蔭' }] }, meta: META }) }).getPlaces()
    expect(list.data.places.map(place => place.tag)).toEqual([null, '樹蔭'])
    const detail = await createTianmuMockPlacesApi({ request: ok({ data: { ...PLACE, tag: '靜態Mock場地' }, meta: META }) }).getPlace(PLACE.id)
    expect(detail.data.tag).toBeNull()
  })
})
