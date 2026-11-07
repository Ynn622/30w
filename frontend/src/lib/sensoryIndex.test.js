import { describe, expect, it } from 'vitest'
import { assessSensory, rankPlaces, weightedScore } from './sensoryIndex.js'

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
  it('computes personal fit locally without changing environmental SSI', () => {
    const place = record({ noise: 70, light: 20, crowd: 50, odor: 10 })
    const a = assessSensory(place, { noise: 5, light: 1, crowd: 2, odor: 2 }, now)
    const b = assessSensory(place, { noise: 2, light: 5, crowd: 1, odor: 2 }, now)
    expect(a.sfs).toBe(51)
    expect(b.sfs).toBe(69)
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
  it('keeps legacy readings visible without inventing an unversioned SSI', () => {
    const legacy = { senses: { noise: 0, odor: null, air: 0 }, updatedAt: now, confidence: 'medium' }
    expect(assessSensory(legacy, undefined, now)).toMatchObject({ ssi: null, sfs: null, dimensions: { noise: 0, odor: null } })
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
