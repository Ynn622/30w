import { getNativeChannel, sendToNative, subscribeToNativeMessages } from './webview.js'

export const NO_REPLY_METHODS = new Set(['open_link', 'notify', '1999agree'])
const activeHosts = new WeakSet()

// 官方訊息沒有 requestId，因此同一個 WebView 一次只允許一個等待中的請求。
export function requestNative(name, data = null, {
  host = globalThis,
  signal,
  timeoutMs = name === 'qr_code_scan' ? 120_000 : 30_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const fail = (code, message) => Object.assign(new Error(message), { code })
    if (signal?.aborted) return reject(fail('CANCELLED', '已停止等待 App 回覆。'))
    if (getNativeChannel(host) !== 'town-pass') return reject(fail('UNAVAILABLE', '尚未連接台北通 WebView，請由 App 開啟此頁。'))
    if (activeHosts.has(host)) return reject(fail('BUSY', '已有其他 App 請求等待回覆，請稍後重試。'))
    activeHosts.add(host)
    let unsubscribe = () => {}
    let timer
    let settled = false
    const finish = (error, result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      signal?.removeEventListener('abort', cancel)
      activeHosts.delete(host)
      if (error) reject(error)
      else resolve(result)
    }
    const cancel = () => finish(fail('CANCELLED', '已停止等待 App 回覆（不會關閉已開啟的原生功能）。'))
    try {
      unsubscribe = subscribeToNativeMessages((reply) => {
        if (reply.name === name) finish(null, { ...reply, replied: true })
      }, host)
      signal?.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(() => finish(fail('TIMEOUT', '尚未收到 App 回覆，請確認權限、方法支援或原生頁面狀態。')), timeoutMs)
      sendToNative(name, data, host)
      if (NO_REPLY_METHODS.has(name)) finish(null, { name, data: null, replied: false })
    } catch (error) {
      finish(fail('SEND_FAILED', `送出失敗：${error.message}`))
    }
  })
}
