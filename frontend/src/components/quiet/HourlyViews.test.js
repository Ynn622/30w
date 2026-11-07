import { computed, createSSRApp, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { HOURLY_LABEL } from '../../lib/hourlyApi.js'
import { hourlyMetaFor } from '../../lib/hourlyApi.fixture.js'
import { DEFAULT_PREFERENCES } from '../../lib/sensoryDomain.js'
import TestDataPanel from './TestDataPanel.vue'
import QuietProfile from './QuietProfile.vue'

const render = (component, props) => renderToString(createSSRApp(component, props))
function cityFor({ remote = true, dayType = 'weekday', hour = 8, meta = hourlyMetaFor(), state = 'ready', error = '' } = {}) {
  const preferences = ref({ ...DEFAULT_PREFERENCES, sensitivities: { noise: 3, light: 3, crowd: 3, odor: 3 }, dataMode: remote ? 'remote-hourly' : 'live', dayType, hour })
  // 2026-11-09T01:30Z = 臺北週一 09:30（平日 09:00）。
  return { preferences, now: ref(Date.parse('2026-11-09T01:30:00Z')), remoteMock: computed(() => preferences.value.dataMode === 'remote-hourly'), hourly: { meta: ref(meta), state: ref(state), error: ref(error), reload: () => {} } }
}

describe('explore 模擬環境 panel', () => {
  it('collapses into a small 模擬環境 toggle normally and explains the current Taipei slot', async () => {
    const html = await render(TestDataPanel, { city: cityFor({ remote: false }) })
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="test-data-panel"[^>]*>[\s\S]*模擬環境/)
    expect(html).toMatch(/id="test-data-panel"[^>]*style="display:none;"/)
    // 說明文字與資料來源清單已移除，面板只留設定。
    expect(html).not.toContain('目前顯示臺北當下時段')
    expect(html).not.toContain('模擬網格資料來源')
    expect(html).not.toContain(HOURLY_LABEL)
    expect(html).not.toContain('type="range"')
    expect(html).not.toContain('測試')
  })
  it('keeps the chosen slot and the label visible on the toggle in the simulated environment', async () => {
    const html = await render(TestDataPanel, { city: cityFor({ dayType: 'weekend', hour: 20 }) })
    expect(html).toContain('模擬環境：週末 20:00')
    expect(html).toContain(HOURLY_LABEL)
    expect(html).toContain('使用模擬環境')
    expect(html).not.toContain('推薦場所與其他頁面不受影響')
    expect(html).not.toContain('測試')
  })
  it('offers day type buttons and a 0–23 hour slider showing the selected range', async () => {
    const html = await render(TestDataPanel, { city: cityFor({ hour: 20 }) })
    expect(html).toMatch(/aria-pressed="true"[^>]*>平日</)
    expect(html).toContain('週末')
    expect(html).toMatch(/<input id="test-hour"[^>]*type="range"[^>]*min="0"[^>]*max="23"[^>]*step="1"[^>]*value="20"/)
    expect(html).toContain('20:00–21:00')
  })
  it('shows loading and errors with a retry', async () => {
    expect(await render(TestDataPanel, { city: cityFor({ state: 'loading' }) })).toContain('模擬網格載入中…')
    const failed = await render(TestDataPanel, { city: cityFor({ state: 'error', error: '模擬網格資料暫時無法使用（503），請稍後再試。' }) })
    expect(failed).toContain('（503）')
    expect(failed).toContain('重試')
  })
  it('is no longer in the profile page', async () => {
    const html = await render(QuietProfile, { city: cityFor() })
    expect(html).not.toContain('模擬環境')
  })
})

describe('panel without a place source switch', () => {
  it('no longer offers the 天母場所資料 switch', async () => {
    const html = await render(TestDataPanel, { city: cityFor({ remote: false }) })
    expect(html).not.toContain('天母場所')
  })
})
