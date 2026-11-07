// 天母 2 公里場所靜態資料（Ynn622/30w#7）：GET test/mock/tianmu/places 與 /{id}。
// 獨立於正式 sensoryApi（正式介接會刻意拒收 mock 資料），不走內建虛構資料備援，錯誤如實顯示。
// 場所與地址來自公開資料快照（dataBasis: reviewed_public_place_snapshot），不是虛構，但也不是即時或現場查核；
// 四維感官、觀測時間全為 null，沒有照片；不混入 hourly 模擬網格、正式投稿或 SSI。
import { apiRequest } from './apiClient.js'
import { isCoordinate } from './sensoryDomain.js'

export const TIANMU_DATASET_VERSION = 'tianmu-places-mock-v1'
export const TIANMU_DATA_BASIS = 'reviewed_public_place_snapshot'
export const TIANMU_LABEL = '天母公開場所靜態資料，非即時'
const QUERY_KEYS = ['areaId', 'lat', 'lng', 'radius', 'max']

// 後端把每筆天母場所的 tag 都填成「靜態Mock場地」；目前當正式資料呈現，含 Mock 字樣的標籤清掉，畫面改用預設標籤。
const cleanPlace = place => typeof place.tag === 'string' && /mock/i.test(place.tag) ? { ...place, tag: null } : place

export class TianmuDataError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'TianmuDataError'; Object.assign(this, details) }
}

export function validTianmuMeta(meta) {
  return Boolean(meta) && meta.mock === true && meta.demo === true && meta.mode === 'test-only'
    && meta.datasetVersion === TIANMU_DATASET_VERSION && meta.dataBasis === TIANMU_DATA_BASIS
}
export function validTianmuPlace(place) {
  return Boolean(place) && typeof place.id === 'string' && place.id.length > 0 && typeof place.name === 'string' && isCoordinate(place.location)
}

function describe(error) {
  if (error?.code === 'CANCELLED' || error instanceof TianmuDataError) return error
  const status = error?.status
  const message = status === 404 ? '查無此天母場所，或資料已撤下（404）。'
    : status === 503 ? '天母場所資料暫時無法使用（503），請稍後再試。'
      : status === 429 ? '查詢太頻繁，請稍後再試（429）。'
        : status === 400 ? '天母場所查詢參數不正確（400）。'
          : status === 403 ? '此網址不允許讀取天母場所資料（403）。'
            : error?.message || '天母場所資料讀取失敗。'
  return new TianmuDataError(message, { status, code: error?.code })
}

export function createTianmuMockPlacesApi({ request = apiRequest } = {}) {
  return {
    supportsFreeRadius: true,
    // 只送後端接受的欄位（未知或重複參數會 400）；不帶 dayType／hour，也不送 low 感官篩選。
    async getPlaces(query = {}, { signal } = {}) {
      const params = Object.fromEntries(QUERY_KEYS.filter(key => query[key] != null).map(key => [key, query[key]]))
      if (params.radius != null) params.radius = Math.max(1, Math.round(params.radius))
      let payload
      try { payload = (await request('test/mock/tianmu/places', { query: params, signal })).data } catch (error) { throw describe(error) }
      if (!validTianmuMeta(payload?.meta) || !Array.isArray(payload?.data?.places) || !payload.data.places.every(validTianmuPlace)) {
        throw new TianmuDataError('天母場所資料格式不符（版本、資料基礎或場所欄位）。')
      }
      return { data: { places: payload.data.places.map(cleanPlace) }, meta: payload.meta }
    },
    // 詳情不接受任何 query；別名詳情保留請求的 id，另附 canonicalId。
    async getPlace(id, { signal } = {}) {
      if (typeof id !== 'string' || !id) throw new TianmuDataError('天母場所編號不正確。')
      let payload
      try { payload = (await request(`test/mock/tianmu/places/${encodeURIComponent(id)}`, { signal })).data } catch (error) { throw describe(error) }
      if (!validTianmuMeta(payload?.meta) || !validTianmuPlace(payload?.data) || payload.data.id !== id) {
        throw new TianmuDataError('天母場所詳情格式不符或編號不一致。')
      }
      return { data: cleanPlace(payload.data), meta: payload.meta }
    },
  }
}
export const tianmuApi = createTianmuMockPlacesApi()
