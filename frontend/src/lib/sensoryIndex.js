export const SENSORY_KEYS = ['noise', 'light', 'crowd', 'odor']
export const SSI_WEIGHTS = Object.freeze({ noise: 0.4, light: 0.2, crowd: 0.3, odor: 0.1 })
export const DEFAULT_SENSITIVITIES = Object.freeze({ noise: 4, light: 2, crowd: 3, odor: 1 })
const confidences = ['low', 'medium', 'high']
// 加權和可能出現 26.4999… 的浮點誤差；先截到 6 位再四捨五入，確保 .5 依規格進位。
const roundScore = value => Math.round(Number(value.toFixed(6)))
const validScore = value => Number.isFinite(value) && value >= 0 && value <= 100
export function isFresh(date, now = Date.now()) {
  if (!date) return false
  const age = new Date(now).getTime() - new Date(date).getTime()
  return Number.isFinite(age) && age >= 0 && age <= 30 * 60_000
}
export function weightedScore(scores, weights) {
  const entries = Object.entries(weights)
  if (!entries.length || entries.some(([, w]) => !Number.isFinite(w) || w < 0)) return { score: null, coverage: 0 }
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  const available = entries.filter(([key]) => validScore(scores[key]))
  const weight = available.reduce((sum, [, w]) => sum + w, 0)
  return { score: weight > 0 ? available.reduce((sum, [key, w]) => sum + scores[key] * w, 0) / weight : null,
    coverage: total > 0 ? Number((weight / total).toFixed(6)) : 0 }
}
export function sensoryValues(record, now = Date.now()) {
  const index = record?.sensoryIndex
  const versioned = index?.scoreVersion === 'ssi-v0.1' && typeof index.confidenceVersion === 'string' && index.confidenceVersion.length > 0
  return Object.fromEntries(SENSORY_KEYS.map(key => {
    let value = null
    if (index) {
      const meta = index.dimensionMeta?.[key]
      const expires = meta?.validUntil ? new Date(meta.validUntil).getTime() : NaN
      if (versioned && confidences.includes(index.confidence) && confidences.includes(meta?.confidence)
        && meta.sourceType === 'subjective_report' && Number.isInteger(meta.sampleCount) && meta.sampleCount > 0
        && isFresh(meta.observedAt, now) && expires >= new Date(now).getTime()
        && expires <= new Date(meta.observedAt).getTime() + 30 * 60_000
        && validScore(index.dimensions?.[key])) value = index.dimensions[key]
    } else if (confidences.includes(record?.confidence) && isFresh(record?.observedAt || record?.updatedAt, now)
      && validScore(record.senses?.[key])) value = record.senses[key]
    return [key, value]
  }))
}
export function assessSensory(record, sensitivities = DEFAULT_SENSITIVITIES, now = Date.now()) {
  const dimensions = sensoryValues(record, now)
  // 環境指數 SSI 只在後端提供版本化 sensoryIndex 時計算；
  // 安靜程度（SFS）依使用者敏感度佔比加權，可直接使用場所回傳的有效四維 senses（新鮮且信心足夠）。
  const scoreable = record?.sensoryIndex?.scoreVersion === 'ssi-v0.1'
  const environmental = weightedScore(scoreable ? dimensions : {}, SSI_WEIGHTS)
  const personal = weightedScore(dimensions, sensitivities)
  const availableCount = SENSORY_KEYS.filter(key => dimensions[key] !== null).length
  return { dimensions, ssi: environmental.score === null ? null : roundScore(environmental.score),
    sfs: personal.score === null ? null : roundScore(100 - personal.score),
    coverage: environmental.coverage, fitCoverage: personal.coverage,
    dimensionCoverage: availableCount / 4, availableCount,
    confidence: environmental.score === null ? 'insufficient' : record.sensoryIndex.confidence,
    scoreVersion: scoreable ? 'ssi-v0.1' : null,
  }
}
export function rankPlaces(places, sort = 'fit') {
  return [...places].sort((a, b) => {
    if (sort === 'fit') {
      const known = Number(b.assessment?.sfs != null) - Number(a.assessment?.sfs != null)
      if (known) return known
      const coverage = (b.assessment?.fitCoverage || 0) - (a.assessment?.fitCoverage || 0)
      if (coverage) return coverage
      const fit = (b.assessment?.sfs || 0) - (a.assessment?.sfs || 0)
      if (fit) return fit
    }
    return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity)
  })
}
