// 由手機 dBFS 估算環境 dB 與「安靜／普通／吵雜」等級。
// 估算方式：dB ≈ dBFS + 校準值。校準值依手機麥克風靈敏度與系統增益而不同，未用標準音量計校準時誤差可能達 ±10 dB 以上，
// 結果只供參考，不是 dBA（未做 A 加權）也不能用於法規噪音判定。
export const NOISE_OFFSET_KEY = 'quiet-city-noise-offset'
// 預設值 120：一般手機 MEMS 麥克風規格約為 94 dB SPL 對應 -26 dBFS（約 +120）；2026-11-07 實機比對時 +100 約低估 20 dB。
export const DEFAULT_DB_OFFSET = 120
export const MIN_DB_OFFSET = 60
export const MAX_DB_OFFSET = 150
// 參考一般環境：圖書館約 40 dB、正常交談約 60 dB、繁忙道路約 70～80 dB。
export const NOISE_LEVELS = Object.freeze([
  { id: 'quiet', label: '安靜', below: 50, hint: '約圖書館、安靜住宅區' },
  { id: 'moderate', label: '普通', below: 70, hint: '約一般交談、辦公室' },
  { id: 'noisy', label: '吵雜', below: Infinity, hint: '約繁忙道路、人多的商場' },
])

const validOffset = value => Number.isFinite(value) && value >= MIN_DB_OFFSET && value <= MAX_DB_OFFSET

function defaultStorage() {
  try { return globalThis.localStorage ?? null } catch { return null }
}

export function readDbOffset(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(NOISE_OFFSET_KEY)
    if (raw === null || raw === undefined || raw === '') return { offset: DEFAULT_DB_OFFSET, calibrated: false }
    const value = Number(raw)
    return validOffset(value) ? { offset: value, calibrated: true } : { offset: DEFAULT_DB_OFFSET, calibrated: false }
  } catch {
    return { offset: DEFAULT_DB_OFFSET, calibrated: false }
  }
}

// 傳 null 代表回到預設值。回傳是否成功寫入。
export function writeDbOffset(value, storage = defaultStorage()) {
  try {
    if (!storage) return false
    if (value === null) { storage.removeItem(NOISE_OFFSET_KEY); return true }
    const rounded = Math.round(Number(value) * 10) / 10
    if (!validOffset(rounded)) return false
    storage.setItem(NOISE_OFFSET_KEY, String(rounded))
    return true
  } catch {
    return false
  }
}

// 以同一時間、同一地點的參考音量計讀數反推校準值。
export function offsetFromReference(referenceDb, measuredDbfs) {
  const offset = Math.round((Number(referenceDb) - Number(measuredDbfs)) * 10) / 10
  return validOffset(offset) ? offset : null
}

export function estimateDb(dbfs, offset = DEFAULT_DB_OFFSET) {
  if (!Number.isFinite(dbfs) || dbfs <= -160) return null
  return Math.max(0, Math.round(dbfs + offset))
}

export function noiseLevel(db) {
  if (!Number.isFinite(db)) return null
  return NOISE_LEVELS.find(level => db < level.below)
}
