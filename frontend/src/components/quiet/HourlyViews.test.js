import { computed, createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { HOURLY_LABEL } from '../../lib/hourlyApi.js'
import { hourlyMetaFor } from '../../lib/hourlyApi.fixture.js'
import { DEFAULT_PREFERENCES } from '../../lib/sensoryDomain.js'
import MockBanner from './MockBanner.vue'
import QuietProfile from './QuietProfile.vue'

const render = (component, props) => renderToString(createSSRApp(component, props))
function cityFor({ remote = true, dayType = 'weekday', hour = 8, meta = hourlyMetaFor() } = {}) {
  const preferences = ref({ ...DEFAULT_PREFERENCES, sensitivities: { noise: 3, light: 3, crowd: 3, odor: 3 }, dataMode: remote ? 'remote-hourly' : 'live', dayType, hour })
  return { preferences, remoteMock: computed(() => preferences.value.dataMode === 'remote-hourly'), hourly: { meta: ref(remote ? meta : null) } }
}

describe('hourly banner', () => {
  it('shows the selected typical slot and the simulated label only in remote-hourly mode', async () => {
    const html = await render(MockBanner, { city: cityFor({ dayType: 'weekend', hour: 7 }) })
    expect(html).toContain('測試情境：週末 07:00')
    expect(html).toContain(HOURLY_LABEL)
    expect(await render(MockBanner, { city: cityFor({ remote: false }) })).not.toContain(HOURLY_LABEL)
  })
})

describe('test data settings', () => {
  it('offers an explicit live / simulated switch with day type and 24 hours', async () => {
    const html = await render(QuietProfile, { city: cityFor({ hour: 20 }) })
    expect(html).toContain('使用模擬情境')
    expect(html).toMatch(/aria-pressed="true"[^>]*>平日</)
    expect(html).toContain('週末')
    expect(html.match(/<option/g)).toHaveLength(24)
    expect(html).toMatch(/<option value="20"[^>]*selected[^>]*>20:00–21:00/)
    expect(html).toContain('不是實際日期')
    expect(html).toContain('無資料不代表安靜')
  })
  it('lists the grid sources and falls back to the id when a source has no name', async () => {
    const html = await render(QuietProfile, { city: cityFor() })
    expect(html).toContain('模擬網格資料來源')
    expect(html).toContain('臺北市區界圖 20220915')
    expect(html).toContain('臺北市政府民政局')
    expect(html).toContain('curated-v2')
  })
  it('hides the slot controls and sources in live mode', async () => {
    const html = await render(QuietProfile, { city: cityFor({ remote: false }) })
    expect(html).toContain('目前顯示正式資料')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('模擬網格資料來源')
  })
})
