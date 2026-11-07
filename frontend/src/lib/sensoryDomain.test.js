import { describe, expect, it } from 'vitest'
import { cellSquare, distanceMeters, levelText, stimulusLevel } from './sensoryDomain.js'

describe('sensory map cells', () => {
  it('classifies each cell by its own score with the same bands as levelText', () => {
    expect([0, 33, 33.5, 66, 67, 100].map(stimulusLevel)).toEqual(['low', 'low', 'mid', 'mid', 'high', 'high'])
    expect([33, 33.5, 67].map(value => levelText(value))).toEqual(['低', '中等', '偏高'])
    // 未知或超出範圍不畫格，不能被當成安靜。
    expect([null, undefined, NaN, -1, 101].map(stimulusLevel)).toEqual([null, null, null, null, null])
  })
  it('builds a closed counter-clockwise 200m square around the cell centre', () => {
    const center = { lat: 25.1145, lng: 121.5352 }
    const [ring] = cellSquare(center)
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
    const [[w, s], [e], [, n]] = ring
    expect(e > w && n > s).toBe(true)
    expect(distanceMeters({ lat: s, lng: w }, { lat: s, lng: e })).toBeCloseTo(200, -1)
    expect(distanceMeters({ lat: s, lng: w }, { lat: n, lng: w })).toBeCloseTo(200, -1)
    expect(cellSquare({ lat: 91, lng: 0 })).toBeNull()
  })
})
