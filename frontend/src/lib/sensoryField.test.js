import { describe, expect, it } from 'vitest'
import { FIELD_DEFAULTS, adaptiveRadii, buildSensoryField, contourSegments, fieldColor, fieldValueAt, interpolateField, zoneOf } from './sensoryField.js'

const base = { lat: 25.1145, lng: 121.5352 }
const offset = (north, east) => ({ lat: base.lat + north / 111320, lng: base.lng + east / (111320 * Math.cos(base.lat * Math.PI / 180)) })

describe('sensitivity layer field', () => {
  it('returns nothing without valid points, so missing data is never painted as quiet', () => {
    expect(interpolateField([])).toBeNull()
    expect(interpolateField([{ ...base, value: null }, { lat: 91, lng: 0, value: 10 }])).toBeNull()
  })
  it('stays within the input range and reproduces a lone point near its centre', () => {
    const field = interpolateField([{ ...offset(0, 0), value: 20 }, { ...offset(0, 400), value: 80 }])
    const finite = [...field.values].filter(Number.isFinite)
    expect(Math.min(...finite)).toBeGreaterThanOrEqual(20)
    expect(Math.max(...finite)).toBeLessThanOrEqual(80)
    expect(fieldValueAt(field, offset(0, 0))).toBeLessThan(25)
    expect(fieldValueAt(field, offset(0, 400))).toBeGreaterThan(75)
    // 兩點中間平滑過渡（取最近網格點，與正中央差不到半格）。
    const middle = fieldValueAt(field, offset(0, 200))
    expect(middle).toBeGreaterThan(40)
    expect(middle).toBeLessThan(60)
  })
  it('fades out away from data and leaves far areas empty', () => {
    const field = interpolateField([{ ...base, value: 10 }])
    const index = location => Math.round((field.north - location.lat) / field.dLat) * field.width + Math.round((location.lng - field.west) / field.dLng)
    expect(field.alpha[index(offset(100, 0))]).toBe(1)
    expect(field.alpha[index(offset(0, 225))]).toBeGreaterThan(0)
    expect(field.alpha[index(offset(0, 225))]).toBeLessThan(1)
    expect(fieldValueAt(field, offset(0, 320))).toBeNull()
  })
  it('draws a contour between a quiet and a loud point and none on a flat field', () => {
    const field = interpolateField([{ ...offset(0, 0), value: 10 }, { ...offset(0, 300), value: 90 }])
    const segments = contourSegments(field, 33)
    expect(segments.length).toBeGreaterThan(0)
    // 33 線落在兩點之間，靠近安靜的一側。
    const east = segments.flat().map(([lng]) => lng)
    expect(Math.min(...east)).toBeGreaterThan(base.lng)
    expect(Math.max(...east)).toBeLessThan(offset(0, 300).lng)
    expect(contourSegments(interpolateField([{ ...base, value: 20 }]), 33)).toEqual([])
  })
  it('builds one field from backend points so the map and the list agree per person', () => {
    const now = '2026-11-08T10:00:00+08:00'
    const cell = (north, east, senses) => ({ location: offset(north, east), senses, confidence: 'medium', updatedAt: now })
    // 西邊安靜但擁擠，東邊吵但沒人。
    const cells = [cell(0, 0, { noise: 15, light: 20, crowd: 80, odor: 10 }), cell(0, 400, { noise: 85, light: 20, crowd: 10, odor: 10 })]
    const noiseAverse = buildSensoryField(cells, { noise: 5, light: 1, crowd: 1, odor: 1 }, now)
    const crowdAverse = buildSensoryField(cells, { noise: 1, light: 1, crowd: 5, odor: 1 }, now)
    expect(zoneOf(noiseAverse, offset(0, 0)).green).toBe(true)
    expect(zoneOf(noiseAverse, offset(0, 400)).green).toBe(false)
    expect(zoneOf(crowdAverse, offset(0, 0)).green).toBe(false)
    expect(zoneOf(crowdAverse, offset(0, 400)).green).toBe(true)
    expect(buildSensoryField([], undefined, now)).toBeNull()
  })
  it('treats places without data as green only while the temporary assumption is on', () => {
    const field = interpolateField([{ ...base, value: 80 }])
    expect(zoneOf(field, offset(2000, 0))).toEqual({ value: null, green: true })
    expect(zoneOf(null, base, false)).toEqual({ value: null, green: false })
    expect(zoneOf(field, base).green).toBe(false)
  })
  it('adapts smoothing to point spacing: backend 200m grid keeps the defaults, dense mock points get finer detail', () => {
    const lattice = spacing => Array.from({ length: 64 }, (_, k) => ({ ...offset(Math.floor(k / 8) * spacing, (k % 8) * spacing), value: 50 }))
    expect(adaptiveRadii(lattice(200))).toEqual({ sigma: FIELD_DEFAULTS.sigma, reach: FIELD_DEFAULTS.reach, solid: FIELD_DEFAULTS.solid })
    const dense = adaptiveRadii(lattice(50))
    expect(dense.sigma).toBeCloseTo(35, 0)
    expect(dense.reach).toBeCloseTo(150, 0)
    expect(adaptiveRadii([{ ...base, value: 1 }])).toEqual({ sigma: FIELD_DEFAULTS.sigma, reach: FIELD_DEFAULTS.reach, solid: FIELD_DEFAULTS.solid })
  })
  it('maps the 0–33 band to green and 67–100 to red', () => {
    const [r1, g1] = fieldColor(10), [r2, g2] = fieldColor(90)
    expect(g1).toBeGreaterThan(r1)
    expect(r2).toBeGreaterThan(g2)
    expect(fieldColor(NaN)).toBeNull()
  })
})
