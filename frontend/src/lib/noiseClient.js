// 環境音量量測：網頁以 getUserMedia + Web Audio 在裝置上即時計算 dBFS 統計，不錄音、不保存或上傳音訊。
// 城市通 App 內使用時，Flutter WebView 須先允許麥克風（見 docs/flutter-noise-interface.md）。

export const NOISE_INTERVAL_MS = 250
const POLL_MS = 40
const MIN_DBFS = -160
const PERMISSION_TIMEOUT_MS = 30_000

export function validNoiseSample(data) {
  return Number.isFinite(data?.averageDbfs) && data.averageDbfs >= MIN_DBFS && data.averageDbfs <= 0
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

const toDb = (value, factor) => (value > 0 ? Math.max(MIN_DBFS, Math.min(0, Math.round(factor * Math.log10(value) * 10) / 10)) : MIN_DBFS)

// 一段時域樣本的均方值與絕對峰值；均方值 1 = 0 dBFS（滿刻度直流），即 RMS dBFS。
export function measureFrame(buffer) {
  let sumSquares = 0, peak = 0
  for (const value of buffer) {
    sumSquares += value * value
    const magnitude = Math.abs(value)
    if (magnitude > peak) peak = magnitude
  }
  return { meanSquare: buffer.length ? sumSquares / buffer.length : 0, peak }
}

// 多段讀數以功率（均方值）平均，再轉 dBFS；不對分貝做算術平均。
export function windowLevels(frames) {
  if (!frames.length) return null
  const meanSquare = frames.reduce((sum, frame) => sum + frame.meanSquare, 0) / frames.length
  const peak = Math.max(...frames.map(frame => frame.peak))
  const averageDbfs = toDb(meanSquare, 10)
  return { averageDbfs, peakDbfs: Math.max(averageDbfs, toDb(peak, 20)) }
}

export function microphoneSupport(host = globalThis) {
  if (host?.isSecureContext === false) return { supported: false, message: '環境音量量測需要 HTTPS 連線。' }
  if (typeof host?.navigator?.mediaDevices?.getUserMedia !== 'function') return { supported: false, message: '此瀏覽器或 App 版本不支援麥克風，無法量測環境音量。' }
  if (typeof (host.AudioContext || host.webkitAudioContext) !== 'function') return { supported: false, message: '此瀏覽器不支援 Web Audio，無法量測環境音量。' }
  return { supported: true, message: '' }
}

// 訊息附上錯誤名稱，方便在手機 WebView 上判斷是權限、裝置還是系統中斷。
function permissionFailure(error) {
  const code = `（${error?.name || 'Error'}）`
  if (['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(error?.name)) {
    return { status: 'denied', message: `麥克風權限未允許。若在城市通 App 內，請確認 App 已允許麥克風且 WebView 有處理權限請求。${code}` }
  }
  if (['NotFoundError', 'OverconstrainedError'].includes(error?.name)) return { status: 'unsupported', message: `找不到可用的麥克風。${code}` }
  if (error?.name === 'NotReadableError') return { status: 'error', message: `麥克風正被其他程式使用或遭系統中斷。${code}` }
  return { status: 'error', message: `無法啟動麥克風，請稍後再試。${code}` }
}

export function createNoiseSession({ host = globalThis, durationSeconds = 15, onStatus = () => {}, onSample = () => {}, now = () => Date.now() } = {}) {
  const support = microphoneSupport(host)
  if (!support.supported) throw new Error(support.message)
  const sessionId = globalThis.crypto?.randomUUID?.() || `noise-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const duration = Math.max(5, Math.min(30, durationSeconds))
  const durationMs = duration * 1000
  let closed = false
  let startedAt = null
  let startedClock = 0
  let stream = null
  let source = null
  let poller
  let deadline
  let resumeTimer
  let frames = []
  let nextWindowMs = NOISE_INTERVAL_MS
  const samples = []
  // AudioContext 須在使用者點擊的同步流程建立，iOS WebView 才不會停在 suspended。
  const AudioContextClass = host.AudioContext || host.webkitAudioContext
  const context = new AudioContextClass()
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  const buffer = new Float32Array(analyser.fftSize)
  // 部分 WebKit 不處理沒有接到 destination 的節點，會讀到全零；以音量 0 的 gain 接上輸出，不會發出聲音。
  const sink = context.createGain()
  sink.gain.value = 0

  function release() {
    clearInterval(poller)
    clearTimeout(deadline)
    clearTimeout(resumeTimer)
    try { source?.disconnect(); analyser.disconnect(); sink.disconnect() } catch { /* 已斷開 */ }
    stream?.getTracks().forEach(track => { track.onended = null; track.stop() })
    stream = null
    context.onstatechange = null
    if (context.state !== 'closed') context.close().catch(() => {})
  }
  function finish(status, message = '') {
    if (closed) return
    closed = true
    release()
    onStatus({ status, message, startedAt, summary: status === 'completed' ? noiseSummary(samples) : null })
  }
  function emitWindow(elapsedMs) {
    const levels = windowLevels(frames)
    frames = []
    if (!levels) return
    const sample = { ...levels, elapsedMs }
    if (!validNoiseSample(sample)) return
    samples.push(sample)
    onSample(sample)
  }
  function poll() {
    if (closed) return
    const elapsed = now() - startedClock
    analyser.getFloatTimeDomainData(buffer)
    frames.push(measureFrame(buffer))
    while (elapsed >= nextWindowMs && nextWindowMs <= durationMs) {
      emitWindow(nextWindowMs)
      nextWindowMs += NOISE_INTERVAL_MS
    }
    if (elapsed >= durationMs) {
      if (!samples.length || samples.at(-1).elapsedMs < durationMs - 1000) finish('error', '沒有收到足夠時長的有效量測資料。')
      else finish('completed')
    }
  }

  deadline = setTimeout(() => finish('error', '等待麥克風權限逾時，已停止量測。'), PERMISSION_TIMEOUT_MS)
  // 關閉自動增益、降噪與回音消除，避免系統處理改變音量統計。
  host.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
    .then(async granted => {
      // 使用者已取消或逾時後才允許：立即釋放，不啟動量測。
      if (closed) { granted.getTracks().forEach(track => track.stop()); return }
      stream = granted
      stream.getAudioTracks().forEach(track => { track.onended = () => finish('error', '麥克風已被系統中斷，量測停止。') })
      if (context.state === 'suspended') await context.resume()
      if (closed) return
      source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.connect(sink)
      sink.connect(context.destination)
      // iOS 開啟麥克風切換音訊工作階段時可能短暫 suspended／interrupted：先嘗試恢復，1.5 秒仍未恢復才停止。
      context.onstatechange = () => {
        if (closed) return
        clearTimeout(resumeTimer)
        if (context.state === 'running') return
        if (context.state === 'closed') { finish('error', '音訊被系統中斷，量測停止。'); return }
        context.resume().catch(() => {})
        resumeTimer = setTimeout(() => { if (context.state !== 'running') finish('error', `音訊被系統中斷（${context.state}），量測停止。`) }, 1500)
      }
      clearTimeout(deadline)
      startedClock = now()
      // observedAt 以實際開始量測為準，不含等待權限的時間。
      startedAt = new Date(startedClock).toISOString()
      onStatus({ status: 'measuring', startedAt })
      poller = setInterval(poll, POLL_MS)
      deadline = setTimeout(() => finish('error', '量測逾時，已停止感測。'), durationMs + 5000)
    })
    .catch(error => { const failure = permissionFailure(error); finish(failure.status, failure.message) })

  return { sessionId, getStartedAt: () => startedAt, stop: () => finish('stopped', '已停止量測。'), getSummary: () => noiseSummary(samples) }
}
