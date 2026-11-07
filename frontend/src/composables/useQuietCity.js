import { computed, onScopeDispose, ref, watch } from 'vue'
import { MOCK_NOTICE, sensoryApi } from '../lib/sensoryApi.js'
import { isCoordinate, nearestArea, readPreferences } from '../lib/sensoryDomain.js'
import { getNativeChannel } from '../lib/webview.js'
import { requestNative } from '../lib/nativeClient.js'
import { assessSensory, rankPlaces } from '../lib/sensoryIndex.js'
import { reverseGeocoder } from '../lib/reverseGeocode.js'

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
  watch(query, reload, { immediate: true })
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
  const favorites = ref([])
  try {
    const saved = JSON.parse(storage?.getItem('quiet-city-favorites') || '[]')
    if (Array.isArray(saved)) favorites.value = saved.filter(id => typeof id === 'string').slice(0, 100)
  } catch { /* 略過損壞資料。 */ }
  function persist(key, data) {
    try {
      if (!storage) throw new Error('unavailable')
      storage.setItem(key, JSON.stringify(data))
    } catch { notify('瀏覽器無法儲存設定，本次仍可使用；關閉後可能遺失。') }
  }
  watch(preferences, value => persist('quiet-city-preferences', value), { deep: true })
  watch(favorites, value => persist('quiet-city-favorites', value), { deep: true })
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
    ? { areaId: areaId.value, lat: center.value.lat, lng: center.value.lng, radius: preferences.value.radius } : null)
  const placeQuery = computed(() => query.value && ({ ...query.value,
    noise: preferences.value.noise ? 'low' : 'any', light: preferences.value.light ? 'low' : 'any',
    crowd: preferences.value.crowd ? 'low' : 'any', indoor: preferences.value.indoor,
  }))
  const overview = useRemote(query, sensoryApi.getOverview)
  const map = useRemote(query, sensoryApi.getMap)
  const places = useRemote(placeQuery, sensoryApi.getPlaces)
  // Odor and personalization are local additions; do not send unsupported query fields to older backends.
  const recommendations = computed(() => rankPlaces((places.data.value?.places || []).map(place => ({
    ...place, assessment: assess(place, places.meta.value),
  })).filter(place => !preferences.value.odor || (place.assessment.dimensions.odor !== null && place.assessment.dimensions.odor <= 33)), preferences.value.sort))
  // 任一資料改用模擬就視為模擬模式；三者都取得後端資料才算恢復。
  const dataSource = computed(() => {
    const sources = [overview, map, places].map(remote => remote.source.value)
    return sources.includes('mock') ? 'mock' : sources.every(value => value === 'api') ? 'api' : null
  })
  const usingMock = computed(() => dataSource.value === 'mock')
  const fallbackReason = computed(() => [overview, map, places].map(remote => remote.meta.value?.fallbackReason).find(Boolean) || '')
  let announced = null
  watch(dataSource, value => {
    if (!value || value === announced) return
    if (value === 'mock') notify(MOCK_NOTICE)
    else if (announced === 'mock') notify('已連上後端，改為顯示後端資料。')
    announced = value
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
      if (getNativeChannel(window) === 'town-pass') {
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
  function toggleFavorite(id) {
    favorites.value = favorites.value.includes(id) ? favorites.value.filter(value => value !== id) : [...favorites.value, id].slice(-100)
    notify(favorites.value.includes(id) ? '已收進我的安靜角落' : '已取消收藏')
  }
  const reportLocation = computed(() => serviceAvailable.value ? { lat: center.value.lat, lng: center.value.lng,
    source: 'device', areaId: areaId.value, label: `目前位置（${area.value.name}）` } : null)
  onScopeDispose(() => { disposed = true; locationController?.abort(); addressController?.abort(); clearInterval(refreshTimer); window.removeEventListener?.('focus', resume) })
  // 模擬模式下強度選項可完整操作；後端模式需後端宣告支援。
  const reportIntensityEnabled = computed(() => sensoryApi.supportsReportIntensity || usingMock.value)
  return { dataSource, usingMock, fallbackReason, reportIntensityEnabled, now, refresh, assess, recommendations, areaId, area, center, deviceLocation, locationStatus, locationError, serviceAvailable, address, addressState, preferences, favorites, overview, map, places, locating, locate, toggleFavorite, reportLocation }
}
