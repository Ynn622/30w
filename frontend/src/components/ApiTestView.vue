<script setup>
import { computed, onUnmounted, ref } from 'vue'
import apiConfig from '../config/apiConfig.js'

const endpoint = ref('hello')
const name = ref('CityLink')
const loading = ref(false)
const result = ref(null)
const errorMessage = ref('')
let controller
let timeout
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
  const started = performance.now()
  timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    const text = await response.text()
    let body = text || '(空白回應)'
    try { body = JSON.stringify(JSON.parse(text), null, 2) } catch { /* 保留非 JSON 回應。 */ }
    if (disposed) return
    result.value = {
      url,
      status: response.status,
      ok: response.ok,
      elapsed: Math.round(performance.now() - started),
      body,
    }
    if (!response.ok) errorMessage.value = `伺服器回傳 HTTP ${response.status}，請查看下方內容。`
  } catch (error) {
    if (disposed) return
    errorMessage.value = error.name === 'AbortError'
      ? '請求超過 15 秒，請稍後重試。'
      : '無法取得回應。請檢查網路、後端連線與 CORS 允許的前端來源。'
  } finally {
    clearTimeout(timeout)
    if (!disposed) loading.value = false
  }
}

onUnmounted(() => {
  disposed = true
  clearTimeout(timeout)
  controller?.abort()
})
</script>

<template>
  <section class="view api-test-view" aria-labelledby="api-test-title">
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

    <p v-if="loading" role="status">正在等待後端回應…</p>
    <p v-if="errorMessage" class="api-test-error" role="alert">{{ errorMessage }}</p>
    <article v-if="result" class="api-test-card" aria-live="polite">
      <h2>回應結果</h2>
      <div class="api-test-meta">
        <strong :class="result.ok ? 'success' : 'failure'">HTTP {{ result.status }}</strong>
        <span>{{ result.elapsed }} ms</span>
      </div>
      <code>{{ result.url }}</code>
      <pre>{{ result.body }}</pre>
    </article>
    <p v-else-if="!loading && !errorMessage" class="api-test-hint">選擇端點後按下送出，即可查看實際回應。</p>
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
