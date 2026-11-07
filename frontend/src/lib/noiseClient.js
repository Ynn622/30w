import { getNativeChannel, startNativeNoise, stopNativeNoise, subscribeToNativeMessages } from './webview.js'

export function validNoiseSample(data) {
  return Number.isFinite(data?.averageDbfs) && data.averageDbfs >= -160 && data.averageDbfs <= 0
    && Number.isFinite(data?.peakDbfs) && data.peakDbfs >= data.averageDbfs && data.peakDbfs <= 0
    && Number.isFinite(data?.elapsedMs) && data.elapsedMs >= 0 && data.elapsedMs <= 35_000
}
export function noiseSummary(samples) {
  if (!samples.length) return null
  return {
    sampleCount: samples.length,
    averageDbfs: Math.round(10 * Math.log10(samples.reduce((sum, sample) => sum + 10 ** (sample.averageDbfs / 10), 0) / samples.length) * 10) / 10,
    peakDbfs: Math.max(...samples.map(sample => sample.peakDbfs)),
    durationMs: samples.at(-1).elapsedMs,
    unit: 'dBFS', calibrated: false,
  }
}
export function createNoiseSession({ host = globalThis, durationSeconds = 15, onStatus = () => {}, onSample = () => {}, now = () => Date.now() } = {}) {
  if (getNativeChannel(host) !== 'town-pass') throw new Error('請由支援噪音感測的 Flutter App 開啟，瀏覽器不會模擬麥克風數值。')
  const sessionId = globalThis.crypto?.randomUUID?.() || `noise-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const duration = Math.max(5, Math.min(30, durationSeconds))
  let closed = false
  let accepted = false
  let startedAt = null
  let timer
  let unsubscribe = () => {}
  let lastElapsed = -1
  const samples = []
  function finish(status, message) {
    if (closed) return
    closed = true
    clearTimeout(timer)
    unsubscribe()
    try { stopNativeNoise(sessionId, host) } catch { /* 本地清理仍須完成。 */ }
    onStatus({ status, message, startedAt, summary: status === 'completed' ? noiseSummary(samples) : null })
  }
  function deadline(ms, message) {
    clearTimeout(timer)
    timer = setTimeout(() => finish('error', message), ms)
  }
  unsubscribe = subscribeToNativeMessages(({ name, data }) => {
    if (closed || data?.sessionId !== sessionId || data.protocolVersion !== 1) return
    if (name === 'noise_status') {
      if (data.status === 'measuring' && !accepted) {
        accepted = true
        // observedAt 以 App 確認開始量測為準，不含等待權限的時間。
        startedAt = new Date(now()).toISOString()
        deadline(duration * 1000 + 5000, '量測回覆逾時，已停止感測。')
        onStatus({ status: 'measuring', startedAt })
      } else if (['denied', 'unsupported', 'error', 'stopped'].includes(data.status)) {
        finish(data.status, data.message || '量測未完成，請確認 App 支援及麥克風權限。')
      } else if (data.status === 'completed') {
        if (!samples.length || lastElapsed < (duration - 1) * 1000) finish('error', '沒有收到足夠時長的有效量測資料。')
        else finish('completed', '')
      }
    } else if (name === 'noise_sample' && accepted && validNoiseSample(data) && data.elapsedMs > lastElapsed && data.elapsedMs <= duration * 1000 + 1000) {
      lastElapsed = data.elapsedMs
      const sample = { averageDbfs: data.averageDbfs, peakDbfs: data.peakDbfs, elapsedMs: data.elapsedMs }
      samples.push(sample)
      onSample(sample)
    }
  }, host)
  deadline(30_000, 'App 尚未開始量測，請確認 handler 與麥克風權限。')
  try { startNativeNoise(sessionId, duration, host) } catch (error) { finish('error', error.message) }
  return { sessionId, getStartedAt: () => startedAt, stop: () => finish('stopped', '已停止量測。'), getSummary: () => noiseSummary(samples) }
}
