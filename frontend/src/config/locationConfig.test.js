import { describe, expect, it } from 'vitest'
import { TIANMU_STADIUM, readFakeLocation } from './locationConfig.js'
import { nearestArea } from '../lib/sensoryDomain.js'

describe('fake location config', () => {
  it('is enabled only when VITE_FAKE_LOCATION is exactly "true"', () => {
    expect(readFakeLocation({ VITE_FAKE_LOCATION: 'true' }).enabled).toBe(true)
    expect(readFakeLocation({ VITE_FAKE_LOCATION: 'false' }).enabled).toBe(false)
    expect(readFakeLocation({ VITE_FAKE_LOCATION: '1' }).enabled).toBe(false)
    expect(readFakeLocation({}).enabled).toBe(false)
  })

  it('locks to Tianmu stadium in Shilin district', () => {
    expect(readFakeLocation({ VITE_FAKE_LOCATION: 'true' })).toMatchObject({ lat: TIANMU_STADIUM.lat, lng: TIANMU_STADIUM.lng, name: '天母體育館' })
    expect(nearestArea(TIANMU_STADIUM)?.id).toBe('shilin')
  })
})
