import { describe, expect, it } from 'vitest'
import { DEFAULT_DB_OFFSET, NOISE_OFFSET_KEY, estimateDb, noiseLevel, offsetFromReference, readDbOffset, writeDbOffset } from './noiseLevel.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return { getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = value }, removeItem: key => { delete data[key] }, data }
}

describe('estimated dB and level', () => {
  it('adds the calibration offset and keeps silence unknown', () => {
    expect(estimateDb(-55.4, 100)).toBe(45)
    expect(estimateDb(-23.5)).toBe(Math.round(-23.5 + DEFAULT_DB_OFFSET))
    expect(estimateDb(-160, 100)).toBeNull()
    expect(estimateDb(NaN, 100)).toBeNull()
  })
  it('classifies quiet, moderate and noisy from estimated dB', () => {
    expect(noiseLevel(49).id).toBe('quiet')
    expect(noiseLevel(50).id).toBe('moderate')
    expect(noiseLevel(69).id).toBe('moderate')
    expect(noiseLevel(70).id).toBe('noisy')
    expect(noiseLevel(null)).toBeNull()
  })
  it('stores a validated calibration offset per device', () => {
    const storage = memoryStorage()
    expect(readDbOffset(storage)).toEqual({ offset: DEFAULT_DB_OFFSET, calibrated: false })
    expect(writeDbOffset(112.34, storage)).toBe(true)
    expect(readDbOffset(storage)).toEqual({ offset: 112.3, calibrated: true })
    expect(writeDbOffset(500, storage)).toBe(false)
    expect(readDbOffset(memoryStorage({ [NOISE_OFFSET_KEY]: 'abc' })).calibrated).toBe(false)
    expect(writeDbOffset(null, storage)).toBe(true)
    expect(readDbOffset(storage).calibrated).toBe(false)
    expect(writeDbOffset(100, null)).toBe(false)
  })
  it('derives an offset from a reference meter reading', () => {
    expect(offsetFromReference(55, -48.2)).toBe(103.2)
    expect(offsetFromReference(55, -1)).toBeNull()
  })
})
