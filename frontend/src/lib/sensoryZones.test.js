import { describe, expect, it } from 'vitest'
import { parseZones, zoneOf } from './sensoryZones.js'
import { annotateMockZones, mockCells, mockPlaces, mockZones } from '../data/quietMock.js'

const NOW = '2026-11-07T10:30:00+08:00'
const ring = [[121.514, 25.038], [121.515, 25.038], [121.515, 25.0389], [121.514, 25.0389], [121.514, 25.038]]
const feature = (props = {}, geometry = { type: 'Polygon', coordinates: [ring] }) => ({ type: 'Feature', id: 'z', geometry,
  properties: { layer: 'noise', level: 'low', value: 24, sampleCount: 9, confidence: 'medium', observedAt: '2026-11-07T10:20:00+08:00', validUntil: '2026-11-07T10:50:00+08:00', ...props } })
const data = (features, rule = { zoneVersion: 'zone-v0.1', threshold: 33 }) => ({ cells: [], zoneRule: rule, zones: { type: 'FeatureCollection', features } })

describe('low-stimulus zones', () => {
  it('keeps valid low polygons and treats a missing or unsupported payload as no zones', () => {
    expect(parseZones(data([feature()]), NOW).features).toHaveLength(1)
    expect(parseZones({ cells: [] }, NOW)).toEqual({ rule: null, features: [] })
    expect(parseZones(data([feature()], { zoneVersion: 'zone-v9' }), NOW).features).toEqual([])
    expect(parseZones(data([]), NOW).features).toEqual([])
  })
  it('drops non-low, expired, above-threshold, unknown-layer and malformed features', () => {
    const open = [[121.514, 25.038], [121.515, 25.038], [121.515, 25.0389]]
    const parsed = parseZones(data([
      feature({ value: 33 }), feature({ value: 34 }), feature({ level: 'high' }), feature({ layer: 'air' }),
      feature({ validUntil: '2026-11-07T10:29:00+08:00' }), feature({}, { type: 'Polygon', coordinates: [open] }),
      feature({}, { type: 'Point', coordinates: [121.5, 25] }),
    ]), NOW)
    expect(parsed.features.map(item => item.properties.value)).toEqual([33])
  })
  it('reads Place.zone for outdoor places and uses own senses for indoor places', () => {
    expect(zoneOf({ indoor: false, zone: { noise: 'low' } })).toBe('low')
    expect(zoneOf({ indoor: null, zone: { noise: 'maybe' } })).toBe('unknown')
    expect(zoneOf({ indoor: false })).toBe('unknown')
    // 室內場所：室外綠區不能推論室內安靜。
    const indoor = { ...mockPlaces('zhongzheng', NOW).find(place => place.id === 'zhongzheng-reading'), zone: { noise: 'not_low' } }
    expect(zoneOf(indoor, 'noise', NOW)).toBe('low')
    expect(zoneOf({ ...indoor, sensoryIndex: undefined, senses: {} }, 'noise', NOW)).toBe('unknown')
  })
  it('builds mock zones and place annotations in the contract format', () => {
    const cells = mockCells('zhongzheng', NOW)
    const zones = mockZones(cells)
    const parsed = parseZones({ cells, ...zones }, NOW)
    expect(parsed.features.length).toBeGreaterThan(0)
    expect(parsed.features.every(item => item.properties.value <= 33)).toBe(true)
    const [place] = annotateMockZones([{ id: 'p', location: cells[0].location }], cells)
    expect(place.zone).toMatchObject({ noise: 'low', zoneVersion: 'zone-v0.1' })
  })
})
