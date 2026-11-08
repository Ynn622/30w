import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './apiClient.js'
import { createHistoryApi, normalizeHistory, personalizeHistory } from './historyApi.js'
import HistoryChart from '../components/quiet/HistoryChart.vue'

const slots = (overrides = {}) => [0, 3, 6, 9, 12, 15, 18, 21].map(hour => ({ hour, senses: { noise: 20 + hour, light: 10, crowd: hour * 2, odor: 5 }, ...overrides[hour] }))
const ok = payload => vi.fn(async () => ({ data: payload }))

describe('personal history adapter', () => {
  it('posts only lat, lng and dayType to the configured path', async () => {
    const request = ok({ data: { slots: slots() } })
    const result = await createHistoryApi({ request, path: 'history' }).getHistory({ lat: 25.1, lng: 121.5, dayType: 'weekend', radius: 300 })
    expect(request).toHaveBeenCalledWith('history', { method: 'POST', body: { lat: 25.1, lng: 121.5, dayType: 'weekend' }, signal: undefined })
    expect(result.data.slots).toHaveLength(8)
  })
  it('does not call anything until the backend path is configured', async () => {
    const request = ok({})
    const api = createHistoryApi({ request, path: null })
    expect(api.available).toBe(false)
    await expect(api.getHistory({ lat: 25.1, lng: 121.5, dayType: 'weekday' })).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    expect(request).not.toHaveBeenCalled()
  })
  it('refuses invalid coordinates and day types before calling the backend', async () => {
    const request = ok({})
    const api = createHistoryApi({ request, path: 'history' })
    await expect(api.getHistory({ lat: 'x', lng: 121.5, dayType: 'weekday' })).rejects.toThrow('座標無效')
    await expect(api.getHistory({ lat: 25.1, lng: 121.5, dayType: 'holiday' })).rejects.toThrow('未知的日期類型')
    expect(request).not.toHaveBeenCalled()
  })
  it('accepts common slot shapes and keeps null as unknown', () => {
    expect(normalizeHistory({ data: { points: [{ startTime: '03:00', noise: 10, light: null, crowd: 0, odor: 5 }, { startHour: 0, senses: { noise: 1, light: 2, crowd: 3, odor: 4 } }] } }))
      .toEqual([{ hour: 0, senses: { noise: 1, light: 2, crowd: 3, odor: 4 } }, { hour: 3, senses: { noise: 10, light: null, crowd: 0, odor: 5 } }])
  })
  it('rejects malformed slots, out-of-range values and duplicate hours', async () => {
    for (const payload of [{ data: { slots: [] } }, { data: { slots: [{ hour: 24, senses: {} }] } }, { data: { slots: [{ hour: 0, senses: { noise: 101 } }] } }, { data: { slots: [{ hour: 0, noise: 1 }, { hour: 0, noise: 2 }] } }]) {
      await expect(createHistoryApi({ request: ok(payload), path: 'history' }).getHistory({ lat: 25.1, lng: 121.5, dayType: 'weekday' })).rejects.toThrow('格式不符')
    }
  })
  it('shows HTTP errors and passes cancellation through', async () => {
    for (const status of [400, 404, 429, 503]) {
      const request = vi.fn(async () => { throw new ApiError('x', { status }) })
      await expect(createHistoryApi({ request, path: 'history' }).getHistory({ lat: 25.1, lng: 121.5, dayType: 'weekday' })).rejects.toMatchObject({ name: 'HistoryDataError', status })
    }
    const cancelled = new ApiError('請求已取消。', { code: 'CANCELLED' })
    await expect(createHistoryApi({ request: vi.fn(async () => { throw cancelled }), path: 'history' }).getHistory({ lat: 25.1, lng: 121.5, dayType: 'weekday' })).rejects.toBe(cancelled)
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
    const points = personalizeHistory(slots({ 9: { senses: { noise: null, light: null, crowd: null, odor: null } } }), { noise: 4, light: 2, crowd: 3, odor: 1 })
    const html = await renderToString(createSSRApp(HistoryChart, { points, stepHours: 3 }))
    expect(html.match(/<circle[^>]*history-dot/g)).toHaveLength(7)
    expect(html.match(/<polyline/g)).toHaveLength(2)
    expect(html).toMatch(/role="img" aria-label="個人化刺激值折線圖：00:00 \d+（安靜）[^"]*09:00 未知/)
    expect(html).toContain('最安靜：00:00')
  })
})
