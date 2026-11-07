import { computed, onScopeDispose, ref, watch } from 'vue'
import { sensoryApi } from '../lib/sensoryApi.js'
import { AREAS, isCoordinate, readPreferences } from '../lib/sensoryDomain.js'
import { getNativeChannel } from '../lib/webview.js'
import { requestNative } from '../lib/nativeClient.js'

function useRemote(query, fetcher) {
  const data = ref(null), meta = ref(null), state = ref('loading'), error = ref('')
  let controller, serial = 0
  async function reload() {
    controller?.abort()
    controller = new AbortController()
    const current = ++serial
    state.value = 'loading'; error.value = ''; data.value = null; meta.value = null
    try {
      const response = await fetcher(query.value, { signal: controller.signal })
      if (current !== serial) return
      data.value = response.data; meta.value = response.meta; state.value = 'ready'
    } catch (reason) {
      if (current !== serial) return
      error.value = reason.message; state.value = 'error'
    }
  }
  watch(query, reload, { immediate: true })
  onScopeDispose(() => { serial++; controller?.abort() })
  return { data, meta, state, error, reload }
}
export function useQuietCity(notify) {
  const areaId = ref(AREAS[0].id), deviceLocation = ref(null), locating = ref(false)
  const area = computed(() => AREAS.find(item => item.id === areaId.value) || AREAS[0])
  const center = computed(() => deviceLocation.value || area.value)
  let storage
  try { storage = window.localStorage } catch { /* 私密瀏覽仍可在記憶體使用。 */ }
  const preferences = ref(readPreferences(storage))
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
  watch(areaId, () => { deviceLocation.value = null })
  const query = computed(() => ({ areaId: areaId.value, lat: center.value.lat, lng: center.value.lng, radius: preferences.value.radius }))
  const placeQuery = computed(() => ({ ...query.value,
    noise: preferences.value.noise ? 'low' : 'any', light: preferences.value.light ? 'low' : 'any',
    crowd: preferences.value.crowd ? 'low' : 'any', indoor: preferences.value.indoor,
  }))
  const overview = useRemote(query, sensoryApi.getOverview)
  const map = useRemote(query, sensoryApi.getMap)
  const places = useRemote(placeQuery, sensoryApi.getPlaces)
  // 正式資料每分鐘重取，防止頁面長時間開啟後仍把過期觀測當成現在。
  const refresh = () => { overview.reload(); map.reload(); places.reload() }
  const resume = () => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') refresh() }
  let refreshTimer
  if (sensoryApi.mode === 'api') {
    refreshTimer = setInterval(resume, 60_000)
    window.addEventListener?.('focus', resume)
  }
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
          if (!navigator.geolocation) return reject(new Error('此裝置不支援定位，請選擇區域。'))
          navigator.geolocation.getCurrentPosition(
            position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => reject(new Error('未取得定位，請檢查權限，或繼續使用手動區域。')),
            { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
          )
        })
      }
      if (disposed) return null
      if (!isCoordinate(result)) throw new Error('App 未回傳有效座標，請使用手動區域。')
      deviceLocation.value = { ...result, source: 'device', label: '目前位置' }
      notify('已使用目前位置，座標僅保留於本次操作。')
      return deviceLocation.value
    } catch (reason) { if (!disposed) notify(reason.message); return null }
    finally { locating.value = false }
  }
  function toggleFavorite(id) {
    favorites.value = favorites.value.includes(id) ? favorites.value.filter(value => value !== id) : [...favorites.value, id].slice(-100)
    notify(favorites.value.includes(id) ? '已收進我的安靜角落' : '已取消收藏')
  }
  const reportLocation = computed(() => ({ lat: center.value.lat, lng: center.value.lng,
    source: deviceLocation.value ? 'device' : 'manual', areaId: areaId.value,
    label: deviceLocation.value ? '目前位置' : `${area.value.name}手動區域中心`,
  }))
  onScopeDispose(() => { disposed = true; locationController?.abort(); clearInterval(refreshTimer); window.removeEventListener?.('focus', resume) })
  return { mode: sensoryApi.mode, areaId, area, center, deviceLocation, preferences, favorites, overview, map, places, locating, locate, toggleFavorite, reportLocation }
}
