import { describe, expect, it } from 'vitest'
import { personalStimulus } from './sensoryDomain.js'

describe('personal stimulus per map point', () => {
  it('weights each point by sensitivity share and ignores missing dimensions (lenient)', () => {
    const now = '2026-11-08T10:00:00+08:00'
    const cell = { senses: { noise: 20, light: null, crowd: 60, odor: null }, confidence: 'medium', updatedAt: now }
    // 怕吵：(20×4 + 60×1) / 5 = 28；怕擠：(20×1 + 60×5) / 6 ≈ 53。同一點因人而異。
    expect(personalStimulus(cell, { noise: 4, light: 2, crowd: 1, odor: 1 }, now)).toBe(28)
    expect(personalStimulus(cell, { noise: 1, light: 2, crowd: 5, odor: 1 }, now)).toBe(53)
    // 寬鬆：只有一維資料也會計算；四維全缺或過期回 null，不當成安靜。
    expect(personalStimulus({ ...cell, senses: { noise: 20, light: null, crowd: null, odor: null } }, { noise: 1, light: 1, crowd: 5, odor: 1 }, now)).toBe(20)
    expect(personalStimulus({ ...cell, senses: { noise: null, light: null, crowd: null, odor: null } }, undefined, now)).toBeNull()
    expect(personalStimulus(cell, undefined, '2026-11-08T10:31:00+08:00')).toBeNull()
  })
})
