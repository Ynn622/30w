import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient.js'
import { createHourlyApi, cropGrid, slotLabel, taipeiSlot, validHourlyMeta, validHourlyOverview, validHourlyPoint } from './hourlyApi.js'
import { hourlyMetaFor, hourlyOverviewFor, hourlyPayloadFor, hourlyPointFor, hourlyPointsFor } from './hourlyApi.fixture.js'

const ok = payload => vi.fn(async () => ({ data: payload }))
const SLOT = { dayType: 'weekday', hour: 8 }

describe('hourly test grid adapter (issues #5, #8)', () => {
  it('requests the whole slot from test/hourly, never the retired test/mock routes', async () => {
    const request = ok(hourlyPayloadFor())
    const result = await createHourlyApi({ request }).getGrid({ ...SLOT, radius: 1500, scenario: 'weekday_day' })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('test/hourly', { query: { dayType: 'weekday', hour: 8, limit: 30000, offset: 0 }, signal: undefined })
    expect(request.mock.calls.flat().join(' ')).not.toContain('test/mock')
    expect(result.data.points).toHaveLength(5)
    expect(result.data.total).toBe(5)
    expect(result.meta.simulatedAt).toBe('2026-11-07T19:00:26.660Z')
  })
  it('follows nextOffset until every page is loaded and keeps the latest simulated time', async () => {
    const points = hourlyPointsFor()
    const request = vi.fn()
      .mockResolvedValueOnce({ data: hourlyPayloadFor(SLOT, points.slice(0, 3), { total: 5, nextOffset: 3 }) })
      .mockResolvedValueOnce({ data: { ...hourlyPayloadFor(SLOT, points.slice(3), { total: 5, offset: 3 }), meta: hourlyMetaFor({ ...SLOT, simulatedAt: '2026-11-07T19:00:30.000Z' }) } })
    const result = await createHourlyApi({ request }).getGrid(SLOT)
    expect(request.mock.calls.map(call => call[1].query.offset)).toEqual([0, 3])
    expect(result.data.points.map(point => point.id)).toEqual(points.map(point => point.id))
    expect(result.meta.simulatedAt).toBe('2026-11-07T19:00:30.000Z')
  })
  it('rejects incomplete or inconsistent pages', async () => {
    const short = ok(hourlyPayloadFor(SLOT, hourlyPointsFor().slice(0, 2), { total: 5 }))
    await expect(createHourlyApi({ request: short }).getGrid(SLOT)).rejects.toThrow('筆數不完整')
    const looping = ok(hourlyPayloadFor(SLOT, hourlyPointsFor(), { nextOffset: 0 }))
    await expect(createHourlyApi({ request: looping }).getGrid(SLOT)).rejects.toThrow('分頁不一致')
  })
  it('rejects responses whose version, slot, ids, coordinates or scores do not match', async () => {
    const cases = [
      { ...hourlyPayloadFor(), meta: { ...hourlyMetaFor(), datasetVersion: 'taipei-hourly-grid-v3' } },
      { ...hourlyPayloadFor(), meta: { ...hourlyMetaFor(), demo: false } },
      { ...hourlyPayloadFor(), meta: hourlyMetaFor({ hour: 9 }) },
      { ...hourlyPayloadFor(), meta: hourlyMetaFor({ dayType: 'weekend' }) },
      hourlyPayloadFor(SLOT, [hourlyPointFor({ id: '147df5ff-68a7-530b-b9d2-8355bf25f71e' })]),
      hourlyPayloadFor(SLOT, [hourlyPointFor({ location: { lat: 'x', lng: 121.5 } })]),
      hourlyPayloadFor(SLOT, [hourlyPointFor({ senses: { noise: 101, light: 1, crowd: 1, odor: 1 } })]),
      hourlyPayloadFor(SLOT, [hourlyPointFor({ senses: { noise: 1.5, light: 1, crowd: 1, odor: 1 } })]),
      hourlyPayloadFor(SLOT, [hourlyPointFor({ coordinateKind: 'facility_reference_point' })]),
      hourlyPayloadFor(SLOT, [hourlyPointFor({ sound: { value: 50, unit: 'dB' } })]),
      { data: { cells: [] }, meta: hourlyMetaFor() },
      // #8：必須是 meta.test 與 v2 資料集，模型與噪音對照版本也要一致；舊 meta.mock／v1 不再接受。
      { ...hourlyPayloadFor(), meta: (({ test, ...meta }) => ({ ...meta, mock: true }))(hourlyMetaFor()) },
      { ...hourlyPayloadFor(), meta: { ...hourlyMetaFor(), datasetVersion: 'taipei-hourly-grid-v1' } },
      { ...hourlyPayloadFor(), meta: { ...hourlyMetaFor(), modelVersion: 'taipei-hourly-grid-v2' } },
      { ...hourlyPayloadFor(), meta: { ...hourlyMetaFor(), noiseMapping: { version: 'other' } } },
    ]
    for (const payload of cases) await expect(createHourlyApi({ request: ok(payload) }).getGrid(SLOT)).rejects.toThrow('測試網格格式不符')
  })
  it('keeps null as unknown instead of turning it into zero', () => {
    const point = hourlyPointsFor()[3]
    expect(validHourlyPoint(point)).toBe(true)
    expect(point.senses).toEqual({ noise: null, light: null, crowd: null, odor: null })
    expect(validHourlyMeta(hourlyMetaFor(), SLOT)).toBe(true)
  })
  it('refuses unknown slots before calling the backend', async () => {
    const request = ok(hourlyPayloadFor())
    for (const slot of [{ dayType: 'holiday', hour: 8 }, { dayType: 'weekday', hour: 24 }, { dayType: 'weekday', hour: '8' }]) {
      await expect(createHourlyApi({ request }).getGrid(slot)).rejects.toThrow('未知的測試時段')
    }
    expect(request).not.toHaveBeenCalled()
  })
  it('shows 400/404/429/503 as visible messages instead of falling back to built-in mock data', async () => {
    for (const [status, text] of [[400, '400'], [404, '404'], [429, '429'], [503, '503']]) {
      const request = vi.fn(async () => { throw new ApiError('HTTP', { status, code: 'HTTP_ERROR' }) })
      await expect(createHourlyApi({ request }).getGrid(SLOT)).rejects.toMatchObject({ name: 'HourlyDataError', status, message: expect.stringContaining(text) })
    }
  })
  it('passes cancellation through untouched', async () => {
    const cancelled = new ApiError('取消', { code: 'CANCELLED' })
    await expect(createHourlyApi({ request: vi.fn(async () => { throw cancelled }) }).getGrid(SLOT)).rejects.toBe(cancelled)
  })
})

describe('hourly helpers', () => {
  it('crops the grid to the map range around the search center', () => {
    const ids = cropGrid(hourlyPointsFor(), { lat: 25.0336, lng: 121.5363 }, 500).map(point => point.id)
    expect(ids).toEqual(['tg07270', 'tg07271', 'tg07272', 'tg07273'])
    expect(cropGrid(hourlyPointsFor(), null, 500)).toEqual([])
  })
  it('labels slots and picks the Taipei weekday and hour as the default', () => {
    expect(slotLabel({ dayType: 'weekend', hour: 20 })).toBe('週末 20:00')
    expect(slotLabel({ dayType: 'x', hour: 1 })).toBe('未選擇時段')
    // 2026-11-07（週六）19:00Z = 臺北 11-08（週日）03:00。
    expect(taipeiSlot(Date.parse('2026-11-07T19:00:00Z'))).toEqual({ dayType: 'weekend', hour: 3 })
    expect(taipeiSlot(Date.parse('2026-11-09T01:30:00Z'))).toEqual({ dayType: 'weekday', hour: 9 })
  })
})

describe('home test overview adapter (issues #6, #8)', () => {
  it('sends only lat and lng to test/overview', async () => {
    const request = ok(hourlyOverviewFor())
    const result = await createHourlyApi({ request }).getOverview({ test: true, lat: 25.0333, lng: 121.5358, areaId: 'daan', radius: 500, dayType: 'weekday', hour: 8 })
    expect(request).toHaveBeenCalledWith('test/overview', { query: { lat: 25.0333, lng: 121.5358 }, signal: undefined })
    expect(result.data.senses.noise).toBe(26.6)
    expect(result.data).toMatchObject({ dayType: 'weekend', hour: 3, pointCount: 9 })
  })
  it('accepts decimals, zero, partial nulls and an empty circle', () => {
    expect(validHourlyOverview(hourlyOverviewFor({ senses: { noise: 0, light: 0.5, crowd: null, odor: 100 }, validPointCounts: { noise: 3, light: 3, crowd: 0, odor: 3 } }))).toBe(true)
    expect(validHourlyOverview(hourlyOverviewFor({ senses: { noise: null, light: null, crowd: null, odor: null }, pointCount: 0, validPointCounts: { noise: 0, light: 0, crowd: 0, odor: 0 } }))).toBe(true)
  })
  it('rejects payloads whose version, radius, slot, scores, counts or confidence do not match', async () => {
    const base = hourlyOverviewFor()
    const cases = [
      { ...base, meta: { ...base.meta, aggregationVersion: 'v2' } },
      { ...base, meta: { ...base.meta, mode: 'live' } },
      { ...base, meta: { ...base.meta, test: false } },
      { ...base, meta: { ...base.meta, datasetVersion: 'taipei-hourly-grid-v1' } },
      { ...base, data: { ...base.data, radiusMeters: 200 } },
      { ...base, data: { ...base.data, hour: 4 } },
      { ...base, data: { ...base.data, senses: { ...base.data.senses, noise: 100.5 } } },
      { ...base, data: { ...base.data, validPointCounts: { ...base.data.validPointCounts, odor: 10 } } },
      { ...base, data: { ...base.data, confidence: 'insufficient' } },
      { ...base, data: { ...base.data, observedAt: '2026-11-07T19:00:00Z' } },
      { ...base, data: { ...base.data, reportCount: 3 } },
      { ...base, data: { ...base.data, missingReason: 'other' } },
    ]
    for (const payload of cases) await expect(createHourlyApi({ request: ok(payload) }).getOverview({ lat: 25.0333, lng: 121.5358 })).rejects.toThrow('測試平均格式不符')
  })
  it('refuses an invalid location, reports HTTP errors and passes cancellation through', async () => {
    const request = ok(hourlyOverviewFor())
    await expect(createHourlyApi({ request }).getOverview({ lat: null, lng: 121.5 })).rejects.toThrow('目前位置無效')
    expect(request).not.toHaveBeenCalled()
    for (const status of [400, 403, 429, 503]) {
      const failing = vi.fn(async () => { throw new ApiError('HTTP', { status, code: 'HTTP_ERROR' }) })
      await expect(createHourlyApi({ request: failing }).getOverview({ lat: 25.0333, lng: 121.5358 })).rejects.toMatchObject({ name: 'HourlyDataError', status, message: expect.stringContaining(String(status)) })
    }
    const cancelled = new ApiError('取消', { code: 'CANCELLED' })
    await expect(createHourlyApi({ request: vi.fn(async () => { throw cancelled }) }).getOverview({ lat: 25.0333, lng: 121.5358 })).rejects.toBe(cancelled)
  })
})
