// 首頁感官概況的標題與說明：由附近 150 公尺的四維平均，依使用者在「我的」設定的感官敏感度加權計算（個人化指數），
// 與敏感圖層的做法一致。數值越高越刺激；未知（null）的維度不列入，其餘權重重新換算比例。
import { SENSES } from './sensoryDomain.js'
import { DEFAULT_SENSITIVITIES, weightedScore } from './sensoryIndex.js'

export const OVERALL_HEADLINES = Object.freeze(['整體舒適', '整體普通', '整體偏刺激'])
// 0–33 低、34–66 中等、67–100 高，與色帶及「低／中等／偏高」分段一致。
export const levelIndex = value => value <= 33 ? 0 : value <= 66 ? 1 : 2
const valid = value => Number.isFinite(value) && value >= 0 && value <= 100

// senses：{ noise, light, crowd, odor }（0–100，可為小數或 null）；sensitivities：{ noise: 1–5, ... }，缺值用預設敏感度。
// 回傳 { stimulus, level, headline, description }；四維皆未知時回傳 null。
export function summarizeOverview(senses = {}, sensitivities = {}) {
  const { score } = weightedScore(senses, Object.fromEntries(SENSES.map(sense => [sense.key, Number(sensitivities?.[sense.key]) || DEFAULT_SENSITIVITIES[sense.key]])))
  if (score === null) return null
  const stimulus = Math.round(Number(score.toFixed(6)))
  const level = levelIndex(stimulus)
  const known = SENSES.filter(sense => valid(senses[sense.key])).sort((a, b) => senses[b.key] - senses[a.key])
  const missing = SENSES.filter(sense => !valid(senses[sense.key]))
  // 只點名中等以上的感官，用各感官自己的刻度用語（例如聲音「有點吵」、人潮「擁擠」）。
  const notable = known.filter(sense => senses[sense.key] > 33)
  let description = notable.length
    ? notable.map(sense => `${sense.label}${sense.scale[levelIndex(senses[sense.key])]}`).join('、') + (notable.length < known.length ? '，其他感官刺激低' : '')
    : known.length === SENSES.length ? '各項感官刺激都低' : '有資料的感官刺激都低'
  if (missing.length) description += `；${missing.map(sense => sense.label).join('、')}資料不足`
  return { stimulus, level, headline: OVERALL_HEADLINES[level], description: `${description}。` }
}
