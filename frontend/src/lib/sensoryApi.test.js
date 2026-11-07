import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSensoryApi } from './sensoryApi.js'
import { AREAS, aqiText, filterPlaces, googleMapsDirectionsUrl, searchPlaces, isCoordinate, levelText, nearestArea, pickSearchRadius, readPreferences } from './sensoryDomain.js'
import { mockCells, mockOverview, mockPlaces } from '../data/quietMock.js'
import { assessSensory } from './sensoryIndex.js'
afterEach(() => vi.useRealTimers())

const NOW = '2026-11-07T10:30:00+08:00'
const now = () => new Date(NOW).getTime()
const routeMissing = Object.assign(new Error('Route not found'), { status: 404, code: 'HTTP_ERROR' })
const location = { ...AREAS[0], source: 'manual' }

describe('API first with mock fallback', () => {
  it('uses backend data whenever the backend answers with a valid envelope', async () => {
    const request = vi.fn().mockResolvedValue({ data: { data: { senses: { noise: 40 } }, meta: { sources: [] } } })
    const result = await createSensoryApi({ request, now }).getOverview({ areaId: 'zhongzheng' })
    expect(request).toHaveBeenCalledWith('sensory/overview', expect.objectContaining({ query: { areaId: 'zhongzheng' } }))
    expect(result.meta.mock).toBeUndefined()
    expect(result.data.senses.noise).toBe(40)
  })
  it('falls back to complete mock data and records why when the route is missing', async () => {
    const api = createSensoryApi({ request: vi.fn().mockRejectedValue(routeMissing), now })
    const result = await api.getPlaces({ ...AREAS[0], radius: 500, noise: 'low' })
    expect(result.meta).toMatchObject({ mock: true, fallbackReason: 'HTTP 404：Route not found' })
    expect(result.meta.sources[0].name).toBe('聆靜模擬資料')
    expect(result.data.places.map(place => place.id)).toEqual(['zhongzheng-reading', 'zhongzheng-park', 'zhongzheng-study', 'zhongzheng-hall'])
    await expect(api.getOverview({ areaId: 'daan' })).resolves.toMatchObject({ data: { area: '大安區' }, meta: { mock: true } })
    await expect(api.getMap({ areaId: 'xinyi' })).resolves.toMatchObject({ meta: { mock: true } })
  })
  it('falls back when a successful response is malformed or marked as test data', async () => {
    for (const data of [{}, { data: { cells: [] }, meta: { mock: true, sources: [] } }]) {
      // 明確關閉 mockMap，避免本機 .env 的 VITE_MOCK_MAP 影響測試。
      const result = await createSensoryApi({ request: vi.fn().mockResolvedValue({ data }), now, mockMap: false }).getMap({ areaId: 'zhongzheng' })
      expect(result.meta.mock).toBe(true)
      expect(result.meta.fallbackReason).toContain('格式不符')
    }
  })
  it('uses labelled mock map cells without calling the backend when VITE_MOCK_MAP is on', async () => {
    const request = vi.fn()
    const result = await createSensoryApi({ request, now, mockMap: true }).getMap({ areaId: 'shilin', lat: 25.1145, lng: 121.5352, radius: 1000 })
    expect(request).not.toHaveBeenCalled()
    expect(result.meta).toMatchObject({ mock: true, fallbackReason: expect.stringContaining('VITE_MOCK_MAP') })
    expect(result.data.cells.length).toBeGreaterThan(0)
  })
  it('centers mock places on the user location and keeps the mock detail at the same coordinates', async () => {
    const api = createSensoryApi({ request: vi.fn().mockRejectedValue(routeMissing), now })
    const user = { areaId: 'shilin', lat: 25.0985, lng: 121.5301, radius: 500, noise: 'low' }
    const { data } = await api.getPlaces(user)
    expect(data.places.length).toBeGreaterThan(0)
    expect(data.places.every(place => place.distanceM <= 500)).toBe(true)
    const detail = await api.getPlace(data.places[0].id)
    expect(detail.data.location).toEqual(data.places[0].location)
  })
  it('does not replace a cancelled request with mock data', async () => {
    const api = createSensoryApi({ request: vi.fn().mockRejectedValue(Object.assign(new Error('請求已取消。'), { code: 'CANCELLED' })), now })
    await expect(api.getOverview({})).rejects.toThrow('取消')
  })
  it('falls back to mock place detail but keeps the original error for unknown places', async () => {
    const api = createSensoryApi({ request: vi.fn().mockRejectedValue(routeMissing), now })
    await expect(api.getPlace('daan-tea')).resolves.toMatchObject({ data: { name: '巷內茶香休憩所' }, meta: { mock: true } })
    await expect(api.getPlace('not-a-place')).rejects.toThrow('Route not found')
  })
  it('checks live places again so stale and out-of-range API results cannot pass low-stimulus filters', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(NOW))
    // Current backend contract has no versioned sensoryIndex; legacy senses must still be rechecked.
    const places = mockPlaces('zhongzheng', NOW).slice(0, 3).map(({ sensoryIndex, ...place }) => place)
    places[0].updatedAt = '2026-11-06T10:30:00+08:00'
    places[1].senses.noise = null
    const api = createSensoryApi({ request: vi.fn().mockResolvedValue({ data: { data: { places }, meta: { sources: [] } } }), now })
    const result = await api.getPlaces({ ...AREAS[0], radius: 500, noise: 'low' })
    expect(result.meta.mock).toBeUndefined()
    expect(result.data.places.map(place => place.id)).toEqual(['zhongzheng-hall'])
  })
})
describe('writes', () => {
  it('sends a report as POST only after valid location and kind', async () => {
    const request = vi.fn().mockResolvedValue({ data: { data: { accepted: true } } })
    const api = createSensoryApi({ request, now })
    const body = { kind: 'noisy', location, note: '' }
    await expect(api.createReport(body)).resolves.toMatchObject({ data: { accepted: true } })
    expect(request).toHaveBeenCalledWith('reports', { method: 'POST', body })
    await expect(api.createReport({ ...body, location: null })).rejects.toThrow('位置')
  })
  it('simulates writes only when the backend is unreachable or missing, not for validation errors', async () => {
    const offline = createSensoryApi({ request: vi.fn().mockRejectedValue(Object.assign(new Error('無法連接後端'), { code: 'NETWORK_ERROR' })), now })
    await expect(offline.createReport({ kind: 'comfortable', location, note: '' })).resolves.toMatchObject({ data: { accepted: true }, meta: { mock: true } })
    await expect(createSensoryApi({ request: vi.fn().mockRejectedValue(routeMissing), now }).createMeasurement({ location, consent: true })).resolves.toMatchObject({ meta: { mock: true } })
    for (const status of [400, 429]) {
      const api = createSensoryApi({ request: vi.fn().mockRejectedValue(Object.assign(new Error(`錯誤 ${status}`), { status })), now })
      await expect(api.createReport({ kind: 'comfortable', location, note: '' })).rejects.toThrow(`錯誤 ${status}`)
    }
  })
  it('keeps the legacy report body until the backend declares intensity support', async () => {
    const request = vi.fn().mockResolvedValue({ data: { data: { accepted: true } } })
    const body = { kind: 'noisy', location, note: '', intensity: 'strong' }
    const legacy = createSensoryApi({ request, now })
    expect(legacy.supportsReportIntensity).toBe(false)
    await legacy.createReport(body)
    expect(request).toHaveBeenLastCalledWith('reports', { method: 'POST', body: { kind: 'noisy', location, note: '' } })
    const enabled = createSensoryApi({ request, now, reportIntensity: true })
    await enabled.createReport(body)
    expect(request).toHaveBeenLastCalledWith('reports', { method: 'POST', body })
    await expect(enabled.createReport({ ...body, intensity: undefined })).rejects.toThrow('強度')
    await expect(enabled.createReport({ ...body, intensity: 'loud' })).rejects.toThrow('強度')
    await expect(enabled.createReport({ ...body, kind: 'comfortable' })).rejects.toThrow('不需要')
    await expect(enabled.createReport({ kind: 'comfortable', location, note: '' })).resolves.toBeTruthy()
    expect(request).toHaveBeenCalledTimes(3)
  })
  it('accepts the 8 kinds with their own quick tags, persistence and indoor/outdoor, and rejects mismatches', async () => {
    const request = vi.fn().mockResolvedValue({ data: { data: { accepted: true } } })
    const api = createSensoryApi({ request, now, reportIntensity: true })
    const body = { kind: 'noisy', location, note: '', intensity: 'strong', tags: ['construction', 'low_frequency'], persistence: 'ongoing', setting: 'outdoor' }
    await api.createReport(body)
    expect(request).toHaveBeenLastCalledWith('reports', { method: 'POST', body })
    await api.createReport({ kind: 'thermal', location, note: '', intensity: 'mild', tags: ['stuffy'], setting: 'indoor' })
    await api.createReport({ kind: 'comfortable', location, note: '', tags: ['quiet', 'seating'], persistence: 'recurring' })
    await expect(api.createReport({ ...body, tags: ['too_hot'] })).rejects.toThrow('具體情況')
    await expect(api.createReport({ ...body, tags: ['traffic', 'traffic'] })).rejects.toThrow('具體情況')
    await expect(api.createReport({ ...body, persistence: 'forever' })).rejects.toThrow('持續狀態')
    await expect(api.createReport({ ...body, setting: 'roof' })).rejects.toThrow('室內')
    await expect(api.createReport({ ...body, intensity: 'none' })).rejects.toThrow('強度')
    await expect(api.createReport({ kind: 'other', location, note: '  ' })).rejects.toThrow('描述')
    await expect(api.createReport({ kind: 'other', location, note: '入口有很多鴿子' })).resolves.toBeTruthy()
    expect(request).toHaveBeenCalledTimes(4)
  })
  it('does not upload measurements without separate sharing consent', async () => {
    const request = vi.fn()
    const api = createSensoryApi({ request, now })
    await expect(api.createMeasurement({ location, consent: false })).rejects.toThrow('同意')
    expect(request).not.toHaveBeenCalled()
  })
})
describe('mock data set', () => {
  it('covers every area and endpoint with fresh, versioned observations', async () => {
    for (const area of AREAS) {
      const overview = mockOverview(area.id, NOW)
      expect(overview).toMatchObject({ area: area.name, windowMinutes: 30, air: { aqi: expect.any(Number) } })
      expect(Object.keys(overview.senses)).toEqual(expect.arrayContaining(['noise', 'light', 'crowd', 'odor']))
      const places = mockPlaces(area.id, NOW)
      expect(places.length).toBeGreaterThanOrEqual(6)
      for (const place of places) {
        expect(place).toMatchObject({ id: expect.stringMatching(new RegExp(`^${area.id}-`)), hours: expect.any(String), accessibility: expect.any(String), summary: expect.any(String), address: expect.stringContaining('模擬地址') })
        expect(place.reviews).toHaveLength(place.reviewCount)
        expect(isCoordinate(place.location)).toBe(true)
      }
      expect((await mockCells(area.id, NOW)).length).toBeGreaterThanOrEqual(8)
    }
    // 模擬格網固定在地面上：不同查詢中心取到的同一格，座標與四維完全相同（地圖移動時熱力圖不會跟著跑）。
    const a = await mockCells('shilin', NOW, { lat: 25.1145, lng: 121.5352 }, 1000)
    const b = await mockCells('shilin', NOW, { lat: 25.1180, lng: 121.5400 }, 1000)
    // 渲染範圍為查詢中心 2km 內（不規則分布，天母附近約 1,500 點）。
    expect(a.length).toBeGreaterThan(250)
    const shared = a.filter(cell => b.some(other => other.id === cell.id))
    expect(shared.length).toBeGreaterThan(10)
    for (const cell of shared) {
      const other = b.find(item => item.id === cell.id)
      expect(other.location).toEqual(cell.location)
      expect(other.senses).toEqual(cell.senses)
    }
    // 四維彼此分歧：至少有一格聲音低但人潮高、一格聲音高但人潮低。
    expect(a.some(cell => cell.senses.noise <= 33 && cell.senses.crowd >= 67)).toBe(true)
    expect(a.some(cell => cell.senses.noise >= 67 && cell.senses.crowd <= 33)).toBe(true)
    expect(assessSensory(mockPlaces('zhongzheng', NOW)[0], undefined, NOW)).toMatchObject({ ssi: 27, availableCount: 4 })
    // 刻意保留一筆超過 30 分鐘的觀測，驗證過期資料不被當成低刺激。
    expect(assessSensory(mockPlaces('zhongzheng', NOW).find(place => place.id === 'zhongzheng-arts'), undefined, NOW).ssi).toBeNull()
  })
})
describe('honest sensory values', () => {
  it('keeps zero valid and null or out of range unknown', () => {
    expect(levelText(0)).toBe('低')
    expect(levelText(null)).toBe('未知')
    expect(levelText(101)).toBe('未知')
    expect([aqiText(50), aqiText(51), aqiText(151), aqiText(null)]).toEqual(['良好', '普通', '對所有族群不健康', '未知'])
    expect(isCoordinate({ lat: null, lng: 121 })).toBe(false)
    expect(isCoordinate({ lat: 91, lng: 121 })).toBe(false)
  })
  it('excludes unknown, stale and insufficient readings from low-stimulus filters', () => {
    const places = mockPlaces('zhongzheng', NOW).slice(0, 3)
    places[0].sensoryIndex.dimensions.noise = null
    places[1].sensoryIndex.dimensionMeta.noise.observedAt = '2026-11-06T10:30:00+08:00'
    places[2].sensoryIndex.dimensionMeta.noise.confidence = 'insufficient'
    expect(filterPlaces(places, { ...AREAS[0], radius: 500, noise: 'low' }, NOW)).toEqual([])
    const legacy = mockPlaces('zhongzheng', NOW).slice(0, 3).map(({ sensoryIndex, ...place }) => place)
    legacy[0].senses.noise = null
    legacy[1].updatedAt = '2026-11-06T10:30:00+08:00'
    legacy[2].confidence = 'insufficient'
    expect(filterPlaces(legacy, { ...AREAS[0], radius: 500, noise: 'low' }, NOW)).toEqual([])
  })
  it('filters odor locally only from valid odor observations', () => {
    expect(filterPlaces(mockPlaces('zhongzheng', NOW), { ...AREAS[0], radius: 500, odor: 'low' }, NOW).map(place => place.id))
      .toEqual(['zhongzheng-reading', 'zhongzheng-park', 'zhongzheng-study'])
  })
  it('respects radius, indoor and all selected preferences together', () => {
    expect(filterPlaces(mockPlaces('zhongzheng', NOW), { ...AREAS[0], radius: 300, indoor: true, light: 'low' }, NOW)).toEqual([])
    expect(filterPlaces(mockPlaces('zhongzheng', NOW), { ...AREAS[0], radius: 500, indoor: true, light: 'low' }, NOW)).toHaveLength(1)
  })
  it('drops removed filter preferences and unknown keys, and tolerates unavailable storage', () => {
    // 舊版存下的感官篩選與距離偏好已移除，讀取時一律略過。
    const restored = readPreferences({ getItem: () => '{"radius":1000,"noise":true,"odor":true,"indoor":true,"shareMeasurement":true}' })
    for (const key of ['radius', 'noise', 'light', 'crowd', 'odor', 'indoor', 'shareMeasurement']) expect(restored).not.toHaveProperty(key)
    expect(restored).toMatchObject({ sort: 'fit', lowStimulus: false })
    expect(readPreferences({ getItem: () => { throw new Error('blocked') } })).toMatchObject({ sort: 'fit', sensitivities: { noise: 4 } })
  })
  it('restores sensitivities, sort and low-stimulus mode with independent defaults', () => {
    const restored = readPreferences({ getItem: () => JSON.stringify({ sort: 'distance', lowStimulus: true, sensitivities: { noise: 5, light: 0, crowd: 2.5, odor: 3 } }) })
    expect(restored).toMatchObject({ sort: 'distance', lowStimulus: true, sensitivities: { noise: 5, light: 2, crowd: 3, odor: 3 } })
    const oldFormat = readPreferences({ getItem: () => '{"noise":false,"radius":1000}' })
    expect(oldFormat).toMatchObject({ sort: 'fit', lowStimulus: false, sensitivities: { noise: 4, light: 2, crowd: 3, odor: 1 } })
    oldFormat.sensitivities.noise = 1
    expect(readPreferences({ getItem: () => 'null' }).sensitivities.noise).toBe(4)
    expect(readPreferences({ getItem: () => '{"sort":"ssi","sensitivities":"bad"}' })).toMatchObject({ sort: 'fit', sensitivities: { noise: 4 } })
  })
})
describe('Taipei districts', () => {
  it('lists all 12 districts and estimates the nearest one only inside Taipei', () => {
    expect(AREAS.map(area => area.name)).toEqual(['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'])
    expect(nearestArea({ lat: 25.0935, lng: 121.526 })?.id).toBe('shilin')
    expect(nearestArea({ lat: 24.99, lng: 121.57 })?.id).toBe('wenshan')
    expect(nearestArea({ lat: 25.0136, lng: 121.4628 })).toBeNull() // 新北市板橋
    expect(nearestArea({ lat: 25.0615, lng: 121.4880 })).toBeNull() // 新北市三重
    expect(nearestArea({ lat: 25.0080, lng: 121.5150 })).toBeNull() // 新北市永和
    expect(nearestArea({ lat: 25.0478, lng: 121.5170 })?.id).toBe('zhongzheng') // 臺北車站
    expect(nearestArea({ lat: 25.0340, lng: 121.5645 })?.id).toBe('xinyi') // 市府附近
    expect(nearestArea({ lat: 25.1365, lng: 121.5065 })?.id).toBe('beitou') // 北投站附近
    expect(nearestArea({ lat: null, lng: 121.5 })).toBeNull()
  })
})
describe('search radius', () => {
  it('picks the smallest backend radius step that covers the map view', () => {
    expect([pickSearchRadius(120), pickSearchRadius(300), pickSearchRadius(301), pickSearchRadius(999), pickSearchRadius(4000)]).toEqual([300, 300, 500, 1000, 1000])
    expect(pickSearchRadius(undefined)).toBe(500)
  })
})
describe('walking navigation link', () => {
  it('builds a Google Maps walking directions URL and refuses invalid coordinates', () => {
    const url = new URL(googleMapsDirectionsUrl({ lat: 25.03926, lng: 121.51463 }))
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/')
    expect(Object.fromEntries(url.searchParams)).toEqual({ api: '1', destination: '25.03926,121.51463', travelmode: 'walking' })
    expect(googleMapsDirectionsUrl({ lat: null, lng: 121 })).toBeNull()
  })
})
describe('place text search', () => {
  it('matches name, category, address or tag case-insensitively and keeps order', () => {
    const places = [
      { id: 'a', name: '介壽公園', category: '公園', address: '臺北市中正區凱達格蘭大道', tag: '感官資料不足' },
      { id: 'b', name: 'Quiet Library', category: '圖書館', address: '重慶南路一段' },
      { id: 'c', name: '大安區行政中心', category: '涼適點', address: '新生南路二段86號' },
    ]
    expect(searchPlaces(places, '公園').map(p => p.id)).toEqual(['a'])
    expect(searchPlaces(places, ' library ').map(p => p.id)).toEqual(['b'])
    expect(searchPlaces(places, '新生南路').map(p => p.id)).toEqual(['c'])
    expect(searchPlaces(places, '資料不足').map(p => p.id)).toEqual(['a'])
    expect(searchPlaces(places, '')).toBe(places)
    expect(searchPlaces(places, '不存在')).toEqual([])
  })
})
