// 測試專用 hourly Mock（Ynn622/30w#5）：臺北 30,000 個固定網格 × 24 小時 × 平日／週末的人工情境推估。
// 獨立於正式 sensoryApi，不走內建 quietMock 備援；錯誤如實顯示。網格只有座標與四維，沒有名稱或照片，
// 不是可進入場所，只用來畫敏感圖層（具名推薦仍從正式 places 取得）。
import { apiRequest } from './apiClient.js'
import { isCoordinate } from './sensoryDomain.js'
export { taipeiSlot } from './sensoryDomain.js'

export const HOURLY_DATASET_VERSION = 'taipei-hourly-grid-v1'
export const HOURLY_LABEL = '典型時段推估・非即時觀測'
export const DAY_TYPES = Object.freeze([{ id: 'weekday', label: '平日' }, { id: 'weekend', label: '週末' }])
export const HOURS = Object.freeze(Array.from({ length: 24 }, (_, hour) => hour))
// 一次取完整個時段（後端上限 30,000）；仍依 nextOffset 續取，最多 30 頁以防異常回應無限循環。
export const HOURLY_PAGE_LIMIT = 30000
const MAX_PAGES = 30
const GRID_ID = /^tg\d{5}$/
const SENSES = ['noise', 'light', 'crowd', 'odor']
const QUALITIES = ['estimated', 'insufficient']
const validScore = value => value === null || (Number.isInteger(value) && value >= 0 && value <= 100)
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))

export const isDayType = value => DAY_TYPES.some(item => item.id === value)
export const isHour = value => Number.isInteger(value) && value >= 0 && value <= 23
export const hourLabel = hour => `${String(hour).padStart(2, '0')}:00`
export function slotLabel({ dayType, hour } = {}) {
  const day = DAY_TYPES.find(item => item.id === dayType)?.label
  return day && isHour(hour) ? `${day} ${hourLabel(hour)}` : '未選擇時段'
}

export class HourlyDataError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'HourlyDataError'; Object.assign(this, details) }
}

export function validHourlyMeta(meta, { dayType, hour }) {
  return Boolean(meta) && meta.mock === true && meta.demo === true && meta.mode === 'test-only'
    && meta.datasetVersion === HOURLY_DATASET_VERSION && meta.dayType === dayType && meta.hour === hour
    && meta.timeBasis === 'simulated_request_time' && validTime(meta.simulatedAt)
}
export function validHourlyPoint(point) {
  if (!point || !GRID_ID.test(point.id || '') || !isCoordinate(point.location)) return false
  if (point.coordinateKind !== 'synthetic_grid_center' || !QUALITIES.includes(point.quality)) return false
  if (!point.senses || !SENSES.every(key => validScore(point.senses[key]))) return false
  const sound = point.sound
  return Boolean(sound) && sound.unit === 'dB(A)' && (sound.value === null || Number.isFinite(sound.value))
}

// 首頁模擬平均（GET test/mock/overview）：座標 150 公尺內網格的四維算術平均，時段由後端依請求當下的臺北時間決定。
export const OVERVIEW_AGGREGATION_VERSION = 'hourly-radius-mean-v1'
export const OVERVIEW_RADIUS_M = 150
const MISSING_REASONS = [null, 'no_points_within_radius', 'no_valid_mock_values']
const validMean = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 100)
export function validHourlyOverview(payload) {
  const meta = payload?.meta, data = payload?.data
  if (!meta || meta.mock !== true || meta.demo !== true || meta.mode !== 'test-only' || meta.datasetVersion !== HOURLY_DATASET_VERSION) return false
  if (meta.timeBasis !== 'simulated_request_time' || meta.aggregationVersion !== OVERVIEW_AGGREGATION_VERSION || !validTime(meta.simulatedAt)) return false
  if (!data || data.radiusMeters !== OVERVIEW_RADIUS_M || !isDayType(data.dayType) || !isHour(data.hour) || data.dayType !== meta.dayType || data.hour !== meta.hour) return false
  if (!data.senses || !SENSES.every(key => validMean(data.senses[key]))) return false
  if (!Number.isInteger(data.pointCount) || data.pointCount < 0) return false
  if (!data.validPointCounts || !SENSES.every(key => Number.isInteger(data.validPointCounts[key]) && data.validPointCounts[key] >= 0 && data.validPointCounts[key] <= data.pointCount)) return false
  if (!['low', 'insufficient'].includes(data.confidence) || !MISSING_REASONS.includes(data.missingReason ?? null)) return false
  // 全部未知才算資料不足；不偽造觀測時間或回報數。
  const allNull = SENSES.every(key => data.senses[key] === null)
  return allNull === (data.confidence === 'insufficient') && data.observedAt == null && data.reportCount == null
}

// 後端錯誤轉成可顯示的說明；不改用內建模擬資料。
function describe(error) {
  if (error?.code === 'CANCELLED' || error instanceof HourlyDataError) return error
  const status = error?.status
  const message = status === 404 ? '模擬網格資料未啟用（404）。'
    : status === 503 ? '模擬網格資料暫時無法使用（503），請稍後再試。'
      : status === 429 ? '查詢太頻繁，請稍後再試（429）。'
        : status === 400 ? '模擬網格查詢參數不正確（400）。'
          : status === 403 ? '此網址不允許讀取模擬網格資料（403）。'
            : error?.message || '模擬網格資料讀取失敗。'
  return new HourlyDataError(message, { status, code: error?.code })
}

export function createHourlyApi({ request = apiRequest } = {}) {
  return {
    // 首頁模擬平均：只送 lat／lng（radius、dayType、hour、limit、offset 會被後端拒絕）。
    async getOverview({ lat, lng } = {}, { signal } = {}) {
      if (!isCoordinate({ lat, lng })) throw new HourlyDataError('目前位置無效，無法查詢模擬平均。')
      let payload
      try { payload = (await request('test/mock/overview', { query: { lat, lng }, signal })).data } catch (error) { throw describe(error) }
      if (!validHourlyOverview(payload)) throw new HourlyDataError('模擬平均格式不符（版本、時段或分數）。')
      return { data: payload.data, meta: payload.meta }
    },
    // 取得某時段全部網格。不帶圈選（圈選只收 300／500／1000m，探索地圖可能更大），前端再依地圖範圍裁切。
    async getGrid({ dayType, hour } = {}, { signal } = {}) {
      if (!isDayType(dayType) || !isHour(hour)) throw new HourlyDataError('未知的模擬時段。')
      const points = []
      let meta = null, offset = 0, total = null
      try {
        for (let page = 0; page < MAX_PAGES; page++) {
          const payload = (await request('test/mock/hourly', { query: { dayType, hour, limit: HOURLY_PAGE_LIMIT, offset }, signal })).data
          const data = payload?.data
          if (!validHourlyMeta(payload?.meta, { dayType, hour }) || !Array.isArray(data?.points) || !Number.isInteger(data.total)) {
            throw new HourlyDataError('模擬網格格式不符（版本或時段不一致）。')
          }
          // 各頁總數必須一致，否則重新整理。
          if (total !== null && data.total !== total) throw new HourlyDataError('模擬網格分頁不一致，請重新整理。')
          if (!data.points.every(validHourlyPoint)) throw new HourlyDataError('模擬網格格式不符（網格編號、座標或分數）。')
          // 每頁各有自己的模擬時間；取最晚的一頁，讓所有點相對它都在 30 分鐘有效期內。
          if (!meta || Date.parse(payload.meta.simulatedAt) > Date.parse(meta.simulatedAt)) meta = payload.meta
          total ??= data.total
          points.push(...data.points)
          if (data.nextOffset == null) break
          if (!Number.isInteger(data.nextOffset) || data.nextOffset <= offset) throw new HourlyDataError('模擬網格分頁不一致，請重新整理。')
          offset = data.nextOffset
        }
      } catch (error) { throw describe(error) }
      if (points.length !== total) throw new HourlyDataError('模擬網格筆數不完整，請重新整理。')
      return { data: { points, total }, meta }
    },
  }
}
export const hourlyApi = createHourlyApi()

// 依地圖範圍裁切網格：只保留查詢中心 radius 內（外加一圈讓色帶邊緣平滑）的點，避免每次內插全市三萬點。
export function cropGrid(points, center, radius) {
  if (!isCoordinate(center) || !Number.isFinite(radius) || radius <= 0) return []
  const dLat = radius / 111320, dLng = radius / (111320 * Math.cos(center.lat * Math.PI / 180))
  return (points || []).filter(point => Math.abs(point.location.lat - center.lat) <= dLat && Math.abs(point.location.lng - center.lng) <= dLng)
}
