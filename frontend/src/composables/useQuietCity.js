import { computed, onScopeDispose, ref, watch } from 'vue'
import { MOCK_NOTICE, sensoryApi } from '../lib/sensoryApi.js'
import { findVillage } from '../lib/villages.js'
import { AREAS, PLACES_MAX, SEARCH_RADIUS, distanceMeters, isCoordinate, nearestArea, pickSearchRadius, placesRadius, placesRadiusCap, readPreferences, taipeiSlot } from '../lib/sensoryDomain.js'
import { getNativeChannel } from '../lib/webview.js'
import { requestNative } from '../lib/nativeClient.js'
import { assessSensory, rankPlaces } from '../lib/sensoryIndex.js'
import { reverseGeocoder } from '../lib/reverseGeocode.js'
import { readNoiseHistory, saveNoiseEntry } from '../lib/noiseHistory.js'
import { fakeLocation } from '../config/locationConfig.js'
import { cropGrid, hourlyApi } from '../lib/hourlyApi.js'
import { tianmuApi } from '../lib/tianmuApi.js'

function useRemote(query, fetcher) {
  // source 只在請求完成時更新，重新載入期間保留上一次結果，避免通知反覆跳出。
  const data = ref(null), meta = ref(null), state = ref('loading'), error = ref(''), source = ref(null)
  let controller, serial = 0
  async function reload() {
    controller?.abort()
    const current = ++serial
    // 尚未定位或不在服務範圍時不呼叫後端。
    if (!query.value) { controller = null; state.value = 'idle'; error.value = ''; data.value = null; meta.value = null; source.value = null; return }
    controller = new AbortController()
    state.value = 'loading'; error.value = ''; data.value = null; meta.value = null
    try {
      const response = await fetcher(query.value, { signal: controller.signal })
      if (current !== serial) return
      data.value = response.data; meta.value = response.meta; state.value = 'ready'
      // 後端 test/mock 接口（mode: test-only）目前當正式資料對待，不是內建模擬備援，不觸發「已改用模擬資料」通知。
      source.value = response.meta?.mode === 'test-only' || !response.meta?.mock ? 'api' : 'mock'
    } catch (reason) {
      if (current !== serial) return
      error.value = reason.message; state.value = 'error'
    }
  }
  // 以查詢內容比較：值沒變（例如只切換「超出範圍」提示）就不重新請求。
  watch(() => JSON.stringify(query.value ?? null), reload, { immediate: true })
  onScopeDispose(() => { serial++; controller?.abort() })
  return { data, meta, state, error, source, reload }
}
// 首頁、地圖與清單資料的自動重取間隔（頁面在背景時跳過；切回視窗時另外立即重取）。
export const REFRESH_INTERVAL_MS = 2 * 60_000
export function useQuietCity(notify) {
  // 目前只開放使用裝置定位，不提供手動選區。
  const deviceLocation = ref(null), locating = ref(false), locationError = ref('')
  // 所在的里：以臺北市里界在裝置端判斷（里界第一次需要時才載入）；載入前或找不到時為 null。
  const village = ref(null)
  let villageRequest = 0
  watch(deviceLocation, async location => {
    const request = ++villageRequest
    village.value = null
    if (!location) return
    const found = await findVillage(location).catch(() => null)
    if (request === villageRequest) village.value = found
  })
  // 行政區：有里時以里界所屬的區為準（區界判斷精確）；里界尚未載入或找不到時，退回最近區代表點推估。
  const area = computed(() => {
    if (!deviceLocation.value) return null
    return AREAS.find(item => item.name === village.value?.district) || nearestArea(deviceLocation.value)
  })
  const areaId = computed(() => area.value?.id ?? null)
  const center = computed(() => deviceLocation.value)
  // idle：尚未定位；locating：第一次定位中；ready：在臺北市內；outside：不在臺北市；error：定位失敗。
  const locationStatus = computed(() => {
    if (deviceLocation.value) return area.value ? 'ready' : 'outside'
    if (locating.value) return 'locating'
    return locationError.value ? 'error' : 'idle'
  })
  const serviceAvailable = computed(() => locationStatus.value === 'ready')
  let storage
  try { storage = window.localStorage } catch { /* 私密瀏覽仍可在記憶體使用。 */ }
  const preferences = ref(readPreferences(storage))
  const now = ref(Date.now())
  function assess(record, meta) {
    return assessSensory(record, preferences.value.sensitivities, now.value)
  }
  // 收藏功能已移除：清掉舊版留在此裝置的收藏編號。
  try { storage?.removeItem('quiet-city-favorites') } catch { /* 無法存取儲存空間時略過。 */ }
  function persist(key, data) {
    try {
      if (!storage) throw new Error('unavailable')
      storage.setItem(key, JSON.stringify(data))
    } catch { notify('瀏覽器無法儲存設定，本次仍可使用；關閉後可能遺失。') }
  }
  watch(preferences, value => persist('quiet-city-preferences', value), { deep: true })
  // 最近的環境音量量測（含使用者感受）保留在此裝置，關閉量測面板後仍可回顧。
  const noiseHistory = ref(readNoiseHistory(storage))
  function recordNoise(entry) {
    const result = saveNoiseEntry(noiseHistory.value, entry, storage)
    noiseHistory.value = result.history
    if (!result.saved) notify('瀏覽器無法儲存量測紀錄，本次仍可查看；關閉後可能遺失。')
  }
  // 只在定位成功且位於臺北市時查一次地址（不隨輪詢重查）；失敗時畫面退回顯示行政區。
  const address = ref(''), addressState = ref('idle')
  let addressController
  watch(deviceLocation, async location => {
    addressController?.abort(); address.value = ''
    if (!location || !serviceAvailable.value) { addressState.value = 'idle'; return }
    const controller = addressController = new AbortController()
    addressState.value = 'loading'
    try {
      const result = await reverseGeocoder.lookup(location, { signal: controller.signal })
      if (controller !== addressController) return
      address.value = result.address; addressState.value = 'ready'
    } catch {
      if (controller === addressController) addressState.value = 'error'
    }
  })
  const query = computed(() => serviceAvailable.value
    ? { areaId: areaId.value, lat: center.value.lat, lng: center.value.lng, radius: SEARCH_RADIUS } : null)
  // 探索地圖停止移動後，地點與熱區改抓地圖中心附近；首頁概況與回報位置仍用目前定位。
  // mapView：地圖停止移動後的中心與可視半徑；未操作地圖前用目前位置與預設半徑。
  const mapView = ref(null)
  const mapCenter = computed(() => mapView.value ? { lat: mapView.value.lat, lng: mapView.value.lng } : null)
  const searchCenter = computed(() => serviceAvailable.value ? (mapCenter.value || center.value) : null)
  // places 依地圖長邊半徑，後端支援時送精確值（searchRadius 為舊的 300／500／1000 級距，僅用來判斷是否需重查）。
  // 場所清單與詳情的資料來源：目前先以天母場所接口（test/mock/tianmu/places）當正式資料使用（開發者 2026-11-08 決定）。
  // 之後改接正式 places 時，只要把 placesApi 換成 sensoryApi（getPlaces／getPlace／supportsFreeRadius 介面相同）即可。
  const placesApi = tianmuApi
  const freeRadius = { free: Boolean(placesApi.supportsFreeRadius) }
  const searchRadius = computed(() => pickSearchRadius(mapView.value?.radius))
  const placesSearchRadius = computed(() => placesRadius(mapView.value?.radius, freeRadius))
  const searchCap = placesRadiusCap(freeRadius)
  // 地圖範圍超過後端上限（1 公里）時只查中心範圍，畫面需提示放大地圖。
  const viewTruncated = computed(() => (mapView.value?.radius ?? 0) > searchCap)
  const searchArea = computed(() => searchCenter.value ? nearestArea(searchCenter.value) : null)
  // 地圖中心離目前位置超過 100 公尺才視為在看別處（標示用）。
  const searchingElsewhere = computed(() => Boolean(mapCenter.value && center.value && distanceMeters(mapCenter.value, center.value) > 100))
  const searchAvailable = computed(() => Boolean(searchArea.value))
  function setMapView(view) {
    if (!serviceAvailable.value || !isCoordinate(view)) return
    const radius = Number.isFinite(view.radius) && view.radius > 0 ? view.radius : (mapView.value?.radius ?? null)
    // 移動不到 80 公尺且半徑級距不變時不重新查詢，避免輕微拖動就打後端。
    const previous = mapView.value || { ...center.value, radius: null }
    const moved = distanceMeters(previous, view) >= 80
    const radiusKey = value => [pickSearchRadius(value), placesRadius(value, freeRadius), value > searchCap].join('|')
    if (!moved && radiusKey(radius) === radiusKey(previous.radius)) return
    mapView.value = { lat: moved ? view.lat : previous.lat, lng: moved ? view.lng : previous.lng, radius }
  }
  // 敏感圖層（熱力圖）一律使用後端逐小時模擬網格 test/mock/hourly（Ynn622/30w#5），不再呼叫 sensory/map：
  // 平常自動取臺北當下的平日／週末與小時；開啟「模擬環境」時改用使用者在探索頁選的時段。
  // 只影響地圖的敏感圖層；具名推薦從 placesApi 取得（網格沒有名稱與照片），首頁概況、回報與量測照常。
  const remoteMock = computed(() => preferences.value.dataMode === 'remote-hourly')
  const getPlace = (id, options) => placesApi.getPlace(id, options)
  const currentSlot = computed(() => taipeiSlot(now.value))
  const fieldSlot = computed(() => remoteMock.value ? { dayType: preferences.value.dayType, hour: preferences.value.hour } : currentSlot.value)
  const searchQuery = computed(() => searchArea.value
    ? { areaId: searchArea.value.id, lat: searchCenter.value.lat, lng: searchCenter.value.lng, radius: searchRadius.value } : null)
  // 地點查詢只帶區域、座標與半徑（已移除使用者感官篩選）；各接口的 radius 規則不同，分開建立。
  const placeQuery = computed(() => searchQuery.value && { ...searchQuery.value, radius: placesSearchRadius.value, max: PLACES_MAX })
  // 首頁概況：後端 test/mock/overview（目前位置 150 公尺內網格平均，時段由後端依當下臺北時間決定），目前當正式資料對待；
  // 只送 lat／lng，失敗時顯示錯誤並可重試，不改用內建模擬資料。
  const overviewQuery = computed(() => query.value && { lat: query.value.lat, lng: query.value.lng })
  const overview = useRemote(overviewQuery, hourlyApi.getOverview)
  const places = useRemote(placeQuery, placesApi.getPlaces)
  // 每個時段一次取回全臺北 30,000 點（gzip 約 0.5 MB，避開每分鐘 100 次限流），再依地圖範圍在前端裁切。
  // 查詢只在時段改變時才變（當下時段每到整點才換），切換時段會取消舊請求。
  const hourlyQuery = computed(() => serviceAvailable.value ? { dayType: fieldSlot.value.dayType, hour: fieldSlot.value.hour } : null)
  const hourly = useRemote(hourlyQuery, hourlyApi.getGrid)
  // 敏感圖層的輸入點：地圖範圍內（外加 400 公尺讓邊緣平滑）的模擬網格。
  const fieldCells = computed(() => cropGrid(hourly.data.value?.points, searchCenter.value, placesSearchRadius.value + 400))
  // 模擬網格的新鮮度以後端的模擬時間判斷，不受裝置時鐘誤差影響。
  const fieldNow = computed(() => Date.parse(hourly.meta.value?.simulatedAt) || now.value)
  // 敏感圖層的載入狀態（錯誤時顯示重試）。
  const fieldSource = computed(() => hourly)
  // 篩選範圍以地圖中心計算，但清單顯示的直線距離一律從目前位置算。
  const livePlaces = computed(() => rankPlaces((places.data.value?.places || []).map(place => ({
    ...place, distanceM: distanceMeters(center.value, place.location) ?? place.distanceM, assessment: assess(place, places.meta.value),
  })), preferences.value.sort))
  const recommendations = livePlaces
  // 任一資料改用模擬就視為模擬模式；三者都取得後端資料才算恢復。
  // 只有場所清單會在後端失敗時改用內建模擬資料；首頁概況與敏感圖層一律呼叫後端，失敗就顯示錯誤並可重試。
  const fallbackParts = [places]
  const dataSource = computed(() => {
    const sources = fallbackParts.map(remote => remote.source.value)
    return sources.includes('mock') ? 'mock' : sources.every(value => value === 'api') ? 'api' : null
  })
  const usingMock = computed(() => dataSource.value === 'mock')
  const fallbackReason = computed(() => fallbackParts.map(remote => remote.meta.value?.fallbackReason).find(Boolean) || '')
  // 清單回應後才通知是否改用模擬資料。
  const PART_LABELS = ['場所清單']
  let announced = ''
  watch(() => fallbackParts.map(remote => remote.source.value), sources => {
    if (!sources.every(Boolean)) return
    const parts = PART_LABELS.filter((_, index) => sources[index] === 'mock')
    const key = parts.join('、')
    if (key === announced) return
    if (parts.length === PART_LABELS.length) notify(MOCK_NOTICE)
    else if (parts.length) notify(`${key}暫時無法取得後端資料，已改用模擬資料顯示。`)
    else notify('已連上後端，改為顯示後端資料。')
    announced = key
  })
  // 正式資料每 2 分鐘重取（後端每 5 分鐘整理一次回報，更頻繁也不會更即時），防止頁面長時間開啟後仍把過期觀測當成現在。
  // 模擬網格不隨定時重新整理重抓；now 更新後若跨到下一個整點，當下時段改變會自動重新查詢。
  const refresh = () => { now.value = Date.now(); overview.reload(); places.reload() }
  const resume = () => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') refresh() }
  // 使用模擬資料時也持續重試後端，後端上線後自動切回。
  const refreshTimer = setInterval(resume, REFRESH_INTERVAL_MS)
  window.addEventListener?.('focus', resume)
  let locationController, disposed = false
  async function locate() {
    if (locating.value) return
    locating.value = true
    try {
      let result
      if (fakeLocation.enabled) {
        // 固定測試位置：不詢問定位權限，並以通知標示不是實際定位。
        result = { lat: fakeLocation.lat, lng: fakeLocation.lng }
        if (!deviceLocation.value) notify(`測試模式：已固定使用${fakeLocation.name}位置，非實際定位。`)
      } else if (getNativeChannel(window) === 'town-pass') {
        locationController = new AbortController()
        const reply = await requestNative('location', null, { host: window, signal: locationController.signal, timeoutMs: 15_000 })
        result = { lat: reply.data?.latitude ?? reply.data?.lat, lng: reply.data?.longitude ?? reply.data?.lng }
      } else {
        result = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('此裝置不支援定位，無法提供服務。'))
          navigator.geolocation.getCurrentPosition(
            position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => reject(new Error('未取得定位，請允許定位權限後重試。')),
            { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
          )
        })
      }
      if (disposed) return null
      if (!isCoordinate(result)) throw new Error('App 未回傳有效座標，請重試。')
      const previous = area.value
      deviceLocation.value = { lat: result.lat, lng: result.lng, source: 'device', label: '目前位置' }
      mapView.value = null
      locationError.value = ''
      if (previous && area.value && previous.id !== area.value.id) notify(`已更新目前位置，區域切換為${area.value.name}。`)
      return deviceLocation.value
    } catch (reason) {
      if (disposed) return null
      locationError.value = reason.message
      // 已有定位時保留原位置，只提示這次更新失敗。
      if (deviceLocation.value) notify(reason.message)
      return null
    }
    finally { locating.value = false }
  }
  const reportLocation = computed(() => serviceAvailable.value ? { lat: center.value.lat, lng: center.value.lng,
    source: 'device', areaId: areaId.value, label: `目前位置（${area.value.name}）` } : null)
  onScopeDispose(() => { disposed = true; locationController?.abort(); addressController?.abort(); clearInterval(refreshTimer); window.removeEventListener?.('focus', resume) })
  // 模擬模式下強度選項可完整操作；後端模式需後端宣告支援。
  const reportIntensityEnabled = computed(() => sensoryApi.supportsReportIntensity || usingMock.value)
  return { village, remoteMock, getPlace, hourly, fieldCells, fieldNow, fieldSource, noiseHistory, recordNoise, mapCenter, mapView, searchRadius, placesSearchRadius, searchCap, viewTruncated, searchArea, searchAvailable, searchingElsewhere, setMapView, dataSource, usingMock, fallbackReason, reportIntensityEnabled, now, refresh, assess, recommendations, areaId, area, center, deviceLocation, locationStatus, locationError, serviceAvailable, address, addressState, preferences, overview, places, locating, locate, reportLocation }
}
