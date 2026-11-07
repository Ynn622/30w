// 測試專用 Mock API（Ynn622/30w#4）：獨立於正式 sensoryApi，不走內建 quietMock 備援。
// 分數為人工情境推估的合成值，沒有觀測時間；不偽造時間、樣本數或 ssi 版本，也不混入正式 SSI／安靜程度。
import { apiRequest } from './apiClient.js'
import apiConfig from '../config/apiConfig.js'
import { isCoordinate } from './sensoryDomain.js'

export const MOCK_DATASET_VERSION = 'taipei-sensory-mock-v1'
export const MOCK_MAPPING_VERSION = 'mock-band-normal-v1'
export const MOCK_SCENARIOS = Object.freeze([
  { id: 'weekday_day', label: '平日白天', detail: '週三 14:00–16:00' },
  { id: 'weekday_evening', label: '平日晚上', detail: '週三 19:00–21:00' },
  { id: 'weekend_day', label: '週末白天', detail: '週六 14:00–16:00' },
])
export const MOCK_LABEL = '人工情境推估・合成分數・非即時'
export const OPEN_STATUSES = Object.freeze(['open', 'partial', 'closed', 'unknown'])
const SYNTHETIC_KEYS = ['light', 'crowd', 'odor']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const validScore = value => value === null || (Number.isInteger(value) && value >= 0 && value <= 100)
const isScenario = id => MOCK_SCENARIOS.some(item => item.id === id)

export class MockDataError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'MockDataError'; Object.assign(this, details) }
}

// 照片只允許同一筆 Mock 場所的精確 test 路徑，並以 API origin 解析（不是 Pages origin）。
export function mockPhotoUrl(place, baseURL = apiConfig.baseURL) {
  if (!place?.photo || !UUID.test(place.id || '')) return null
  const expected = `/api/v1/test/mock/places/${place.id}/photo`
  if (place.photo.url !== expected) return null
  try { return new URL(expected, new URL(baseURL).origin).href } catch { return null }
}

function validPhoto(photo, id) {
  if (photo === null) return true
  return Boolean(photo) && typeof photo.author === 'string' && typeof photo.license === 'string'
    && photo.url === `/api/v1/test/mock/places/${id}/photo`
}
export function validMockPlace(place, scenario) {
  if (!place || !UUID.test(place.id || '') || typeof place.name !== 'string' || !isCoordinate(place.location)) return false
  if (place.scenario !== scenario || !OPEN_STATUSES.includes(place.openStatus)) return false
  const senses = place.senses
  if (!senses || senses.noise !== null || !SYNTHETIC_KEYS.every(key => validScore(senses[key]))) return false
  const sound = place.sound
  if (!sound || sound.unit !== 'dB(A)' || !(sound.value === null || Number.isFinite(sound.value))) return false
  return validPhoto(place.photo, place.id)
}
export function validMockMeta(meta, scenario) {
  return Boolean(meta) && meta.mock === true && meta.mode === 'test-only' && meta.datasetVersion === MOCK_DATASET_VERSION
    && meta.mapping?.version === MOCK_MAPPING_VERSION && meta.scenario === scenario
}
function validPointMap(map, places) {
  if (map?.type !== 'FeatureCollection' || !Array.isArray(map.features)) return false
  const ids = new Set(places.map(place => place.id))
  // 座標順序為 [lng, lat]。
  return map.features.every(feature => feature?.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates)
    && isCoordinate({ lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }) && ids.has(feature.id))
}

// 後端錯誤轉成可顯示的說明；不改用內建模擬資料。
function describe(error) {
  if (error?.code === 'CANCELLED') return error
  const status = error?.status
  const message = status === 404 ? '測試資料未啟用或查無此場所（404）。'
    : status === 503 ? '測試資料暫時無法使用（503），請稍後再試。'
      : status === 429 ? '查詢太頻繁，請稍後再試（429）。'
        : status === 400 ? '測試資料查詢參數不正確（400）。'
          : status === 403 ? '此網址不允許讀取測試資料（403）。'
            : error?.message || '測試資料讀取失敗。'
  return new MockDataError(message, { status, code: error?.code })
}

export function createMockApi({ request = apiRequest } = {}) {
  async function get(path, query, signal) {
    try { return (await request(path, { query, signal })).data }
    catch (error) { throw describe(error) }
  }
  return {
    // 一次取得該情境全臺北 60 個設施代表點；不帶圈選，也不送正式 places 的 max 等參數。
    async getPlaces({ scenario } = {}, { signal } = {}) {
      if (!isScenario(scenario)) throw new MockDataError('未知的測試情境。')
      const payload = await get('test/mock/places', { scenario }, signal)
      if (!validMockMeta(payload?.meta, scenario) || !Array.isArray(payload?.data?.places)) throw new MockDataError('測試資料格式不符（版本或情境不一致）。')
      const places = payload.data.places
      if (!places.every(place => validMockPlace(place, scenario)) || !validPointMap(payload.data.map, places)) throw new MockDataError('測試資料格式不符（場所、分數或點位）。')
      return { data: { places, map: payload.data.map }, meta: payload.meta }
    },
    async getPlace(id, { scenario } = {}, { signal } = {}) {
      if (!UUID.test(id || '')) throw new MockDataError('測試場所編號不正確。')
      if (!isScenario(scenario)) throw new MockDataError('未知的測試情境。')
      const payload = await get(`test/mock/places/${encodeURIComponent(id)}`, { scenario }, signal)
      if (!validMockMeta(payload?.meta, scenario) || !validMockPlace(payload?.data, scenario) || payload.data.id !== id) throw new MockDataError('測試場所資料格式不符或編號不一致。')
      return { data: payload.data, meta: payload.meta }
    },
  }
}
export const mockApi = createMockApi()

// 合成安靜度：只用三項合成刺激（光線、人潮、氣味）依使用者敏感度佔比加權，聲音另列 dB(A)。
// 只用於測試情境的排序與標示，不是正式安靜程度（SFS），休館或狀態未知不給分。
export function assessMockPlace(place, sensitivities = {}) {
  const dimensions = { noise: null, ...Object.fromEntries(SYNTHETIC_KEYS.map(key => [key, place?.senses?.[key] ?? null])) }
  const available = SYNTHETIC_KEYS.filter(key => Number.isInteger(dimensions[key]))
  const weightOf = key => Number.isFinite(sensitivities[key]) && sensitivities[key] > 0 ? sensitivities[key] : 1
  const total = available.reduce((sum, key) => sum + weightOf(key), 0)
  const usable = !['closed', 'unknown'].includes(place?.openStatus) && available.length > 0
  const quiet = usable ? Math.round(Number((100 - available.reduce((sum, key) => sum + dimensions[key] * weightOf(key), 0) / total).toFixed(6))) : null
  return { dimensions, quiet, available: available.length }
}
// 測試情境的清單排序：可前往（open／partial）在前，休館與未知在後；再依距離或合成安靜度。
export function rankMockPlaces(places, sort = 'fit') {
  const unavailable = place => ['closed', 'unknown'].includes(place.openStatus) ? 1 : 0
  return [...places].sort((a, b) => unavailable(a) - unavailable(b)
    || (sort === 'fit' ? (b.mockAssessment?.quiet ?? -1) - (a.mockAssessment?.quiet ?? -1) : 0)
    || (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)
    || a.id.localeCompare(b.id))
}
