import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient.js'
import { HISTORY_PATH, createHistoryApi, personalizeHistory, validHistory } from './historyApi.js'
import HistoryChart from '../components/quiet/HistoryChart.vue'

// 依 Ynn622/30w_backend#19 規格的回應樣本。
function historyPayloadFor({ dayType = 'weekday', slots, meta = {}, data = {} } = {}) {
  return {
    data: {
      location: { lat: 25.1161, lng: 121.5349 }, dayType, radiusMeters: 150, stepHours: 3, missingReason: null,
      slots: slots ?? [0, 3, 6, 9, 12, 15, 18, 21].map(hour => ({ startHour: hour, endHour: hour + 3, senses: { noise: 20 + hour, light: 10, crowd: hour * 2, odor: 5.5 }, pointCount: 9 })),
      ...data,
    },
    meta: {
      test: true, demo: true, mode: 'test-only', datasetVersion: 'taipei-hourly-grid-v2', modelVersion: 'taipei-hourly-grid-v1',
      aggregationVersion: 'history-3h-radius-mean-v1', timeBasis: 'typical_day', noiseMapping: { version: 'test-noise-linear-v2', inputMin: 35, inputMax: 100 }, sources: [],
      ...meta,
    },
  }
}
const ok = payload => vi.fn(async () => ({ data: payload }))
const QUERY = { lat: 25.1161, lng: 121.5349, dayType: 'weekday' }

describe('personal history adapter (Ynn622/30w_backend#19)', () => {
  it('posts only lat, lng and dayType to test/history', async () => {
    expect(HISTORY_PATH).toBe('test/history')
    const request = ok(historyPayloadFor({ dayType: 'weekend' }))
    const result = await createHistoryApi({ request }).getHistory({ ...QUERY, dayType: 'weekend', radius: 300 })
    expect(request).toHaveBeenCalledWith('test/history', { method: 'POST', body: { lat: 25.1161, lng: 121.5349, dayType: 'weekend' }, signal: undefined })
    expect(result.data.slots.map(slot => slot.hour)).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
    expect(result.data.slots[0].senses).toEqual({ noise: 20, light: 10, crowd: 0, odor: 5.5 })
  })
  it('refuses invalid coordinates and day types before calling the backend', async () => {
    const request = ok({})
    const api = createHistoryApi({ request })
    await expect(api.getHistory({ ...QUERY, lat: 'x' })).rejects.toThrow('座標無效')
    await expect(api.getHistory({ ...QUERY, dayType: 'holiday' })).rejects.toThrow('未知的日期類型')
    expect(request).not.toHaveBeenCalled()
  })
  it('accepts an all-unknown day as data, not as an error', () => {
    const empty = historyPayloadFor({ data: { missingReason: 'no_points_within_radius' }, slots: [0, 3, 6, 9, 12, 15, 18, 21].map(hour => ({ startHour: hour, endHour: hour + 3, senses: { noise: null, light: null, crowd: null, odor: null }, pointCount: 0 })) })
    expect(validHistory(empty, 'weekday').every(slot => Object.values(slot.senses).every(value => value === null))).toBe(true)
  })
  it('rejects payloads that do not follow the contract', async () => {
    const base = historyPayloadFor()
    const cases = [
      historyPayloadFor({ meta: { test: false } }),
      historyPayloadFor({ meta: { datasetVersion: 'taipei-hourly-grid-v1' } }),
      historyPayloadFor({ meta: { aggregationVersion: 'hourly-radius-mean-v1' } }),
      historyPayloadFor({ meta: { noiseMapping: { version: 'test-noise-demo-v1' } } }),
      historyPayloadFor({ dayType: 'weekend' }),
      historyPayloadFor({ data: { radiusMeters: 300 } }),
      historyPayloadFor({ data: { stepHours: 1 } }),
      historyPayloadFor({ data: { missingReason: 'other' } }),
      historyPayloadFor({ slots: base.data.slots.slice(0, 7) }),
      historyPayloadFor({ slots: [...base.data.slots].reverse() }),
      historyPayloadFor({ slots: base.data.slots.map((slot, i) => i === 2 ? { ...slot, endHour: 8 } : slot) }),
      historyPayloadFor({ slots: base.data.slots.map((slot, i) => i === 2 ? { ...slot, senses: { ...slot.senses, noise: 100.5 } } : slot) }),
      historyPayloadFor({ slots: base.data.slots.map((slot, i) => i === 2 ? { ...slot, senses: { noise: 1, light: 1, crowd: 1 } } : slot) }),
    ]
    for (const payload of cases) await expect(createHistoryApi({ request: ok(payload) }).getHistory(QUERY)).rejects.toThrow('格式不符')
  })
  it('shows HTTP errors (404 as not yet provided) and passes cancellation through', async () => {
    for (const status of [400, 404, 429, 503]) {
      const request = vi.fn(async () => { throw new ApiError('x', { status }) })
      await expect(createHistoryApi({ request }).getHistory(QUERY)).rejects.toMatchObject({ name: 'HistoryDataError', status })
    }
    await expect(createHistoryApi({ request: vi.fn(async () => { throw new ApiError('x', { status: 404 }) }) }).getHistory(QUERY)).rejects.toThrow('尚未提供')
    const cancelled = new ApiError('請求已取消。', { code: 'CANCELLED' })
    await expect(createHistoryApi({ request: vi.fn(async () => { throw cancelled }) }).getHistory(QUERY)).rejects.toBe(cancelled)
  })
})

describe('personalized history values', () => {
  it('weights the four values by personal sensitivity with doubled noise, and keeps all-unknown slots null', () => {
    const points = personalizeHistory([
      { hour: 0, senses: { noise: 60, light: 0, crowd: 30, odor: 10 } },
      { hour: 3, senses: { noise: null, light: null, crowd: null, odor: null } },
    ], { noise: 4, light: 2, crowd: 3, odor: 1 })
    // 權重 聲音 8、光線 2、人潮 3、氣味 1：(60×8 + 0×2 + 30×3 + 10×1) ÷ 14 ≈ 41。
    expect(points).toEqual([
      expect.objectContaining({ hour: 0, value: 41, coverage: 1 }),
      expect.objectContaining({ hour: 3, value: null }),
    ])
  })
  it('changes with the sensitivity settings', () => {
    const slot = [{ hour: 12, senses: { noise: 90, light: 10, crowd: 10, odor: 10 } }]
    expect(personalizeHistory(slot, { noise: 5, light: 1, crowd: 1, odor: 1 })[0].value)
      .toBeGreaterThan(personalizeHistory(slot, { noise: 1, light: 5, crowd: 5, odor: 5 })[0].value)
  })
})

describe('history chart', () => {
  it('draws one point per known slot, breaks the line at unknown slots and summarises for screen readers', async () => {
    const slots = validHistory(historyPayloadFor(), 'weekday').map(slot => slot.hour === 9 ? { ...slot, senses: { noise: null, light: null, crowd: null, odor: null } } : slot)
    const points = personalizeHistory(slots, { noise: 4, light: 2, crowd: 3, odor: 1 })
    const html = await renderToString(createSSRApp(HistoryChart, { points, stepHours: 3 }))
    expect(html.match(/<circle[^>]*history-dot/g)).toHaveLength(7)
    expect(html.match(/<polyline/g)).toHaveLength(2)
    expect(html).toMatch(/role="img" aria-label="個人化刺激值折線圖：00:00 \d+（安靜）[^"]*09:00 未知/)
    expect(html).toContain('最安靜：00:00')
  })
})
