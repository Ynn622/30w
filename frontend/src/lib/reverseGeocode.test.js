import { describe, expect, it, vi } from 'vitest'
import { createReverseGeocoder, formatAddress } from './reverseGeocode.js'

const sample = { address: { road: '承德路一段', house_number: '3', neighbourhood: '黎明里', suburb: '中正區', city: '臺北市', 'ISO3166-2-lvl4': 'TW-TPE' } }
const ok = data => ({ ok: true, status: 200, json: async () => data })
function setup(responses = [ok(sample)]) {
  let clock = 0
  const fetchImpl = vi.fn(async () => responses.shift() || ok(sample))
  const sleep = vi.fn(async ms => { clock += ms })
  const geocoder = createReverseGeocoder({ url: 'https://geo.test/reverse', fetchImpl, now: () => clock, sleep })
  return { geocoder, fetchImpl, sleep, advance: ms => { clock += ms } }
}

describe('reverse geocoding', () => {
  it('formats a Taiwanese address from Nominatim fields', () => {
    expect(formatAddress(sample.address)).toBe('臺北市中正區承德路一段3號')
    expect(formatAddress({ city: '臺北市', suburb: '士林區', neighbourhood: '福德里' })).toBe('臺北市士林區福德里')
    expect(formatAddress({ city: '臺北市', suburb: '大安區', road: '溫州街', house_number: '18巷' })).toBe('臺北市大安區溫州街18巷')
    expect(formatAddress(null)).toBe('')
  })
  it('requests zh-TW jsonv2 with lat/lon and reports whether the point is in Taipei', async () => {
    const { geocoder, fetchImpl } = setup()
    await expect(geocoder.lookup({ lat: 25.0478, lng: 121.517 })).resolves.toEqual({ address: '臺北市中正區承德路一段3號', inTaipei: true, district: '中正區' })
    const url = new URL(fetchImpl.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://geo.test/reverse')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ format: 'jsonv2', lat: '25.0478', lon: '121.517', 'accept-language': 'zh-TW' })
  })
  it('reuses the cached result for the same spot instead of querying again', async () => {
    const { geocoder, fetchImpl } = setup()
    await geocoder.lookup({ lat: 25.04781, lng: 121.51702 })
    await geocoder.lookup({ lat: 25.04779, lng: 121.51698 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('keeps at least 1.1 seconds between requests to respect the public usage policy', async () => {
    const { geocoder, fetchImpl, sleep } = setup()
    await Promise.all([geocoder.lookup({ lat: 25.04, lng: 121.51 }), geocoder.lookup({ lat: 25.09, lng: 121.52 })])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(1100)
  })
  it('does not cache failures and rejects invalid or cancelled lookups', async () => {
    const { geocoder, fetchImpl, advance } = setup([{ ok: false, status: 429, json: async () => ({}) }, ok(sample)])
    await expect(geocoder.lookup({ lat: 25.04, lng: 121.51 })).rejects.toThrow('429')
    advance(2000)
    await expect(geocoder.lookup({ lat: 25.04, lng: 121.51 })).resolves.toMatchObject({ address: '臺北市中正區承德路一段3號' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    await expect(geocoder.lookup({ lat: null, lng: 121 })).rejects.toThrow('座標無效')
    const controller = new AbortController(); controller.abort()
    await expect(geocoder.lookup({ lat: 25.2, lng: 121.6 }, { signal: controller.signal })).rejects.toThrow('取消')
  })
})
