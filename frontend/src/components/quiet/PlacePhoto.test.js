import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import PlacePhoto from './PlacePhoto.vue'
import PlaceCard from './PlaceCard.vue'
import { PLACE_ID, placeWith } from '../../lib/placeImage.fixture.js'

// 去掉 SSR 的片段註解（<!--[-->），方便比對連續文字。
const render = async (component, props) => (await renderToString(createSSRApp(component, props))).replace(/<!--[\s\S]*?-->/g, '')

describe('place photo component (issue #7)', () => {
  it('loads the embedded image from the API origin with anonymous CORS, no referrer and lazy loading', async () => {
    const html = await render(PlacePhoto, { place: placeWith('reviewed') })
    expect(html).toMatch(new RegExp(`src="https://30wbackend\\.idfc\\.dev/api/v1/places/${PLACE_ID}/image\\?v=[0-9a-f]+"`))
    expect(html).toContain('crossorigin="anonymous"')
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).toContain('loading="lazy"')
    // 縮圖不顯示小標；詳情（large）才顯示。
    expect(html).not.toContain('place-photo-tag')
    expect(await render(PlacePhoto, { place: placeWith('reviewed'), large: true })).toContain('歷史照片・2010・非即時')
  })
  it('explains nearby reference photos with full attribution and links in the detail view, without a review warning', async () => {
    const html = await render(PlacePhoto, { place: placeWith('nearby'), large: true })
    expect(html).toContain('參考照片・非即時')
    // 署名預設收起，點照片右下角的 info 按鈕才展開。
    expect(html).toMatch(/<button[^>]*class="place-photo-info"[^>]*aria-expanded="false"[^>]*aria-label="查看照片來源與授權"/)
    expect(html).toMatch(/<figcaption[^>]*style="display:none;"[^>]*class="place-photo-credit"|<figcaption[^>]*class="place-photo-credit"[^>]*style="display:none;"/)
    expect(html).toContain('附近參考照片：大安森林公園（約 91 公尺），非此場所實景。')
    expect(html).toContain('照片：玄史生（Own work）')
    expect(html).toContain('href="https://creativecommons.org/licenses/by-sa/3.0/"')
    expect(html).toContain('原始來源')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('修改：Wikimedia 縮圖')
    expect(html).toContain('參考照片，非即時影像。')
    expect(html).not.toContain('未人工核對')
  })
  it('falls back to the original illustration without requesting the backend SVG', async () => {
    const html = await render(PlacePhoto, { place: placeWith('illustration'), large: true })
    expect(html).not.toContain('<img')
    expect(html).not.toContain('place-photo-info')
    expect(html).toContain('原創示意插畫・非實景')
  })
  it('shows the photo and a plain-text credit on the place card', async () => {
    const html = await render(PlaceCard, { place: placeWith('nearby') })
    expect(html).toContain('<img')
    expect(html).toContain('參考照片：玄史生・CC BY-SA 3.0')
    expect(html).not.toContain('<a ')
  })
})
