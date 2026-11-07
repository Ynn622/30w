import { describe, expect, it } from 'vitest'
import { photoTag, placeImage } from './placeImage.js'
import { PLACE_ID, imageFor, placeWith } from './placeImage.fixture.js'

const BASE = 'https://30wbackend.idfc.dev/api/v1'

describe('place photos (issue #7)', () => {
  it('resolves the embedded image path against the API origin without doubling /api/v1', () => {
    const image = placeImage(placeWith('reviewed'), BASE)
    expect(image.src).toBe(`https://30wbackend.idfc.dev/api/v1/places/${PLACE_ID}/image?v=${imageFor().revision}`)
    expect(image).toMatchObject({ kind: 'reviewed', author: '玄史生', license: 'CC BY-SA 3.0', year: '2010', reference: null })
  })
  it('accepts linked and nearby photos without requiring verified, keeping the nearby reference', () => {
    expect(placeImage(placeWith('linked'), BASE)).toMatchObject({ kind: 'linked', notice: '參考照片，非即時影像。' })
    expect(placeImage(placeWith('nearby'), BASE)).toMatchObject({ kind: 'nearby', reference: { name: '大安森林公園', distance: 91 } })
  })
  it('uses the local artwork for illustrations, unknown kinds, foreign paths or missing attribution', () => {
    expect(placeImage(placeWith('illustration'), BASE)).toBeNull()
    expect(placeImage(placeWith('reviewed', { kind: 'other' }), BASE)).toBeNull()
    expect(placeImage(placeWith('reviewed', { url: 'https://evil.example/x.jpg' }), BASE)).toBeNull()
    expect(placeImage(placeWith('reviewed', { url: '/api/v1/places/x/image-info' }), BASE)).toBeNull()
    expect(placeImage(placeWith('reviewed', { photo: { ...imageFor().photo, author: '' } }), BASE)).toBeNull()
    expect(placeImage({ id: 'p', name: '無圖', location: { lat: 25, lng: 121.5 } }, BASE)).toBeNull()
  })
  it('tags reviewed photos with the year and every other photo as a reference', () => {
    expect(photoTag(placeImage(placeWith('reviewed'), BASE))).toBe('歷史照片・2010・非即時')
    expect(photoTag(placeImage(placeWith('nearby'), BASE))).toBe('參考照片・非即時')
    expect(photoTag(null)).toBe('原創示意插畫・非實景')
  })
})
