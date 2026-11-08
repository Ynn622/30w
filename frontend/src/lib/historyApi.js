// 個人化歷史資料（2026-11-08 開發者需求，後端開發中）：POST 經緯度與平日／假日，
// 後端回傳一天中每個時段（3 小時一段）的聲音／光線／人潮／氣味四個值；前端再乘上「我的」個人化權重畫成折線圖。
// 後端接口路徑尚未定案：以 VITE_HISTORY_PATH 設定（相對 API base，例如 history），未設定時不發請求、畫面顯示「尚未提供」。
// 回傳格式暫依需求寬鬆解析，後端公布正式契約後再收緊驗證。
import { apiRequest } from './apiClient.js'
import { isCoordinate } from './sensoryDomain.js'
import { SENSORY_KEYS, personalWeights, weightedScore } from './sensoryIndex.js'

export const HISTORY_PATH = (import.meta.env?.VITE_HISTORY_PATH || '').replace(/^\/+|\/+$/g, '') || null
export const HISTORY_DAY_TYPES = Object.freeze([{ id: 'weekday', label: '平日' }, { id: 'weekend', label: '假日' }])
export const HISTORY_STEP_HOURS = 3

export class HistoryDataError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'HistoryDataError'; Object.assign(this, details) }
}

const validScore = value => value === null || (Number.isFinite(value) && value >= 0 && value <= 100)
// 時段起點：接受 hour／startHour（0–23 整數）或 "HH:mm" 格式的 start／startTime／time。
function startHourOf(slot) {
  for (const key of ['hour', 'startHour']) if (Number.isInteger(slot?.[key]) && slot[key] >= 0 && slot[key] <= 23) return slot[key]
  for (const key of ['start', 'startTime', 'time']) {
    const match = typeof slot?.[key] === 'string' && slot[key].match(/^(\d{1,2}):00$/)
    if (match && Number(match[1]) <= 23) return Number(match[1])
  }
  return null
}
// 四個值：接受 senses 物件或直接放在時段上的 noise／light／crowd／odor；缺值為 null（未知，不補 0）。
function sensesOf(slot) {
  const source = slot?.senses && typeof slot.senses === 'object' ? slot.senses : slot
  const senses = Object.fromEntries(SENSORY_KEYS.map(key => [key, source?.[key] ?? null]))
  return SENSORY_KEYS.every(key => validScore(senses[key])) ? senses : null
}
export function normalizeHistory(payload) {
  const list = payload?.data?.slots ?? payload?.data?.points ?? payload?.data?.series ?? (Array.isArray(payload?.data) ? payload.data : null)
  if (!Array.isArray(list) || !list.length) return null
  const slots = []
  for (const slot of list) {
    const hour = startHourOf(slot), senses = sensesOf(slot)
    if (hour === null || !senses) return null
    slots.push({ hour, senses })
  }
  slots.sort((a, b) => a.hour - b.hour)
  // 同一時段重複即視為格式不符。
  return slots.every((slot, index) => index === 0 || slot.hour !== slots[index - 1].hour) ? slots : null
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
  const message = status === 404 ? '這個位置還沒有歷史資料（404）。'
    : status === 503 ? '歷史資料暫時無法使用（503），請稍後再試。'
      : status === 429 ? '查詢太頻繁，請稍後再試（429）。'
        : status === 400 ? '歷史資料查詢參數不正確（400）。'
          : error?.message || '歷史資料讀取失敗。'
  return new HistoryDataError(message, { status, code: error?.code })
}

export function createHistoryApi({ request = apiRequest, path = HISTORY_PATH } = {}) {
  return {
    available: Boolean(path),
    // 只送三個參數：lat、lng、dayType（weekday／weekend）。
    async getHistory({ lat, lng, dayType } = {}, { signal } = {}) {
      if (!path) throw new HistoryDataError('歷史資料尚未提供。', { code: 'UNAVAILABLE' })
      if (!isCoordinate({ lat, lng })) throw new HistoryDataError('場所座標無效，無法查詢歷史資料。')
      if (!HISTORY_DAY_TYPES.some(item => item.id === dayType)) throw new HistoryDataError('未知的日期類型。')
      let payload
      try { payload = (await request(path, { method: 'POST', body: { lat, lng, dayType }, signal })).data } catch (error) { throw describe(error) }
      const slots = normalizeHistory(payload)
      if (!slots) throw new HistoryDataError('歷史資料格式不符（時段或四維數值）。')
      return { data: { slots }, meta: payload?.meta ?? null }
    },
  }
}
export const historyApi = createHistoryApi()
