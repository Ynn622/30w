import { describe, expect, it } from 'vitest'
import { LOW_STIMULUS_PIN_COLOR, MAP_STYLES, boundaryColor, isNoisySymbolLayer, mapStyleUrl } from './mapStyle.js'

describe('low-stimulus map style', () => {
  it('switches to the greyscale OpenFreeMap style only in low-stimulus mode', () => {
    expect(mapStyleUrl(false)).toBe(MAP_STYLES.default)
    expect(mapStyleUrl(true)).toBe(MAP_STYLES.lowStimulus)
    expect(MAP_STYLES.lowStimulus).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\/positron$/)
  })
  it('hides POI icons, airports and road shields but keeps street and place names', () => {
    expect(isNoisySymbolLayer({ id: 'poi_r1', type: 'symbol', 'source-layer': 'poi' })).toBe(true)
    expect(isNoisySymbolLayer({ id: 'airport', type: 'symbol', 'source-layer': 'aerodrome_label' })).toBe(true)
    expect(isNoisySymbolLayer({ id: 'highway-shield-non-us', type: 'symbol', 'source-layer': 'transportation_name' })).toBe(true)
    expect(isNoisySymbolLayer({ id: 'highway-name-major', type: 'symbol', 'source-layer': 'transportation_name' })).toBe(false)
    expect(isNoisySymbolLayer({ id: 'label_city', type: 'symbol', 'source-layer': 'place' })).toBe(false)
    expect(isNoisySymbolLayer({ id: 'poi-fill', type: 'fill', 'source-layer': 'poi' })).toBe(false)
    expect(isNoisySymbolLayer(undefined)).toBe(false)
  })
  it('mutes overlay colours in low-stimulus mode', () => {
    expect(boundaryColor(false)).toBe('#0391A7')
    expect(boundaryColor(true)).not.toBe('#0391A7')
    expect(LOW_STIMULUS_PIN_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
