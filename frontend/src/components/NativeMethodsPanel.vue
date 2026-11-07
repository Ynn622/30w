<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getNativeChannel } from '../lib/webview.js'
import { requestNative } from '../lib/nativeClient.js'

const methods = [
  { name: 'userinfo', label: '會員資料', data: null },
  { name: 'deviceinfo', label: '裝置資訊', data: null },
  { name: 'location', label: '目前位置', data: null },
  { name: 'qr_code_scan', label: '掃描 QR Code', data: null },
  { name: 'launch_map', label: '開啟地圖', data: 'https://maps.app.goo.gl/sQKx4n3WctXuS5Bw8' },
  { name: 'open_link', label: '開啟網頁', data: 'https://www.gov.taipei/' },
  { name: 'phone_call', label: '開啟撥號功能', data: '', hint: '請輸入要測試的電話號碼（JSON 字串）。' },
  { name: '1999agree', label: '1999 撥號條款', data: true },
  { name: 'notify', label: '發送測試通知', data: { title: '介接測試', content: '這是一則 WebView 測試通知' } },
]
const selectedName = ref('userinfo')
const selected = computed(() => methods.find((item) => item.name === selectedName.value))
const input = ref('null')
const channel = ref('browser')
const status = ref('尚未送出')
const request = ref(null)
const response = ref(null)
const pending = ref(false)
let controller
let disposed = false

function connect() {
  channel.value = getNativeChannel(window)
}

function selectMethod() {
  input.value = JSON.stringify(selected.value.data, null, 2)
}

async function send() {
  if (pending.value) return
  let data
  try {
    data = JSON.parse(input.value)
    if (['phone_call', 'open_link', 'launch_map'].includes(selectedName.value)
      && (typeof data !== 'string' || !data.trim())) throw new Error('請輸入非空白的 JSON 字串。')
  } catch (error) {
    status.value = `參數格式錯誤：${error.message}`
    return
  }

  connect() // 每次送出重新偵測，支援 App 延後注入 bridge。
  response.value = null
  request.value = { name: selectedName.value, data }
  if (channel.value !== 'town-pass') {
    status.value = '尚未連接城市通 flutterObject；請在城市通 App WebView 內開啟此頁。此要求未送出。'
    return
  }

  pending.value = true
  status.value = '等待 App 回覆…'
  controller = new AbortController()
  const currentController = controller
  try {
    const reply = await requestNative(request.value.name, data, { host: window, signal: controller.signal })
    if (disposed || currentController !== controller) return
    response.value = reply.replied ? { name: reply.name, data: reply.data } : null
    status.value = !reply.replied
      ? '已送出；此方法成功時不回覆，請查看 App 畫面或手機通知。'
      : reply.data === false
        ? 'App 回覆 false：操作未完成，請確認參數、權限或裝置支援。'
        : reply.name === 'qr_code_scan' && reply.data === null
          ? '已取消掃描（App 回覆 null）'
          : '已收到 App 回覆'
  } catch (error) {
    if (!disposed && currentController === controller && error.code !== 'CANCELLED') status.value = error.message
  } finally {
    if (!disposed && currentController === controller) pending.value = false
  }
}

function clearResult() {
  controller?.abort()
  controller = undefined
  pending.value = false
  request.value = null
  response.value = null
  status.value = '已清除顯示資料'
}

onMounted(connect)
onUnmounted(() => {
  disposed = true
  controller?.abort()
})
</script>

<template>
  <section class="native-panel" aria-labelledby="native-panel-title">
    <h2 id="native-panel-title">城市通介接測試</h2>
    <p>連線：{{ channel === 'town-pass' ? '已偵測到 flutterObject' : '未連接城市通 WebView' }}</p>
    <label for="native-method">App 方法</label>
    <select id="native-method" v-model="selectedName" :disabled="pending" @change="selectMethod">
      <option v-for="method in methods" :key="method.name" :value="method.name">{{ method.label }} · {{ method.name }}</option>
    </select>
    <label for="native-data">data（JSON）</label>
    <textarea id="native-data" v-model="input" :disabled="pending" rows="5" spellcheck="false" />
    <p v-if="selected.hint">{{ selected.hint }}</p>
    <div class="native-panel__actions">
      <button type="button" :disabled="pending" @click="send">{{ pending ? '等待回覆中…' : `測試${selected.label}` }}</button>
      <button type="button" class="secondary" @click="clearResult">清除結果</button>
    </div>
    <p role="status" aria-live="polite">{{ status }}</p>
    <template v-if="request">
      <h3>要求內容</h3>
      <pre>{{ JSON.stringify(request, null, 2) }}</pre>
    </template>
    <template v-if="response">
      <h3>App 回傳資料</h3>
      <pre>{{ JSON.stringify(response, null, 2) }}</pre>
    </template>
    <p>資料僅顯示於本頁，離開分頁即清除。定位、會員資料及原生功能皆需手動點選測試。</p>
    <a href="https://tpe-guideline.web.app/docs/two-way-connection/app_method.html" target="_blank" rel="noopener noreferrer">查看官方方法文件</a>
  </section>
</template>

<style scoped>
.native-panel { margin-top: 24px; padding: 18px; border: 1px solid var(--line); border-radius: 21px; background: white; min-width: 0; }
h2 { margin: 0 0 10px; font-size: 18px; }
h3 { margin: 16px 0 8px; font-size: 13px; }
p { font-size: 12px; color: var(--muted); line-height: 1.7; overflow-wrap: anywhere; }
label { display: block; margin: 14px 0 7px; font-size: 12px; font-weight: 600; }
select, textarea { width: 100%; min-width: 0; padding: 10px; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); background: var(--canvas); font-size: 16px; }
select { min-height: 44px; }
textarea { resize: vertical; font-family: monospace; }
.native-panel__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
button { min-height: 44px; border: 0; border-radius: 12px; padding: 10px 14px; background: var(--brand); color: white; cursor: pointer; font-size: 12px; }
button.secondary { background: var(--mint); color: var(--brand); }
button:disabled { opacity: .55; cursor: wait; }
pre { max-height: 360px; overflow: auto; padding: 12px; border-radius: 10px; background: #eef4f3; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
a { display: inline-flex; align-items: center; min-height: 44px; font-size: 12px; color: var(--brand); }
</style>
