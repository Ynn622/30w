import { computed, onScopeDispose, ref, watch } from 'vue'
import { MOCK_NOTICE, sensoryApi } from '../lib/sensoryApi.js'
import { MAX_SEARCH_RADIUS, SEARCH_RADIUS, distanceMeters, isCoordinate, nearestArea, pickSearchRadius, readPreferences } from '../lib/sensoryDomain.js'
import { getNativeChannel } from '../lib/webview.js'
import { requestNative } from '../lib/nativeClient.js'
import { assessSensory, rankPlaces } from '../lib/sensoryIndex.js'
import { reverseGeocoder } from '../lib/reverseGeocode.js'
import { readNoiseHistory, saveNoiseEntry } from '../lib/noiseHistory.js'
import { fakeLocation } from '../config/locationConfig.js'

function useRemote(query, fetcher) {
  // source 只在請求完成時更新，重新載入期間保留上一次結果，避免通知反覆跳出。
  const data = ref(null), meta = ref(null), state = ref('loading'), error = ref(''), source = ref(null)
  let controller, serial = 0
  async function reload() {
    controller?.abort()
    const current = ++serial
    // 尚未定位或不在服務範圍時不呼叫後端。
    if (!query.value) { controller = null; state.value = 'idle'; error.value = ''; data.value = null; meta.value = null; return }
    controller = new AbortController()
    state.value = 'loading'; error.value = ''; data.value = null; meta.value = null
    try {
      const response = await fetcher(query.value, { signal: controller.signal })
      if (current !== serial) return
      data.value = response.data; meta.value = response.meta; state.value = 'ready'; source.value = response.meta?.mock ? 'mock' : 'api'
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
export function useQuietCity(notify) {
  // 目前只開放使用裝置定位，不提供手動選區；行政區由定位座標推估。
  const deviceLocation = ref(null), locating = ref(false), locationError = ref('')
  const area = computed(() => deviceLocation.value ? nearestArea(deviceLocation.value) : null)
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
  const searchRadius = computed(() => pickSearchRadius(mapView.value?.radius))
  // 地圖範圍超過後端上限（1 公里）時只查中心範圍，畫面需提示放大地圖。
  const viewTruncated = computed(() => (mapView.value?.radius ?? 0) > MAX_SEARCH_RADIUS)
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
    if (!moved && pickSearchRadius(radius) === pickSearchRadius(previous.radius) && (radius > MAX_SEARCH_RADIUS) === (previous.radius > MAX_SEARCH_RADIUS)) return
    mapView.value = { lat: moved ? view.lat : previous.lat, lng: moved ? view.lng : previous.lng, radius }
  }
  const mapQuery = computed(() => searchArea.value
    ? { areaId: searchArea.value.id, lat: searchCenter.value.lat, lng: searchCenter.value.lng, radius: searchRadius.value } : null)
  // 已移除使用者感官篩選，地點查詢只帶區域、座標與固定範圍。
  const placeQuery = mapQuery
  const overview = useRemote(query, sensoryApi.getOverview)
  const map = useRemote(mapQuery, sensoryApi.getMap)
  const places = useRemote(placeQuery, sensoryApi.getPlaces)
  // 篩選範圍以地圖中心計算，但清單顯示的直線距離一律從目前位置算。
  const recommendations = computed(() => rankPlaces((places.data.value?.places || []).map(place => ({
    ...place, distanceM: distanceMeters(center.value, place.location) ?? place.distanceM, assessment: assess(place, places.meta.value),
  })), preferences.value.sort))
  // 任一資料改用模擬就視為模擬模式；三者都取得後端資料才算恢復。
  const dataSource = computed(() => {
    const sources = [overview, map, places].map(remote => remote.source.value)
    return sources.includes('mock') ? 'mock' : sources.every(value => value === 'api') ? 'api' : null
  })
  const usingMock = computed(() => dataSource.value === 'mock')
  const fallbackReason = computed(() => [overview, map, places].map(remote => remote.meta.value?.fallbackReason).find(Boolean) || '')
  // 三種資料都回應後才通知，並指出哪些部分改用模擬資料（後端可能只完成部分接口）。
  const PART_LABELS = ['感官概況', '感官地圖', '場所清單']
  let announced = ''
  watch(() => [overview, map, places].map(remote => remote.source.value), sources => {
    if (!sources.every(Boolean)) return
    const parts = PART_LABELS.filter((_, index) => sources[index] === 'mock')
    const key = parts.join('、')
    if (key === announced) return
    if (parts.length === PART_LABELS.length) notify(MOCK_NOTICE)
    else if (parts.length) notify(`${key}暫時無法取得後端資料，已改用模擬資料顯示。`)
    else notify('已連上後端，改為顯示後端資料。')
    announced = key
  })
  // 正式資料每分鐘重取，防止頁面長時間開啟後仍把過期觀測當成現在。
  const refresh = () => { now.value = Date.now(); overview.reload(); map.reload(); places.reload() }
  const resume = () => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') refresh() }
  // 使用模擬資料時也持續重試後端，後端上線後自動切回。
  const refreshTimer = setInterval(resume, 60_000)
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
  return { noiseHistory, recordNoise, mapCenter, mapView, searchRadius, viewTruncated, searchArea, searchAvailable, searchingElsewhere, setMapView, dataSource, usingMock, fallbackReason, reportIntensityEnabled, now, refresh, assess, recommendations, areaId, area, center, deviceLocation, locationStatus, locationError, serviceAvailable, address, addressState, preferences, overview, map, places, locating, locate, reportLocation }
}
