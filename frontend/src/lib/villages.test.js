import { describe, expect, it } from 'vitest'
import { findVillage, loadVillages, villageAt } from './villages.js'

// 小型測試里界：兩個相鄰正方形，中間留 0.00005 度（約 5 公尺）縫隙，模擬簡化後的相鄰邊界。
const square = (west, south, east, north) => [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]]
const FIXTURE = [
  ['測試區', '東里', 'T2', [121.501, 25.0, 121.502, 25.001], square(121.50105, 25.0, 121.502, 25.001)],
  ['測試區', '西里', 'T1', [121.5, 25.0, 121.501, 25.001], square(121.5, 25.0, 121.501, 25.001)],
]

describe('village lookup', () => {
  it('finds the village containing a point and returns district, name and code', () => {
    expect(villageAt(FIXTURE, { lat: 25.0005, lng: 121.5005 })).toEqual({ city: '臺北市', district: '測試區', village: '西里', code: 'T1', name: '測試區西里' })
    expect(villageAt(FIXTURE, { lat: 25.0005, lng: 121.5015 })?.village).toBe('東里')
  })
  it('snaps points in the small gap between simplified borders to the nearest village, but not far-away points', () => {
    expect(villageAt(FIXTURE, { lat: 25.0005, lng: 121.501035 })?.village).toBe('東里')
    expect(villageAt(FIXTURE, { lat: 25.0005, lng: 121.501010 })?.village).toBe('西里')
    expect(villageAt(FIXTURE, { lat: 25.01, lng: 121.5005 })).toBeNull()
    expect(villageAt(FIXTURE, { lat: NaN, lng: 121.5 })).toBeNull()
    expect(villageAt(null, { lat: 25, lng: 121.5 })).toBeNull()
  })
  it('loads the real Taipei boundaries (456 villages, 12 districts) and resolves known landmarks', async () => {
    const villages = await loadVillages()
    expect(villages).toHaveLength(456)
    expect(new Set(villages.map(row => row[0])).size).toBe(12)
    expect(new Set(villages.map(row => row[2])).size).toBe(456)
    expect((await findVillage({ lat: 25.0375, lng: 121.5637 }))?.name).toBe('信義區西村里') // 臺北市政府
    expect((await findVillage({ lat: 25.0478, lng: 121.5170 }))?.name).toBe('中正區黎明里') // 臺北車站
    expect((await findVillage({ lat: 25.1144737, lng: 121.5351923 }))?.district).toBe('士林區') // 天母體育館
    expect(await findVillage({ lat: 25.0143, lng: 121.4672 })).toBeNull() // 新北市板橋
  })
})
