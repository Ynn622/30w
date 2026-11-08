// 個人化歷史折線圖（API 規格：Ynn622/30w_backend#19）：POST test/history，body 只送 lat、lng、dayType（weekday／weekend）。
// 後端回傳典型日 8 個時段（每 3 小時一段）的聲音／光線／人潮／氣味原始值（150 公尺內網格平均，0–100 或 null）；
// 前端再依「我的」敏感度加權畫成折線圖，個人設定不上傳。不使用內建假資料：格式不符或錯誤如實顯示。
import { apiRequest } from './apiClient.js'
import { isCoordinate } from './sensoryDomain.js'
import { SENSORY_KEYS, personalWeights, weightedScore } from './sensoryIndex.js'
import { HOURLY_DATASET_VERSION, HOURLY_NOISE_VERSION } from './hourlyApi.js'

// 預設依規格的路徑；後端若改名可用 VITE_HISTORY_PATH（相對 API base）覆寫。
export const HISTORY_PATH = (import.meta.env?.VITE_HISTORY_PATH || 'test/history').replace(/^\/+|\/+$/g, '')
export const HISTORY_AGGREGATION_VERSION = 'history-3h-radius-mean-v1'
export const HISTORY_RADIUS_M = 150
export const HISTORY_STEP_HOURS = 3
export const HISTORY_START_HOURS = Object.freeze([0, 3, 6, 9, 12, 15, 18, 21])
export const HISTORY_DAY_TYPES = Object.freeze([{ id: 'weekday', label: '平日' }, { id: 'weekend', label: '假日' }])
const MISSING_REASONS = [null, 'no_points_within_radius', 'no_valid_test_values']

export class HistoryDataError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'HistoryDataError'; Object.assign(this, details) }
}

const validScore = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 100)
export function validHistoryMeta(meta) {
  return Boolean(meta) && meta.test === true && meta.demo === true && meta.mode === 'test-only'
    && meta.datasetVersion === HOURLY_DATASET_VERSION && meta.aggregationVersion === HISTORY_AGGREGATION_VERSION
    && meta.noiseMapping?.version === HOURLY_NOISE_VERSION
}
function validSlot(slot, index) {
  const start = HISTORY_START_HOURS[index]
  return Boolean(slot) && slot.startHour === start && slot.endHour === start + HISTORY_STEP_HOURS
    && Boolean(slot.senses) && SENSORY_KEYS.every(key => key in slot.senses && validScore(slot.senses[key]))
}
// 回傳 [{ hour, senses }]（8 筆，依時段排序）；任何欄位不符契約就回傳 null。
export function validHistory(payload, dayType) {
  const data = payload?.data
  if (!validHistoryMeta(payload?.meta) || !data || data.dayType !== dayType) return null
  if (data.radiusMeters !== HISTORY_RADIUS_M || data.stepHours !== HISTORY_STEP_HOURS || !MISSING_REASONS.includes(data.missingReason ?? null)) return null
  if (!Array.isArray(data.slots) || data.slots.length !== HISTORY_START_HOURS.length || !data.slots.every(validSlot)) return null
  return data.slots.map(slot => ({ hour: slot.startHour, senses: Object.fromEntries(SENSORY_KEYS.map(key => [key, slot.senses[key]])) }))
}

// 個人化：每個時段的四個值依「我的」敏感度（聲音權重 ×2，與場所安靜程度一致）加權平均，得到 0–100 的個人刺激值；
// 缺值的維度不計入，全部未知時為 null（不畫點，不當作安靜）。
export function personalizeHistory(slots = [], sensitivities) {
  const weights = personalWeights(sensitivities)
  return slots.map(slot => {
    const { score, coverage } = weightedScore(slot.senses, weights)
    return { hour: slot.hour, value: score === null ? null : Math.round(score), coverage, senses: slot.senses }
  })
}

function describe(error) {
  if (error?.code === 'CANCELLED' || error instanceof HistoryDataError) return error
  const status = error?.status
  const message = status === 404 ? '歷史資料尚未提供（404）。'
    : status === 503 ? '歷史資料暫時無法使用（503），請稍後再試。'
      : status === 429 ? '查詢太頻繁，請稍後再試（429）。'
        : status === 400 ? '歷史資料查詢參數不正確（400）。'
          : error?.message || '歷史資料讀取失敗。'
  return new HistoryDataError(message, { status, code: error?.code })
}

export function createHistoryApi({ request = apiRequest, path = HISTORY_PATH } = {}) {
  return {
    available: Boolean(path),
    async getHistory({ lat, lng, dayType } = {}, { signal } = {}) {
      if (!path) throw new HistoryDataError('歷史資料尚未提供。', { code: 'UNAVAILABLE' })
      if (!isCoordinate({ lat, lng })) throw new HistoryDataError('場所座標無效，無法查詢歷史資料。')
      if (!HISTORY_DAY_TYPES.some(item => item.id === dayType)) throw new HistoryDataError('未知的日期類型。')
      let payload
      try { payload = (await request(path, { method: 'POST', body: { lat, lng, dayType }, signal })).data } catch (error) { throw describe(error) }
      const slots = validHistory(payload, dayType)
      if (!slots) throw new HistoryDataError('歷史資料格式不符（版本、時段或四維數值）。')
      return { data: { slots, missingReason: payload.data.missingReason ?? null }, meta: payload.meta }
    },
  }
}
export const historyApi = createHistoryApi()
