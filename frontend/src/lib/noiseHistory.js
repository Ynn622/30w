// 本機量測紀錄：保留最近幾次的 dBFS 摘要與使用者當下的感受，用來比對「量到的」和「感覺到的」。
// 只存數值、時間與行政區標籤，不存座標或音訊。
export const NOISE_HISTORY_KEY = 'quiet-city-noise-history'
export const NOISE_HISTORY_LIMIT = 20
export const NOISE_PERCEPTIONS = Object.freeze([
  { id: 'quiet', label: '安靜' },
  { id: 'moderate', label: '普通' },
  { id: 'noisy', label: '吵雜' },
])
const PERCEPTION_IDS = new Set(NOISE_PERCEPTIONS.map(item => item.id))

export function perceptionLabel(id) {
  return NOISE_PERCEPTIONS.find(item => item.id === id)?.label ?? null
}

function validEntry(entry) {
  return typeof entry?.id === 'string' && entry.id.length > 0
    && Number.isFinite(new Date(entry.measuredAt).getTime())
    && Number.isFinite(entry.averageDbfs) && entry.averageDbfs >= -160 && entry.averageDbfs <= 0
    && Number.isFinite(entry.peakDbfs) && entry.peakDbfs >= entry.averageDbfs && entry.peakDbfs <= 0
    && Number.isInteger(entry.sampleCount) && entry.sampleCount > 0
    && (entry.perception === null || PERCEPTION_IDS.has(entry.perception))
}

export function createNoiseEntry({ sessionId, measuredAt, summary, locationLabel = '', perception = null }) {
  return {
    id: sessionId,
    measuredAt,
    averageDbfs: summary.averageDbfs,
    peakDbfs: summary.peakDbfs,
    sampleCount: summary.sampleCount,
    durationMs: summary.durationMs,
    locationLabel: String(locationLabel || '').slice(0, 40),
    perception: PERCEPTION_IDS.has(perception) ? perception : null,
  }
}

export function readNoiseHistory(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(NOISE_HISTORY_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(validEntry).slice(0, NOISE_HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

// 同一 session（id）再次寫入時取代舊紀錄，例如事後補選感受。回傳新清單；無法寫入時清單仍可在記憶體使用。
export function saveNoiseEntry(history, entry, storage) {
  if (!validEntry(entry)) return { history, saved: false }
  const next = [entry, ...history.filter(item => item.id !== entry.id)]
    .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
    .slice(0, NOISE_HISTORY_LIMIT)
  try {
    if (!storage) throw new Error('unavailable')
    storage.setItem(NOISE_HISTORY_KEY, JSON.stringify(next))
    return { history: next, saved: true }
  } catch {
    return { history: next, saved: false }
  }
}
