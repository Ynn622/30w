import { effectScope, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sensoryApi } from '../lib/sensoryApi.js'
import { useQuietCity } from './useQuietCity.js'
import { mockPlaces } from '../data/quietMock.js'
const NOW = '2026-11-07T10:30:00+08:00'
import { AREAS, filterPlaces } from '../lib/sensoryDomain.js'
// 地址查詢一律以 mock 取代，測試不連到 Nominatim。
vi.mock('../lib/reverseGeocode.js', () => ({ reverseGeocoder: { lookup: vi.fn(async () => ({ address: '臺北市士林區中正路', inTaipei: true, district: '士林區' })) } }))
import { reverseGeocoder } from '../lib/reverseGeocode.js'
const fakeLocationMock = vi.hoisted(() => ({ enabled: false, lat: 25.1144737, lng: 121.5351923, name: '天母體育館' }))
vi.mock('../config/locationConfig.js', () => ({ fakeLocation: fakeLocationMock }))
vi.mock('../lib/sensoryApi.js', () => ({ MOCK_NOTICE: 'MOCK_NOTICE', sensoryApi: { supportsReportIntensity: false, supportsFreeRadius: false, getOverview: vi.fn(), getMap: vi.fn(), getPlaces: vi.fn() } }))
// 測試情境 Mock API：保留真實的評分與排序，只替換網路呼叫。
vi.mock('../lib/mockApi.js', async importOriginal => ({ ...(await importOriginal()), mockApi: { getPlaces: vi.fn(), getPlace: vi.fn() } }))
import { mockApi } from '../lib/mockApi.js'
import { CLOSED_ID, DAAN_ID, PLAIN_ID, UNKNOWN_ID, mockPayloadFor, mockPlaceFor, mockPlacesFor } from '../lib/mockApi.fixture.js'
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
    sensoryApi.getOverview.mockImplementation((query, { signal }) => new Promise(resolve => pending.push({ query, signal, resolve })))
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: [] }, meta: {} })
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
    sensoryApi.getOverview.mockResolvedValueOnce({ data: { area: '中正區' }, meta: {} }).mockRejectedValueOnce(new Error('offline'))
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: [] }, meta: {} })
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
    sensoryApi.getOverview.mockResolvedValue({ data: {}, meta: {} })
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: [] }, meta: {} })
    const { scope } = located()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sensoryApi.getOverview).toHaveBeenCalledTimes(2)
    document.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(60_000)
    expect(sensoryApi.getOverview).toHaveBeenCalledTimes(2)
    scope.stop()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('re-ranks by local sensitivities without sending personal settings or filters to the backend', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(NOW))
    const setItem = vi.fn()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem } })
    sensoryApi.getOverview.mockResolvedValue({ data: {}, meta: {} })
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: filterPlaces(mockPlaces('zhongzheng', NOW).slice(0, 3), { ...AREAS[0], radius: 500 }, NOW) }, meta: {} })
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
    expect(sensoryApi.getPlaces).toHaveBeenCalledTimes(1)
    // 已移除感官篩選：查詢只帶區域、座標與固定 500 公尺範圍。
    expect(Object.keys(sensoryApi.getPlaces.mock.calls[0][0]).sort()).toEqual(['areaId', 'lat', 'lng', 'max', 'radius'])
    expect(sensoryApi.getPlaces.mock.calls[0][0].max).toBe(100)
    expect(sensoryApi.getPlaces.mock.calls[0][0].radius).toBe(500)
    expect(JSON.parse(setItem.mock.calls.at(-1)[1])).toMatchObject({ sort: 'distance', sensitivities: { light: 5 } })
    scope.stop()
  })
  it('announces the mock fallback once, keeps retrying the backend and announces recovery', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    vi.stubGlobal('document', { visibilityState: 'visible' })
    const mock = { data: { places: [], cells: [] }, meta: { mock: true, fallbackReason: 'HTTP 404：Route not found', sources: [] } }
    const live = { data: { places: [], cells: [] }, meta: { sources: [] } }
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue(mock)
    const notify = vi.fn()
    const { scope, city } = located(notify)
    await vi.advanceTimersByTimeAsync(0)
    expect(city.usingMock.value).toBe(true)
    expect(city.reportIntensityEnabled.value).toBe(true)
    expect(city.fallbackReason.value).toContain('404')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(sensoryApi.getOverview).toHaveBeenCalledTimes(3)
    expect(notify.mock.calls.filter(([message]) => message === 'MOCK_NOTICE')).toHaveLength(1)
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue(live)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(city.dataSource.value).toBe('api')
    expect(city.reportIntensityEnabled.value).toBe(false)
    expect(notify).toHaveBeenLastCalledWith('已連上後端，改為顯示後端資料。')
    scope.stop()
  })
  it('resolves the village on the device and takes the district from the village boundary', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
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
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const scope = effectScope()
    const city = scope.run(() => useQuietCity(notify))
    expect(city.locationStatus.value).toBe('idle')
    expect(city.reportLocation.value).toBeNull()
    expect(sensoryApi.getOverview).not.toHaveBeenCalled()
    await city.locate()
    await nextTick()
    expect(city.locationStatus.value).toBe('ready')
    expect(city.areaId.value).toBe('shilin')
    expect(city.reportLocation.value).toMatchObject({ source: 'device', areaId: 'shilin', label: '目前位置（士林區）' })
    expect(sensoryApi.getOverview).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 'shilin', lat: 25.0935 }), expect.anything())
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
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
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
    expect(sensoryApi.getOverview).not.toHaveBeenCalled()
    scope.stop()
  })
  it('names only the parts that fell back when the backend is partly ready', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    const mock = { data: { cells: [] }, meta: { mock: true, fallbackReason: 'HTTP 404：Route not found', sources: [] } }
    sensoryApi.getOverview.mockResolvedValue(mock)
    sensoryApi.getMap.mockResolvedValue(mock)
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: [] }, meta: { sources: [] } })
    const notify = vi.fn()
    const { scope, city } = located(notify)
    await vi.advanceTimersByTimeAsync(0)
    expect(city.usingMock.value).toBe(true)
    expect(notify.mock.calls.map(([message]) => message)).toEqual(['感官概況、感官地圖暫時無法取得後端資料，已改用模擬資料顯示。'])
    scope.stop()
  })
  it('loads places and heat cells around the map center after the map stops moving, keeping the overview on the device', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap]) fn.mockResolvedValue({ data: { cells: [] }, meta: {} })
    const farPlace = { id: 'p1', name: '遠處場所', location: { lat: 25.0275, lng: 121.5360 } }
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: [farPlace] }, meta: {} })
    const { scope, city } = located()
    await nextTick(); await Promise.resolve()
    const overviewCalls = sensoryApi.getOverview.mock.calls.length
    city.setMapView({ lat: ZHONGZHENG.lat + 0.0003, lng: ZHONGZHENG.lng }) // 約 33 公尺：不重新查詢
    await nextTick()
    expect(city.mapCenter.value).toBeNull()
    city.setMapView({ lat: 25.0270, lng: 121.5355 }) // 移到大安區
    await nextTick(); await Promise.resolve()
    expect(sensoryApi.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 'daan', lat: 25.0270, lng: 121.5355 }), expect.anything())
    expect(sensoryApi.getMap).toHaveBeenLastCalledWith(expect.objectContaining({ areaId: 'daan' }), expect.anything())
    expect(sensoryApi.getOverview).toHaveBeenCalledTimes(overviewCalls)
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
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
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
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    const { scope, city } = located()
    await nextTick()
    expect(sensoryApi.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 500 }), expect.anything())
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 240 }) // 放大：只需 300 公尺
    await nextTick()
    expect(sensoryApi.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 300 }), expect.anything())
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 780 })
    await nextTick()
    expect(sensoryApi.getPlaces).toHaveBeenLastCalledWith(expect.objectContaining({ radius: 1000 }), expect.anything())
    expect(city.viewTruncated.value).toBe(false)
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 2600 }) // 縮小超過後端上限
    await nextTick()
    expect(sensoryApi.getPlaces.mock.calls.at(-1)[0].radius).toBe(1000)
    expect(city.viewTruncated.value).toBe(true)
    const calls = sensoryApi.getPlaces.mock.calls.length
    city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 2700 }) // 同級距、沒移動：不重查
    await nextTick()
    expect(sensoryApi.getPlaces.mock.calls.length).toBe(calls)
    // 首頁概況仍用目前位置與固定 500 公尺。
    expect(sensoryApi.getOverview.mock.calls.at(-1)[0].radius).toBe(500)
    scope.stop()
  })
  it('keeps low-stimulus mode interface-only: no refetch and no change to map data or place order', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    sensoryApi.getOverview.mockResolvedValue({ data: {}, meta: {} })
    sensoryApi.getMap.mockResolvedValue({ data: { cells: [] }, meta: {} })
    const near = { lat: AREAS[0].lat, lng: AREAS[0].lng }
    sensoryApi.getPlaces.mockResolvedValue({ data: { places: [{ id: 'a', name: 'A', location: near }, { id: 'b', name: 'B', location: near }] }, meta: {} })
    const { scope, city } = located()
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    const order = city.recommendations.value.map(place => place.id)
    const calls = [sensoryApi.getMap, sensoryApi.getPlaces].map(fn => fn.mock.calls.length)
    city.preferences.value.lowStimulus = true
    await nextTick()
    expect(city.recommendations.value.map(place => place.id)).toEqual(order)
    expect([sensoryApi.getMap, sensoryApi.getPlaces].map(fn => fn.mock.calls.length)).toEqual(calls)
    expect(city).not.toHaveProperty('lowZones')
    scope.stop()
  })
  it('sends the exact long-side radius to places when the backend supports it, while the map keeps backend steps', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    sensoryApi.supportsFreeRadius = true
    try {
      const { scope, city } = located()
      await nextTick()
      city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 1234 })
      await nextTick()
      expect(sensoryApi.getPlaces.mock.calls.at(-1)[0].radius).toBe(1240)
      expect(sensoryApi.getMap.mock.calls.at(-1)[0].radius).toBe(1000)
      expect(city.viewTruncated.value).toBe(false)
      city.setMapView({ lat: ZHONGZHENG.lat, lng: ZHONGZHENG.lng, radius: 26200 })
      await nextTick()
      expect(sensoryApi.getPlaces.mock.calls.at(-1)[0].radius).toBe(20000)
      // max 只送給正式 places，不送給感官地圖。
      expect(sensoryApi.getPlaces.mock.calls.at(-1)[0].max).toBe(100)
      expect(sensoryApi.getMap.mock.calls.at(-1)[0]).not.toHaveProperty('max')
      expect(city.viewTruncated.value).toBe(true)
      expect(city.searchCap).toBe(20000)
      scope.stop()
    } finally { sensoryApi.supportsFreeRadius = false }
  })
})

describe('remote-mock test scenarios (issue #4)', () => {
  const liveApis = () => [sensoryApi.getMap, sensoryApi.getPlaces]
  function setup() {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: vi.fn() } })
    for (const fn of [sensoryApi.getOverview, sensoryApi.getMap, sensoryApi.getPlaces]) fn.mockResolvedValue({ data: { places: [], cells: [] }, meta: {} })
    // 樣本場所都在中正區座標附近（約 1 公里內）。
    return located(vi.fn(), at(25.0333, 121.5358))
  }
  it('stops live map and places queries, asks the mock API for the scenario only and blocks writes', async () => {
    mockApi.getPlaces.mockResolvedValue(mockPayloadFor())
    const { scope, city } = setup()
    await nextTick()
    for (const fn of liveApis()) fn.mockClear()
    city.preferences.value.dataMode = 'remote-mock'
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    for (const fn of liveApis()) expect(fn).not.toHaveBeenCalled()
    expect(mockApi.getPlaces).toHaveBeenCalledTimes(1)
    expect(mockApi.getPlaces.mock.calls[0][0]).toEqual({ scenario: 'weekday_day' })
    expect(city.remoteMock.value).toBe(true)
    expect(city.writesEnabled.value).toBe(false)
    expect(city.places.data.value).toBeNull()
    expect(city.map.data.value).toBeNull()
    const ids = city.recommendations.value.map(place => place.id)
    expect(ids.slice(-2).sort()).toEqual([CLOSED_ID, UNKNOWN_ID].sort())
    expect(ids).toEqual(expect.arrayContaining([DAAN_ID, PLAIN_ID]))
    expect(city.recommendations.value.every(place => place.mock && place.mockAssessment)).toBe(true)
    expect(city.recommendations.value.find(place => place.id === CLOSED_ID).mockAssessment.quiet).toBeNull()
    scope.stop()
  })
  it('cancels the previous scenario so a late reply cannot replace the newer one', async () => {
    const pending = []
    mockApi.getPlaces.mockImplementation((query, { signal }) => new Promise(resolve => pending.push({ query, signal, resolve })))
    const { scope, city } = setup()
    city.preferences.value.dataMode = 'remote-mock'
    await nextTick()
    city.preferences.value.scenario = 'weekday_evening'
    await nextTick()
    expect(pending.map(item => item.query.scenario)).toEqual(['weekday_day', 'weekday_evening'])
    expect(pending[0].signal.aborted).toBe(true)
    pending[1].resolve(mockPayloadFor('weekday_evening'))
    await Promise.resolve()
    pending[0].resolve(mockPayloadFor('weekday_day'))
    await Promise.resolve()
    expect(city.mock.data.value.places[0].scenario).toBe('weekday_evening')
    scope.stop()
    expect(pending[1].signal.aborted).toBe(true)
  })
  it('lists only points inside the map circle', async () => {
    const far = mockPlaceFor({ id: '22222222-3333-5444-8555-666666666666', name: '遠方場所', location: { lat: 25.13, lng: 121.5 } })
    mockApi.getPlaces.mockResolvedValue(mockPayloadFor('weekday_day', [...mockPlacesFor(), far]))
    const { scope, city } = setup()
    city.preferences.value.dataMode = 'remote-mock'
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    expect(city.recommendations.value.map(place => place.name)).not.toContain('遠方場所')
    city.setMapView({ lat: 25.13, lng: 121.5, radius: 800 })
    await nextTick()
    expect(city.recommendations.value.map(place => place.name)).toEqual(['遠方場所'])
    expect(mockApi.getPlaces).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('shows a mock API error without falling back to built-in mock data', async () => {
    mockApi.getPlaces.mockRejectedValue(Object.assign(new Error('測試資料暫時無法使用（503），請稍後再試。'), { status: 503 }))
    const { scope, city } = setup()
    city.preferences.value.dataMode = 'remote-mock'
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    expect(city.mock.state.value).toBe('error')
    expect(city.mock.error.value).toContain('503')
    expect(city.recommendations.value).toEqual([])
    expect(sensoryApi.getPlaces).not.toHaveBeenCalled()
    scope.stop()
  })
  it('leaves no mock residue after switching back to live data', async () => {
    mockApi.getPlaces.mockResolvedValue(mockPayloadFor())
    const { scope, city } = setup()
    city.preferences.value.dataMode = 'remote-mock'
    await nextTick(); await Promise.resolve(); await Promise.resolve()
    expect(city.recommendations.value.length).toBeGreaterThan(0)
    sensoryApi.getPlaces.mockClear()
    city.preferences.value.dataMode = 'live'
    await nextTick()
    expect(city.mock.data.value).toBeNull()
    expect(city.mock.state.value).toBe('idle')
    expect(city.writesEnabled.value).toBe(true)
    expect(sensoryApi.getPlaces).toHaveBeenCalledTimes(1)
    await Promise.resolve(); await Promise.resolve()
    expect(city.recommendations.value.some(place => place.mock)).toBe(false)
    scope.stop()
  })
})
