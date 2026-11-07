// 測試用正式場所 image 樣本（欄位形狀取自 2026-11-08 的 GET places）。
export const PLACE_ID = 'ed0f7e27-5451-45d0-ab08-19e8ad84569c'
const REVISION = '75597f87674390115bc1a1884a113229cd528082b6f2c8b9605dfaae49bd287c'
const photo = {
  id: 'daan-forest-park', file: 'Daan Park Ecological Pool West Zone.jpg', author: '玄史生', credit: 'Own work', license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Daan_Park_Ecological_Pool_West_Zone.jpg',
  capturedAt: '2010-02-28', alt: '大安森林公園參考照片（非即時）', changes: 'Wikimedia 縮圖；畫面可能等比裁切，非即時影像。', verified: false,
}
export function imageFor(kind = 'reviewed', overrides = {}) {
  if (kind === 'illustration') return { kind, url: `/api/v1/places/${PLACE_ID}/image`, infoUrl: `/api/v1/places/${PLACE_ID}/image-info`, photo: null, revision: null, verified: false, notice: '示意插畫。' }
  return {
    kind, url: `/api/v1/places/${PLACE_ID}/image?v=${REVISION}`, infoUrl: `/api/v1/places/${PLACE_ID}/image-info`, revision: REVISION, verified: kind === 'reviewed',
    notice: kind === 'reviewed' ? '人工核對之場所實景照片，非即時影像，僅供辨識參考。' : '參考照片，非即時影像。',
    photo: kind === 'nearby' ? { ...photo, reference: { name: '大安森林公園', location: { lat: 25.0333, lng: 121.5358 }, distanceMeters: 91 } } : photo,
    ...overrides,
  }
}
export const placeWith = (kind, overrides) => ({ id: PLACE_ID, name: '信義市場', category: '市場', artwork: 'hall', location: { lat: 25.0326, lng: 121.5366 }, image: imageFor(kind, overrides) })
