// test 場所情境（Ynn622/30w#7，2026-11-08 契約）：GET test/places 與 test/places/{id}，三種典型情境。
// 與正式 places 同時請求、再依明確身份合併（見 placeSources.js）；獨立於正式 sensoryApi，不走內建虛構資料備援，錯誤如實顯示。
// 感官四維是典型時段人工推估（timeBasis: typical_scenario），沒有觀測時間或樣本數，不計 SSI；照片固定為 null，不借正式照片。
import { apiRequest } from './apiClient.js'
import { SCENARIOS, isCoordinate } from './sensoryDomain.js'
import { TEST_PLACES_DATASET_VERSION } from './sensoryIndex.js'

// 情境時間依後端契約（週三／週六，排除假日與特殊活動）；定義在 sensoryDomain（偏好設定共用）。
export { SCENARIOS, TEST_PLACES_DATASET_VERSION }
export const SCENARIO_LABEL = '典型時段推估・非即時'
export const isScenario = value => SCENARIOS.some(item => item.id === value)
export const scenarioOf = id => SCENARIOS.find(item => item.id === id) || null
const QUERY_KEYS = ['areaId', 'lat', 'lng', 'radius', 'max']

// 後端把每筆 test 場所的 tag 填成「場所情境測試」之類的佔位字；不是場所特徵，清掉後畫面改用預設標籤。
const cleanTag = place => typeof place.tag === 'string' && /測試|mock|test/i.test(place.tag) ? { ...place, tag: null } : place

export class TestPlacesError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'TestPlacesError'; Object.assign(this, details) }
}

export function validTestPlacesMeta(meta, scenario) {
  return Boolean(meta) && meta.test === true && meta.demo === true && meta.mode === 'test-only'
    && meta.datasetVersion === TEST_PLACES_DATASET_VERSION && meta.timeBasis === 'typical_scenario' && meta.scenario === scenario
}
export function validTestPlace(place, scenario) {
  if (!place || typeof place.id !== 'string' || !place.id || typeof place.name !== 'string' || !isCoordinate(place.location)) return false
  const data = place.testData
  // 正式指數與觀測欄位必須維持 null，否則可能被誤當正式觀測。
  return Boolean(data) && data.datasetVersion === TEST_PLACES_DATASET_VERSION && data.timeBasis === 'typical_scenario' && data.scenario === scenario
    && place.sensoryIndex == null && place.observedAt == null && place.updatedAt == null
}

function describe(error) {
  if (error?.code === 'CANCELLED' || error instanceof TestPlacesError) return error
  const status = error?.status
  const message = status === 404 ? '查無此場所情境資料，或測試接口未啟用（404）。'
    : status === 503 ? '場所情境資料尚未就緒（503），請稍後再試。'
      : status === 429 ? '查詢太頻繁，請稍後再試（429）。'
        : status === 400 ? '場所情境查詢參數不正確（400）。'
          : status === 403 ? '此網址不允許讀取場所情境資料（403）。'
            : error?.message || '場所情境資料讀取失敗。'
  return new TestPlacesError(message, { status, code: error?.code })
}

export function createTestPlacesApi({ request = apiRequest } = {}) {
  return {
    // 只送後端接受的欄位（未知或重複參數會 400）；scenario 必填，不送 low 感官篩選或 hourly 的 dayType／hour。
    async getPlaces({ scenario, ...query } = {}, { signal } = {}) {
      if (!isScenario(scenario)) throw new TestPlacesError('未知的場所情境。')
      const params = Object.fromEntries(QUERY_KEYS.filter(key => query[key] != null).map(key => [key, query[key]]))
      if (params.radius != null) params.radius = Math.max(1, Math.round(params.radius))
      let payload
      try { payload = (await request('test/places', { query: { ...params, scenario }, signal })).data } catch (error) { throw describe(error) }
      if (!validTestPlacesMeta(payload?.meta, scenario) || !Array.isArray(payload?.data?.places) || !payload.data.places.every(place => validTestPlace(place, scenario))) {
        throw new TestPlacesError('場所情境資料格式不符（版本、情境或場所欄位）。')
      }
      return { data: { places: payload.data.places.map(cleanTag) }, meta: payload.meta }
    },
    // 詳情只接受 scenario；回傳的 id 必須與請求一致。
    async getPlace(id, scenario, { signal } = {}) {
      if (typeof id !== 'string' || !id) throw new TestPlacesError('場所編號不正確。')
      if (!isScenario(scenario)) throw new TestPlacesError('未知的場所情境。')
      let payload
      try { payload = (await request(`test/places/${encodeURIComponent(id)}`, { query: { scenario }, signal })).data } catch (error) { throw describe(error) }
      if (!validTestPlacesMeta(payload?.meta, scenario) || !validTestPlace(payload?.data, scenario) || payload.data.id !== id) {
        throw new TestPlacesError('場所情境詳情格式不符或編號不一致。')
      }
      return { data: cleanTag(payload.data), meta: payload.meta }
    },
  }
}
export const testPlacesApi = createTestPlacesApi()
