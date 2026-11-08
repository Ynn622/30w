import { describe, expect, it } from 'vitest'
import { summarizeOverview } from './overviewSummary.js'

// 敏感度都設 1；聲音權重 ×2 後實際權重為 2／1／1／1。
const EVEN = { noise: 1, light: 1, crowd: 1, odor: 1 }

describe('home overview summary (personal index)', () => {
  it('weights the four averages by the user sensitivities', () => {
    // 聲音權重 ×2：(26.6×8 + 23.7×2 + 11.4×3 + 12.4×1) ÷ 14 ≈ 21.9 → 22
    expect(summarizeOverview({ noise: 26.6, light: 23.7, crowd: 11.4, odor: 12.4 }, { noise: 4, light: 2, crowd: 3, odor: 1 }))
      .toEqual({ stimulus: 22, level: 0, headline: '整體舒適', description: '各項感官刺激都低。' })
  })
  it('changes with the sensitivities, not only with the values', () => {
    const senses = { noise: 80, light: 10, crowd: 10, odor: 10 }
    // (80×10 + 10×3) ÷ 13 ≈ 63.8 → 64；(80×2 + 10×15) ÷ 17 ≈ 18.2 → 18
    expect(summarizeOverview(senses, { noise: 5, light: 1, crowd: 1, odor: 1 })).toMatchObject({ stimulus: 64, headline: '整體普通' })
    expect(summarizeOverview(senses, { noise: 1, light: 5, crowd: 5, odor: 5 })).toMatchObject({ stimulus: 18, headline: '整體舒適' })
  })
  it('names the noticeable senses with their own scale words, highest first', () => {
    expect(summarizeOverview({ noise: 50, light: 20, crowd: 80, odor: 10 }, EVEN)).toMatchObject({
      // (50×2 + 20 + 80 + 10) ÷ 5 = 42
      stimulus: 42, headline: '整體普通', description: '人潮擁擠、聲音有點吵，其他感官刺激低。',
    })
    expect(summarizeOverview({ noise: 90, light: 70, crowd: 80, odor: 75 }, EVEN)).toMatchObject({
      level: 2, headline: '整體偏刺激', description: '聲音吵雜、人潮擁擠、氣味刺鼻、光線刺眼。',
    })
  })
  it('leaves unknown dimensions out of the weights and says which are missing', () => {
    // (0×2 + 40×1) ÷ 3 ≈ 13.3 → 13
    expect(summarizeOverview({ noise: 0, light: null, crowd: 40, odor: null }, EVEN)).toEqual({
      stimulus: 13, level: 0, headline: '整體舒適', description: '人潮適中，其他感官刺激低；光線、氣味資料不足。',
    })
    expect(summarizeOverview({ noise: 10, light: null, crowd: 20, odor: 5 }, EVEN).description).toBe('有資料的感官刺激都低；光線資料不足。')
  })
  it('returns null when every dimension is unknown', () => {
    expect(summarizeOverview({ noise: null, light: null, crowd: null, odor: null }, EVEN)).toBeNull()
  })
})
