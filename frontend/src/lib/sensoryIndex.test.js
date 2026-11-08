import { describe, expect, it } from 'vitest'
import { NOISE_WEIGHT_MULTIPLIER, SSI_WEIGHTS, assessSensory, personalWeights, rankPlaces, sensoryValues, weightedScore } from './sensoryIndex.js'

const now = '2026-11-07T10:30:00+08:00'
function record(scores = { noise: 70, light: 20, crowd: 50, odor: null }) {
  return { senses: scores, updatedAt: now, confidence: 'medium', sensoryIndex: {
    scoreVersion: 'ssi-v0.1', confidenceVersion: 'test-v1', confidence: 'medium', dimensions: scores,
    dimensionMeta: Object.fromEntries(Object.keys(scores).map(key => [key, {
      observedAt: now, validUntil: '2026-11-07T11:00:00+08:00', confidence: 'medium', sampleCount: 8, sourceType: 'subjective_report',
    }])),
  } }
}
describe('sensory assessment', () => {
  it('normalizes only available weights and separates dimension coverage', () => {
    expect(assessSensory(record(), undefined, now)).toMatchObject({ ssi: 52, coverage: 0.9, dimensionCoverage: 0.75 })
    expect(weightedScore({ noise: 0, light: null }, { noise: 1, light: 1 })).toMatchObject({ score: 0, coverage: 0.5 })
    expect(assessSensory(record({ noise: 21, light: 44, crowd: 26, odor: 15 }), undefined, now).ssi).toBe(27)
    expect(weightedScore({ noise: 20 }, { noise: 0 }).score).toBeNull()
    expect(weightedScore({ noise: 20 }, { noise: -1 }).score).toBeNull()
  })
  it('doubles only the noise weight for personal scores and keeps SSI weights fixed', () => {
    expect(NOISE_WEIGHT_MULTIPLIER).toBe(2)
    const sensitivities = { noise: 3, light: 2, crowd: 4, odor: 1 }
    expect(personalWeights(sensitivities)).toEqual({ noise: 6, light: 2, crowd: 4, odor: 1 })
    expect(sensitivities.noise).toBe(3)
    expect(personalWeights({ light: 2 })).toEqual({ light: 2 })
    expect(SSI_WEIGHTS).toEqual({ noise: 0.4, light: 0.2, crowd: 0.3, odor: 0.1 })
    // 只有聲音與光線、敏感度都設 1：(80×2 + 20×1) / 3 = 60 → 安靜程度 40；SSI 仍用固定權重。
    const place = record({ noise: 80, light: 20, crowd: null, odor: null })
    expect(assessSensory(place, { noise: 1, light: 1, crowd: 1, odor: 1 }, now)).toMatchObject({ sfs: 40, ssi: 60 })
  })
  it('computes personal fit locally without changing environmental SSI', () => {
    const place = record({ noise: 70, light: 20, crowd: 50, odor: 10 })
    const a = assessSensory(place, { noise: 5, light: 1, crowd: 2, odor: 2 }, now)
    const b = assessSensory(place, { noise: 2, light: 5, crowd: 1, odor: 2 }, now)
    // 聲音權重 ×2：a 為 10／1／2／2 → 100 − 840/15 = 44；b 為 4／5／1／2 → 100 − 450/12 = 62.5 → 63
    expect(a.sfs).toBe(44)
    expect(b.sfs).toBe(63)
    expect(a.ssi).toBe(b.ssi)
  })
  it('rejects stale, unsupported and insufficient inputs rather than scoring unknown as quiet', () => {
    expect(assessSensory(record(), undefined, '2026-11-07T11:01:00+08:00').ssi).toBeNull()
    const unsupported = record()
    unsupported.sensoryIndex.scoreVersion = 'unknown'
    expect(assessSensory(unsupported, undefined, now).ssi).toBeNull()
    const insufficient = record()
    insufficient.sensoryIndex.confidence = 'insufficient'
    expect(assessSensory(insufficient, undefined, now).ssi).toBeNull()
    expect(assessSensory(record({ noise: null, light: null, crowd: null, odor: null }), undefined, now)).toMatchObject({ ssi: null, sfs: null, coverage: 0 })
  })
  it('scores quietness from plain place senses without inventing an unversioned SSI', () => {
    const legacy = { senses: { noise: 0, odor: null, air: 0 }, updatedAt: now, confidence: 'medium' }
    expect(assessSensory(legacy, undefined, now)).toMatchObject({ ssi: null, sfs: 100, dimensions: { noise: 0, odor: null } })
    // 安靜程度依敏感度佔比加權（聲音 ×2）：聲音 4→8、人潮 3 → (70×8 + 50×3) / 11 ≈ 64.5 → 100 − 64.5 ≈ 35；涵蓋 11/14
    const plain = { senses: { noise: 70, light: null, crowd: 50, odor: null }, updatedAt: now, confidence: 'low' }
    expect(assessSensory(plain, { noise: 4, light: 2, crowd: 3, odor: 1 }, now)).toMatchObject({ ssi: null, sfs: 35, fitCoverage: 0.785714 })
    // 過期或資料不足不計分。
    expect(assessSensory({ ...plain, confidence: 'insufficient' }, undefined, now).sfs).toBeNull()
    expect(assessSensory({ ...plain, updatedAt: '2026-11-07T09:00:00+08:00' }, undefined, now).sfs).toBeNull()
  })
  it('accepts a sensory/map cell in the deployed backend schema (OpenAPI 2026-11-07)', () => {
    // 後端格網：TWD97 200m 格、UTC 時間、信心最高 low、未達門檻的維度 sampleCount 為 null。
    const missing = { observedAt: null, validUntil: null, sampleCount: null, confidence: 'insufficient', sourceType: null, missingReason: 'insufficient_samples' }
    const cell = {
      id: 'twd97-200:1512:12671', location: { lat: 25.0389, lng: 121.5147 },
      senses: { noise: 28, light: null, crowd: null, odor: null }, reportCount: null, confidence: 'low', updatedAt: '2026-11-07T02:15:00.000Z',
      sensoryIndex: {
        ssi: 28, level: '低', dimensions: { noise: 28, light: null, crowd: null, odor: null }, weights: { noise: 0.4, light: 0.2, crowd: 0.3, odor: 0.1 },
        coverage: 0.4, dimensionCoverage: 0.25, confidence: 'low', scoreVersion: 'ssi-v0.1', confidenceVersion: 'confidence-v0.1',
        dimensionMeta: {
          noise: { observedAt: '2026-11-07T02:15:00.000Z', validUntil: '2026-11-07T02:45:00.000Z', sampleCount: 5, confidence: 'low', sourceType: 'subjective_report', missingReason: null },
          light: missing, crowd: missing, odor: missing,
        },
      },
    }
    expect(sensoryValues(cell, '2026-11-07T10:30:00+08:00')).toEqual({ noise: 28, light: null, crowd: null, odor: null })
    expect(sensoryValues(cell, '2026-11-07T10:46:00+08:00').noise).toBeNull()
  })
  it('excludes an expired dimension and never substitutes AQI for odor', () => {
    const place = record()
    place.sensoryIndex.dimensionMeta.noise.validUntil = '2026-11-07T10:29:00+08:00'
    place.senses.air = 0
    expect(assessSensory(place, undefined, now)).toMatchObject({ dimensions: { noise: null, odor: null }, dimensionCoverage: 0.5 })
  })
  it('ranks complete observations ahead of a high partial fit and keeps distance sorting selectable', () => {
    const places = [
      { id: 'partial', distanceM: 10, assessment: { sfs: 99, fitCoverage: 0.5 } },
      { id: 'complete', distanceM: 20, assessment: { sfs: 50, fitCoverage: 1 } },
      { id: 'unknown', distanceM: 5, assessment: { sfs: null, fitCoverage: 0 } },
    ]
    expect(rankPlaces(places, 'fit').map(p => p.id)).toEqual(['complete', 'partial', 'unknown'])
    expect(rankPlaces(places, 'distance').map(p => p.id)).toEqual(['unknown', 'partial', 'complete'])
  })
})
