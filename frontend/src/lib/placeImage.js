// 正式場所照片（Ynn622/30w#7）：清單與詳情內嵌 image，不必每張卡片另查 image-info。
// 後端依序選 reviewed（同場所照片）→ linked（同主體照片）→ nearby（1 公里內參考照片）→ illustration（插畫）。
// 照片不代表現地感官、安靜程度或目前開放；verified 只是來源 metadata，前端不據此拒圖或另加警語。
import apiConfig from '../config/apiConfig.js'

export const PHOTO_KINDS = Object.freeze(['reviewed', 'linked', 'nearby'])
// 只接受同一場所的圖片路徑（含後端提供的版本參數 v），以 API origin 解析，不可連到 GitHub Pages origin。
const IMAGE_PATH = /^\/api\/v1\/places\/[A-Za-z0-9-]+\/image(\?v=[A-Za-z0-9]+)?$/
const text = value => typeof value === 'string' && value.trim() ? value : null
const httpsOnly = value => typeof value === 'string' && value.startsWith('https://') ? value : null

// 回傳可顯示的照片資訊；插畫、格式不符或缺少署名時回傳 null（改用前端原創插畫，不多打一次 API）。
export function placeImage(place, baseURL = apiConfig.baseURL) {
  const image = place?.image
  if (!image || !PHOTO_KINDS.includes(image.kind) || !IMAGE_PATH.test(image.url || '')) return null
  const photo = image.photo
  // 授權照片一定要能顯示作者與授權，缺一就不顯示照片。
  if (!photo || !text(photo.author) || !text(photo.license)) return null
  let src
  try { src = new URL(image.url, new URL(baseURL).origin).href } catch { return null }
  const reference = image.kind === 'nearby' && photo.reference ? {
    name: text(photo.reference.name),
    distance: Number.isFinite(photo.reference.distanceMeters) ? Math.round(photo.reference.distanceMeters) : null,
  } : null
  return {
    src, kind: image.kind,
    alt: text(photo.alt) || `${place.name || '場所'}${image.kind === 'reviewed' ? '照片' : '參考照片'}（非即時）`,
    author: photo.author, credit: text(photo.credit), license: photo.license,
    licenseUrl: httpsOnly(photo.licenseUrl), sourceUrl: httpsOnly(photo.sourceUrl),
    changes: text(photo.changes), year: String(photo.capturedAt || '').match(/^\d{4}/)?.[0] || null,
    notice: text(image.notice), reference,
  }
}

// 卡片與詳情上的小標：同場所照片標拍攝年份；同主體或附近的照片一律標「參考照片」。
export function photoTag(image) {
  if (!image) return '原創示意插畫・非實景'
  if (image.kind === 'reviewed') return `歷史照片${image.year ? `・${image.year}` : ''}・非即時`
  return '參考照片・非即時'
}
