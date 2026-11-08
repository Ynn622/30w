import { effectScope, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sensoryApi } from '../lib/sensoryApi.js'
import { REFRESH_INTERVAL_MS, useQuietCity } from './useQuietCity.js'
import { mockPlaces } from '../data/quietMock.js'
const NOW = '2026-11-07T10:30:00+08:00'
import { AREAS, filterPlaces, taipeiSlot } from '../lib/sensoryDomain.js'
// 地址查詢一律以 mock 取代，測試不連到 Nominatim。
vi.mock('../lib/reverseGeocode.js', () => ({ reverseGeocoder: { lookup: vi.fn(async () => ({ address: '臺北市士林區中正路', inTaipei: true, district: '士林區' })) } }))
import { reverseGeocoder } from '../lib/reverseGeocode.js'
const fakeLocationMock = vi.hoisted(() => ({ enabled: false, lat: 25.1144737, lng: 121.5351923, name: '天母體育館' }))
vi.mock('../config/locationConfig.js', () => ({ fakeLocation: fakeLocationMock }))
vi.mock('../lib/sensoryApi.js', () => ({ MOCK_NOTICE: 'MOCK_NOTICE', sensoryApi: { supportsReportIntensity: false, supportsFreeRadius: false, getOverview: vi.fn(), getMap: vi.fn(), getPlaces: vi.fn(), getPlace: vi.fn() } }))
// hourly 模擬網格與首頁 150 公尺平均：保留真實的裁切與標示工具，只替換網路呼叫。
vi.mock('../lib/hourlyApi.js', async importOriginal => ({ ...(await importOriginal()), hourlyApi: { getGrid: vi.fn(), getOverview: vi.fn() } }))
import { hourlyApi } from '../lib/hourlyApi.js'
// 場所雙來源（正式＋test 情境）的合併另在 placeSources.test.js 驗證；這裡只替換整個來源。
vi.mock('../lib/placeSources.js', () => ({ placeSources: { supportsFreeRadius: false, getPlaces: vi.fn(), getPlace: vi.fn() } }))
import { placeSources } from '../lib/placeSources.js'
import { SIMULATED_AT, hourlyOverviewFor, hourlyPayloadFor } from '../lib/hourlyApi.fixture.js'
import { buildSensoryField } from '../lib/sensoryField.js'
afterEach(() => { fakeLocationMock.enabled = false; vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers() })
// 服務只依目前定位提供：測試直接設定裝置位置。
const at = (lat, lng) => ({ lat, lng, source: 'device', label: '目前位置' })
const ZHONGZHENG = at(AREAS[0].lat, AREAS[0].lng)
const DAAN = at(25.0267, 121.5354)
function located(notify = vi.fn(), point = ZHONGZHENG) {
  const scope = effectScope()
  const city = scope.run(() => useQuietCity(notify))
  city.deviceLocation.value = point
  return { scope, city }
}
describe('sensory queries', () => {
  it('cancels obsolete queries and does not let a late reply replace the new region', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    const pending = []
    hourlyApi.getOverview.mockImplementation((query, { signal }) => new Promise(resolve => pending.push({ query, signal, resolve })))
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    placeSources.getPlaces.mockResolvedValue({ data: { places: [] }, meta: {} })
    const { scope, city } = located()
    await nextTick()
    expect(pending).toHaveLength(1)
    city.deviceLocation.value = DAAN
    await nextTick()
    expect(pending).toHaveLength(2)
    expect(pending[0].signal.aborted).toBe(true)
    pending[1].resolve({ data: { area: '大安區' }, meta: {} })
    await Promise.resolve()
    pending[0].resolve({ data: { area: '中正區' }, meta: {} })
    await Promise.resolve()
    expect(city.overview.data.value.area).toBe('大安區')
    expect(city.places.data.value.places).toEqual([])
    scope.stop()
    expect(pending[1].signal.aborted).toBe(true)
  })
  it('clears outdated values and exposes an actionable error', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    hourlyApi.getOverview.mockResolvedValueOnce({ data: { area: '中正區' }, meta: {} }).mockRejectedValueOnce(new Error('offline'))
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    placeSources.getPlaces.mockResolvedValue({ data: { places: [] }, meta: {} })
    const { scope, city } = located()
    await nextTick(); await Promise.resolve()
    await city.overview.reload()
    expect(city.overview.state.value).toBe('error')
    expect(city.overview.data.value).toBeNull()
    expect(city.overview.error.value).toBe('offline')
    scope.stop()
  })
  it('refreshes live observations while visible and releases its polling timer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    vi.stubGlobal('document', { visibilityState: 'visible' })
    hourlyApi.getOverview.mockResolvedValue({ data: {}, meta: {} })
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    placeSources.getPlaces.mockResolvedValue({ data: { places: [] }, meta: {} })
    const { scope } = located()
    // 2 分鐘前不重取，滿 2 分鐘才重取一次。
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS - 1000)
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(2)
    document.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(2)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('re-ranks by local sensitivities without sending personal settings or filters to the backend', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(NOW))
    const setItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem } })
    hourlyApi.getOverview.mockResolvedValue({ data: {}, meta: {} })
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    placeSources.getPlaces.mockResolvedValue({ data: { places: filterPlaces(mockPlaces('zhongzheng', NOW).slice(0, 3), { ...AREAS[0], radius: 500 }, NOW) }, meta: {} })
    const { scope, city } = located()
    await vi.advanceTimersByTimeAsync(0)
    expect(city.recommendations.value.map(place => place.id)).toEqual(['zhongzheng-reading', 'zhongzheng-park', 'zhongzheng-hall'])
    expect(city.recommendations.value[0].assessment).toMatchObject({ ssi: 27, sfs: 74, fitCoverage: 1 })
    city.preferences.value.sensitivities = { noise: 1, light: 5, crowd: 1, odor: 1 }
    await nextTick()
    expect(city.recommendations.value.map(place => place.id)).toEqual(['zhongzheng-park', 'zhongzheng-reading', 'zhongzheng-hall'])
    city.preferences.value.sort = 'distance'
    await nextTick()
    expect(city.recommendations.value.map(place => place.id)).toEqual(['zhongzheng-reading', 'zhongzheng-park', 'zhongzheng-hall'])
    expect(placeSources.getPlaces).toHaveBeenCalledTimes(1)
    // 已移除感官篩選：查詢只帶區域、座標、固定 500 公尺範圍與場所情境（不送個人敏感度）。
    expect(Object.keys(placeSources.getPlaces.mock.calls[0][0]).sort()).toEqual(['areaId', 'lat', 'lng', 'max', 'radius', 'scenario'])
    expect(placeSources.getPlaces.mock.calls[0][0].max).toBe(100)
    expect(placeSources.getPlaces.mock.calls[0][0].radius).toBe(500)
    expect(JSON.parse(setItem.mock.calls.at(-1)[1])).toMatchObject({ sort: 'distance', sensitivities: { light: 5 } })
    scope.stop()
  })
  it('announces the mock fallback once, keeps retrying the backend and announces recovery', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    vi.stubGlobal('document', { visibilityState: 'visible' })
    const mock = { data: { places: [], cells: [] }, meta: { mock: true, fallbackReason: 'HTTP 404：Route not found', sources: [] } }
    const live = { data: { places: [], cells: [] }, meta: { sources: [] } }
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue(mock)
    const notify = vi.fn()
    const { scope, city } = located(notify)
    await vi.advanceTimersByTimeAsync(0)
    expect(city.usingMock.value).toBe(true)
    expect(city.reportIntensityEnabled.value).toBe(true)
    expect(city.fallbackReason.value).toContain('404')
    await vi.advanceTimersByTimeAsync(2 * REFRESH_INTERVAL_MS)
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(3)
    expect(notify.mock.calls.filter(([message]) => message === 'MOCK_NOTICE')).toHaveLength(1)
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue(live)
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS)
    expect(city.dataSource.value).toBe('api')
    expect(city.reportIntensityEnabled.value).toBe(false)
    expect(notify).toHaveBeenLastCalledWith('已連上後端，改為顯示後端資料。')
    scope.stop()
  })
  it('resolves the village on the device and takes the district from the village boundary', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    // 這個點最近的區代表點是大同區，但實際位於中山區圓山里；里界載入後行政區應改為中山區。
    const { scope, city } = located(vi.fn(), at(25.07445, 121.52224))
    await vi.waitFor(() => expect(city.village.value).not.toBeNull())
    expect(city.village.value).toMatchObject({ district: '中山區', village: '圓山里', name: '中山區圓山里' })
    expect(city.areaId.value).toBe('zhongshan')
    city.deviceLocation.value = null
    await nextTick()
    expect(city.village.value).toBeNull()
    scope.stop()
  })
  it('uses only the device location: districts follow it and outside Taipei pauses the service', async () => {
    const notify = vi.fn()
    let position = { latitude: 25.0935, longitude: 121.526 } // 士林
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: success => success({ coords: position }) } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const scope = effectScope()
    const city = scope.run(() => useQuietCity(notify))
    expect(city.locationStatus.value).toBe('idle')
    expect(city.reportLocation.value).toBeNull()
    expect(hourlyApi.getOverview).not.toHaveBeenCalled()
    await city.locate()
    await nextTick()
    expect(city.locationStatus.value).toBe('ready')
    expect(city.areaId.value).toBe('shilin')
    expect(city.reportLocation.value).toMatchObject({ source: 'device', areaId: 'shilin', label: '目前位置（士林區）' })
    // 首頁概況只送目前位置座標（行政區由裝置判斷，不送給 150 公尺平均）。
    expect(hourlyApi.getOverview).toHaveBeenLastCalledWith({ lat: 25.0935, lng: expect.any(Number) }, expect.anything())
    await vi.waitFor(() => expect(city.addressState.value).toBe('ready'))
    expect(city.address.value).toBe('臺北市士林區中正路')
    expect(reverseGeocoder.lookup).toHaveBeenCalledTimes(1)
    position = { latitude: 25.0136, longitude: 121.4628 } // 新北市板橋
    await city.locate()
    await nextTick()
    expect(city.locationStatus.value).toBe('outside')
    // 市外位置不查地址，也不保留先前的地址。
    expect(reverseGeocoder.lookup).toHaveBeenCalledTimes(1)
    expect(city.address.value).toBe('')
    expect(city.serviceAvailable.value).toBe(false)
    expect(city.overview.state.value).toBe('idle')
    expect(city.reportLocation.value).toBeNull()
    scope.stop()
  })
  it('uses the fixed Tianmu stadium location without asking for permission when fake location is on', async () => {
    fakeLocationMock.enabled = true
    const notify = vi.fn()
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() }, flutterObject: { postMessage: vi.fn() } })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const scope = effectScope()
    const city = scope.run(() => useQuietCity(notify))
    await city.locate()
    await city.locate()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(window.flutterObject.postMessage).not.toHaveBeenCalled()
    expect(city.locationStatus.value).toBe('ready')
    expect(city.deviceLocation.value).toMatchObject({ lat: 25.1144737, lng: 121.5351923, label: '目前位置' })
    expect(city.reportLocation.value).toMatchObject({ areaId: 'shilin', label: '目前位置（士林區）' })
    // 只在第一次定位時提示一次。
    expect(notify.mock.calls.filter(([text]) => text.includes('天母體育館'))).toHaveLength(1)
    scope.stop()
  })
  it('reports a location failure without inventing a fallback area', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (success, failure) => failure(new Error('denied')) } })
    const scope = effectScope()
    const city = scope.run(() => useQuietCity(vi.fn()))
    await city.locate()
    expect(city.locationStatus.value).toBe('error')
    expect(city.locationError.value).toContain('定位權限')
    expect(city.areaId.value).toBeNull()
    expect(hourlyApi.getOverview).not.toHaveBeenCalled()
    scope.stop()
  })
  it('announces the places fallback even when the home overview fails, without treating the overview as mock', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    // 首頁概況與敏感圖層沒有本機模擬：失敗只顯示錯誤；場所清單仍可改用內建模擬並通知。
    hourlyApi.getOverview.mockRejectedValue(new Error('HTTP 503'))
    hourlyApi.getGrid.mockRejectedValue(new Error('HTTP 503'))
    placeSources.getPlaces.mockResolvedValue({ data: { places: [] }, meta: { mock: true, fallbackReason: 'HTTP 404：Route not found', sources: [] } })
    const notify = vi.fn()
    const { scope, city } = located(notify)
    await vi.advanceTimersByTimeAsync(0)
    expect(city.overview.state.value).toBe('error')
    expect(city.hourly.state.value).toBe('error')
    expect(city.usingMock.value).toBe(true)
    expect(notify.mock.calls.map(([message]) => message)).toEqual(['MOCK_NOTICE'])
    scope.stop()
  })
  it('loads places around the map center after the map stops moving, keeping the overview on the device', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap]) fn.mockResolvedValue({ data: { cells: [] }, meta: {} })
    const farPlace = { id: 'p1', name: '遠處場所', location: { lat: 25.0275, lng: 121.5360 } }
    placeSources.getPlaces.mockResolvedValue({ data: { places: [farPlace] }, meta: {} })
    const { scope, city } = located()
    await nextTick(); await Promise.resolve()
    const overviewCalls = hourlyApi.getOverview.mock.calls.length
    city.setMapView({ lat: ZHONGZHENG.lat + 0.0003, lng: ZHONGZHENG.lng }) // 約 33 公尺：不重新查詢
    await nextTick()
    expect(city.mapCenter.value).toBeNull()
    city.setMapView({ lat: 25.0270, lng: 121.5355 }) // 移到大安區
    await nextTick(); await Promise.resolve()
    expect(placeSources.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 'daan', lat: 25.0270, lng: 121.5355 }), expect.anything())
    // 敏感圖層不再呼叫 sensory/map（一律使用模擬網格，移動地圖不重抓）。
    expect(sensoryApi.getMap).not.toHaveBeenCalled()
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(overviewCalls)
    expect(city.searchingElsewhere.value).toBe(true)
    // 清單距離仍從目前位置（中正區）計算。
    await Promise.resolve()
    expect(city.recommendations.value[0].distanceM).toBeGreaterThan(1500)
    city.setMapView({ lat: 25.0136, lng: 121.4628 }) // 新北市板橋
    await nextTick()
    expect(city.searchAvailable.value).toBe(false)
    expect(city.places.state.value).toBe('idle')
    scope.stop()
  })
  it('returns the search to the device location after relocating', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: success => success({ coords: { latitude: AREAS[0].lat, longitude: AREAS[0].lng } }) } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const { scope, city } = located()
    city.setMapView({ lat: 25.0270, lng: 121.5355 })
    expect(city.mapCenter.value).not.toBeNull()
    await city.locate()
    expect(city.mapCenter.value).toBeNull()
    expect(city.searchingElsewhere.value).toBe(false)
    scope.stop()
  })
  it('removes saved favorites left by the old version and no longer exposes favorites', () => {
    const removeItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn(), removeItem } })
    const scope = effectScope()
    const city = scope.run(() => useQuietCity(vi.fn()))
    expect(removeItem).toHaveBeenCalledWith('quiet-city-favorites')
    expect(city).not.toHaveProperty('favorites')
    expect(city).not.toHaveProperty('toggleFavorite')
    scope.stop()
  })
  it('sizes the places query to the visible map using the backend radius steps', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const { scope, city } = located()
    await nextTick()
    expect(placeSources.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 500 }), expect.anything())
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 240 }) // 放大：只需 300 公尺
    await nextTick()
    expect(placeSources.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 300 }), expect.anything())
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 780 })
    await nextTick()
    expect(placeSources.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 1000 }), expect.anything())
    expect(city.viewTruncated.value).toBe(false)
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 2600 }) // 縮小超過後端上限
    await nextTick()
    expect(placeSources.getPlaces.mock.calls.at(-1)[0].radius).toBe(1000)
    expect(city.viewTruncated.value).toBe(true)
    const calls = placeSources.getPlaces.mock.calls.length
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 2700 }) // 同級距、沒移動：不重查
    await nextTick()
    expect(placeSources.getPlaces.mock.calls.length).toBe(calls)
    // 首頁概況仍用目前位置與固定 500 公尺。
    expect(Object.keys(hourlyApi.getOverview.mock.calls.at(-1)[0]).sort()).toEqual(['lat', 'lng'])
    scope.stop()
  })
  it('keeps low-stimulus mode interface-only: no refetch and no change to map data or place order', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    hourlyApi.getOverview.mockResolvedValue({ data: {}, meta: {} })
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    const near = { lat: AREAS[0].lat, lng: AREAS[0].lng }
    placeSources.getPlaces.mockResolvedValue({ data: { places: [{ id: 'a', name: 'A', location: near }, { id: 'b', name: 'B', location: near }] }, meta: {} })
    const { scope, city } = located()
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    const order = city.recommendations.value.map(place => place.id)
    const calls = [sensoryApi.getMap, placeSources.getPlaces].map(fn => fn.mock.calls.length)
    city.preferences.value.lowStimulus = true
    await nextTick()
    expect(city.recommendations.value.map(place => place.id)).toEqual(order)
    expect([sensoryApi.getMap, placeSources.getPlaces].map(fn => fn.mock.calls.length)).toEqual(calls)
    expect(city).not.toHaveProperty('lowZones')
    scope.stop()
  })
  it('sends the exact long-side radius to places when the backend supports it', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    placeSources.supportsFreeRadius = true
    try {
      const { scope, city } = located()
      await nextTick()
      city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 1234 })
      await nextTick()
      expect(placeSources.getPlaces.mock.calls.at(-1)[0].radius).toBe(1240)
      expect(city.viewTruncated.value).toBe(false)
      city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 26200 })
      await nextTick()
      expect(placeSources.getPlaces.mock.calls.at(-1)[0].radius).toBe(20000)
      // max 只送給正式 places；敏感圖層不呼叫 sensory/map。
      expect(placeSources.getPlaces.mock.calls.at(-1)[0].max).toBe(100)
      expect(sensoryApi.getMap).not.toHaveBeenCalled()
      expect(city.viewTruncated.value).toBe(true)
      expect(city.searchCap).toBe(20000)
      scope.stop()
    } finally { placeSources.supportsFreeRadius = false }
  })
})

describe('hourly grid layer and simulated environment (issue #5)', () => {
  const flush = async () => { await nextTick(); await Promise.resolve(); await Promise.resolve() }
  function setup() {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [hourlyApi.getOverview, sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    // 樣本網格在大安區附近，另有一點在天母。
    return located(vi.fn(), at(25.0336, 121.5363))
  }
  function remote(city, slot = { dayType: 'weekday', hour: 8 }) { Object.assign(city.preferences.value, { dataMode: 'remote-hourly', ...slot }) }
  it('always draws the layer from the grid: the current Taipei slot normally, the chosen slot in the simulated environment', async () => {
    hourlyApi.getGrid.mockImplementation(async query => hourlyPayloadFor(query))
    const { scope, city } = setup()
    await flush()
    const current = taipeiSlot(city.now.value)
    expect(hourlyApi.getGrid.mock.calls[0][0]).toEqual(current)
    expect(sensoryApi.getMap).not.toHaveBeenCalled()
    expect(city.remoteTest.value).toBe(false)
    const chosen = { dayType: current.dayType === 'weekday' ? 'weekend' : 'weekday', hour: (current.hour + 5) % 24 }
    remote(city, chosen)
    await flush()
    expect(hourlyApi.getGrid.mock.calls.at(-1)[0]).toEqual(chosen)
    expect(city.hourly.meta.value).toMatchObject(chosen)
    expect(sensoryApi.getMap).not.toHaveBeenCalled()
    // 具名推薦仍來自正式 places（radius 與 max 規則不變）。
    city.setMapView({ lat: 25.0336, lng: 121.5363, radius: 1234 })
    await nextTick()
    expect(placeSources.getPlaces.mock.calls.at(-1)[0]).toMatchObject({ max: 100 })
    scope.stop()
  })
  it('refetches the current slot only when the Taipei hour changes, not on every refresh', async () => {
    hourlyApi.getGrid.mockImplementation(async query => hourlyPayloadFor(query))
    const { scope, city } = setup()
    await flush()
    const calls = hourlyApi.getGrid.mock.calls.length
    city.refresh()
    await flush()
    expect(hourlyApi.getGrid).toHaveBeenCalledTimes(calls)
    city.now.value = city.now.value + 3_600_000
    await flush()
    expect(hourlyApi.getGrid).toHaveBeenCalledTimes(calls + 1)
    expect(hourlyApi.getGrid.mock.calls.at(-1)[0]).toEqual(taipeiSlot(city.now.value))
    scope.stop()
  })
  it('feeds the cropped grid into the sensitivity layer using the backend simulated time', async () => {
    hourlyApi.getGrid.mockResolvedValue(hourlyPayloadFor())
    const { scope, city } = setup()
    remote(city)
    await flush()
    expect(city.fieldCells.value.map(point => point.id)).toEqual(['tg07270', 'tg07271', 'tg07272', 'tg07273'])
    expect(city.fieldNow.value).toBe(Date.parse(SIMULATED_AT))
    // 裝置時鐘快了一小時也照樣畫得出來；資料不足（null）的網格不當成安靜。
    const field = buildSensoryField(city.fieldCells.value, city.preferences.value.sensitivities, city.fieldNow.value)
    expect(field).not.toBeNull()
    expect(buildSensoryField(city.fieldCells.value, city.preferences.value.sensitivities, Date.parse(SIMULATED_AT) + 3_600_000)).toBeNull()
    expect(buildSensoryField([city.fieldCells.value[3]], city.preferences.value.sensitivities, city.fieldNow.value)).toBeNull()
    city.setMapView({ lat: 25.1145, lng: 121.5352, radius: 300 })
    await nextTick()
    expect(city.fieldCells.value.map(point => point.id)).toEqual(['tg19999'])
    expect(hourlyApi.getGrid).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('cancels the previous slot so a late reply cannot replace the newer one', async () => {
    const pending = []
    hourlyApi.getGrid.mockImplementation((query, { signal }) => new Promise(resolve => pending.push({ query, signal, resolve })))
    const { scope, city } = setup()
    remote(city)
    await nextTick()
    city.preferences.value.hour = 20
    await nextTick()
    city.preferences.value.dayType = 'weekend'
    await nextTick()
    expect(pending.map(item => item.query)).toEqual([{ dayType: 'weekday', hour: 8 }, { dayType: 'weekday', hour: 20 }, { dayType: 'weekend', hour: 20 }])
    expect(pending[0].signal.aborted && pending[1].signal.aborted).toBe(true)
    pending[2].resolve(hourlyPayloadFor({ dayType: 'weekend', hour: 20 }))
    await Promise.resolve()
    pending[0].resolve(hourlyPayloadFor({ dayType: 'weekday', hour: 8 }))
    await Promise.resolve()
    expect(city.hourly.meta.value).toMatchObject({ dayType: 'weekend', hour: 20 })
    scope.stop()
    expect(pending[2].signal.aborted).toBe(true)
  })
  it('shows a grid error without falling back to built-in mock data or sensory/map', async () => {
    hourlyApi.getGrid.mockRejectedValue(Object.assign(new Error('測試網格資料暫時無法使用（503），請稍後再試。'), { status: 503 }))
    const { scope, city } = setup()
    remote(city)
    await flush()
    expect(city.fieldSource.value).toBe(city.hourly)
    expect(city.hourly.state.value).toBe('error')
    expect(city.hourly.error.value).toContain('503')
    expect(city.fieldCells.value).toEqual([])
    expect(sensoryApi.getMap).not.toHaveBeenCalled()
    scope.stop()
  })
  it('returns to the current slot after leaving the simulated environment without keeping the chosen slot', async () => {
    hourlyApi.getGrid.mockImplementation(async query => hourlyPayloadFor(query))
    const { scope, city } = setup()
    const current = taipeiSlot(city.now.value)
    const chosen = { dayType: current.dayType === 'weekday' ? 'weekend' : 'weekday', hour: (current.hour + 5) % 24 }
    remote(city, chosen)
    await flush()
    expect(city.hourly.meta.value).toMatchObject(chosen)
    let release
    hourlyApi.getGrid.mockImplementationOnce(query => new Promise(resolve => { release = () => resolve(hourlyPayloadFor(query)) }))
    city.preferences.value.dataMode = 'live'
    await nextTick()
    // 換時段時先清空舊網格，不會短暫顯示自選時段的圖層。
    expect(hourlyApi.getGrid.mock.calls.at(-1)[0]).toEqual(current)
    expect(city.hourly.data.value).toBeNull()
    expect(city.fieldCells.value).toEqual([])
    release()
    await flush()
    expect(city.hourly.meta.value).toMatchObject(current)
    expect(sensoryApi.getMap).not.toHaveBeenCalled()
    scope.stop()
  })
  it('reads the home overview from the 150 m average with only coordinates, regardless of the simulated environment', async () => {
    hourlyApi.getGrid.mockResolvedValue(hourlyPayloadFor())
    hourlyApi.getOverview.mockResolvedValue(hourlyOverviewFor())
    const notify = vi.fn()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [sensoryApi.getMap, placeSources.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const { scope, city } = located(notify, at(25.0336, 121.5363))
    await flush()
    expect(hourlyApi.getOverview.mock.calls.at(-1)[0]).toEqual({ lat: 25.0336, lng: 121.5363 })
    expect(city.overview.data.value.senses.noise).toBe(26.6)
    // 當正式資料對待：不是內建模擬備援，不跳模擬通知。
    expect(city.overview.source.value).toBe('api')
    expect(notify).not.toHaveBeenCalledWith(expect.stringContaining('模擬資料'))
    const calls = hourlyApi.getOverview.mock.calls.length
    remote(city)
    await flush()
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(calls)
    city.refresh()
    await flush()
    expect(hourlyApi.getOverview).toHaveBeenCalledTimes(calls + 1)
    scope.stop()
  })
  it('ignores the retired remote-mock preference and reads saved day type, hour and place scenario', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ dataMode: 'remote-mock', scenario: 'weekend_day', dayType: 'weekend', hour: 21 }), setItem: vi.fn() } })
    const { scope, city } = located()
    expect(city.preferences.value).toMatchObject({ dataMode: 'live', dayType: 'weekend', hour: 21, scenario: 'weekend_day' })
    scope.stop()
  })
  it('drops an unknown place scenario and falls back to a valid default', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ scenario: 'holiday_night' }), setItem: vi.fn() } })
    const { scope, city } = located()
    expect(['weekday_day', 'weekday_evening', 'weekend_day']).toContain(city.preferences.value.scenario)
    scope.stop()
  })
})

describe('places come from the live + test scenario sources (issue #7)', () => {
  it('requests both sources with the chosen scenario and opens details by the stored source reference', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ placeSource: 'live', scenario: 'weekday_evening' }), setItem: vi.fn() } })
    const ref = { origin: 'merged', liveId: 'p-1', testId: 'p-1', scenario: 'weekday_evening' }
    placeSources.getPlaces.mockResolvedValue({ data: { places: [{ id: 'p-1', name: '天福綠地', location: { lat: 25.1185, lng: 121.5329 }, origin: 'merged', renderKey: 'merged:p-1:p-1', ref }] }, meta: { scenario: 'weekday_evening', partial: null } })
    placeSources.getPlace.mockResolvedValue({ data: { id: 'p-1' }, meta: { origin: 'merged' } })
    const notify = vi.fn()
    const { scope, city } = located(notify, at(25.1145, 121.5352))
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    expect(placeSources.getPlaces.mock.calls[0][0]).toMatchObject({ lat: 25.1145, lng: 121.5352, max: 100, scenario: 'weekday_evening' })
    expect(city.recommendations.value.map(place => place.renderKey)).toEqual(['merged:p-1:p-1'])
    await city.getPlace(ref)
    expect(placeSources.getPlace).toHaveBeenCalledWith(ref, undefined)
    expect(sensoryApi.getPlace).not.toHaveBeenCalled()
    // 不是內建模擬備援，不跳模擬通知；舊的 placeSource 偏好讀取時略過。
    expect(city.places.source.value).toBe('api')
    expect(notify).not.toHaveBeenCalledWith('MOCK_NOTICE')
    expect(city.preferences.value).not.toHaveProperty('placeSource')
    // 切換情境會重新查詢（舊請求由 useRemote 取消）。
    city.preferences.value.scenario = 'weekend_day'
    await nextTick(); await Promise.resolve()
    expect(placeSources.getPlaces.mock.calls.at(-1)[0]).toMatchObject({ scenario: 'weekend_day' })
    scope.stop()
  })
})
