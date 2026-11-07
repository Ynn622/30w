<script setup>
import { computed, onUnmounted, ref } from 'vue'
import apiConfig from '../config/apiConfig.js'
import { apiRequest } from '../lib/apiClient.js'
import AsyncState from './AsyncState.vue'

defineProps({ embedded: { type: Boolean, default: false } })

const endpoint = ref('hello')
const name = ref('CityLink')
const loading = ref(false)
const result = ref(null)
const errorMessage = ref('')
let controller
let disposed = false

const requestURL = computed(() => {
  const url = endpoint.value === 'health'
    ? new URL('/health', apiConfig.baseURL)
    : new URL(`${apiConfig.baseURL}/hello`)
  if (endpoint.value === 'hello' && name.value.trim()) {
    url.searchParams.set('name', name.value.trim())
  }
  return url.href
})

async function execute() {
  if (loading.value) return
  loading.value = true
  result.value = null
  errorMessage.value = ''
  controller = new AbortController()
  const url = requestURL.value
  try {
    const response = await apiRequest(url, { signal: controller.signal })
    if (disposed) return
    result.value = {
      ...response, ok: true, body: formatBody(response.data),
    }
  } catch (error) {
    if (disposed) return
    errorMessage.value = error.message
    if (error.status) result.value = { url, status: error.status, elapsed: error.elapsed, ok: false, body: formatBody(error.data) }
  } finally {
    if (!disposed) loading.value = false
  }
}

function formatBody(data) {
  return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
}

onUnmounted(() => {
  disposed = true
  controller?.abort()
})
</script>

<template>
  <section class="api-test-view" :class="{ view: !embedded }" aria-labelledby="api-test-title">
    <header class="subpage-header">
      <span class="section-kicker">BACKEND API</span>
      <h1 id="api-test-title">API 測試</h1>
      <p>直接從目前的瀏覽器或 WebView 呼叫後端。</p>
    </header>

    <form class="api-test-card" @submit.prevent="execute">
      <label for="api-endpoint">測試端點</label>
      <select id="api-endpoint" v-model="endpoint" :disabled="loading">
        <option value="hello">GET /api/v1/hello · 問候訊息</option>
        <option value="health">GET /health · 健康檢查</option>
      </select>
      <template v-if="endpoint === 'hello'">
        <label for="api-name">名稱（選填）</label>
        <input id="api-name" v-model="name" :disabled="loading" maxlength="100" placeholder="留白使用後端預設值" />
      </template>
      <p class="api-test-label">請求網址</p>
      <code>{{ requestURL }}</code>
      <button type="submit" :disabled="loading">{{ loading ? '請求中…' : '送出 GET 請求' }}</button>
    </form>

    <AsyncState v-if="loading" state="loading" message="正在等待後端回應…" />
    <AsyncState v-if="errorMessage" state="error" :message="errorMessage" retry @retry="execute" />
    <article v-if="result" class="api-test-card" aria-live="polite">
      <h2>回應結果</h2>
      <div class="api-test-meta">
        <strong :class="result.ok ? 'success' : 'failure'">HTTP {{ result.status }}</strong>
        <span>{{ result.elapsed }} ms</span>
      </div>
      <code>{{ result.url }}</code>
      <pre>{{ result.body }}</pre>
    </article>
    <AsyncState v-else-if="!loading && !errorMessage" state="empty" title="尚無測試結果" message="選擇端點後按下送出，即可查看實際回應。" />
    <a class="api-test-docs" href="https://30wbackend.idfc.dev/docs/" target="_blank" rel="noopener noreferrer">開啟 Swagger 文件</a>
  </section>
</template>

<style scoped>
.api-test-card { min-width: 0; margin-bottom: 18px; padding: 18px; border: 1px solid var(--line); border-radius: 21px; background: white; }
label, .api-test-label { display: block; margin: 14px 0 8px; font-size: 13px; font-weight: 600; }
label:first-child { margin-top: 0; }
select, input { width: 100%; min-width: 0; min-height: 46px; padding: 10px; border: 1px solid var(--line); border-radius: 11px; background: var(--canvas); color: var(--ink); font-size: 16px; }
code { display: block; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
button { width: 100%; min-height: 46px; margin-top: 18px; border: 0; border-radius: 12px; color: white; background: var(--brand); cursor: pointer; }
button:disabled { opacity: .6; cursor: wait; }
h2 { margin: 0 0 14px; font-size: 18px; }
.api-test-meta { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 12px; font-size: 13px; }
.success { color: #267047; }.failure, .api-test-error { color: #ac382d; }
pre { max-height: 400px; overflow: auto; padding: 12px; border-radius: 10px; background: var(--canvas); font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.api-test-error, .api-test-hint { font-size: 13px; line-height: 1.8; }
.api-test-docs { display: inline-flex; align-items: center; min-height: 44px; color: var(--brand); font-size: 13px; }
</style>
