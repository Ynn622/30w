// 投稿重送界線：同一事件重送時沿用第一次凍結的 canonical payload（含 observedAt 與位置），
// 讓後端可用完整 body 判斷重送；使用者改了內容或位置才視為新事件。
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}
export function createRetryableDraft(build) {
  let key = null, body = null
  return {
    // inputs 相同就回傳同一份 body；不同才重新 build（例如重新產生 observedAt）。
    take(inputs) {
      const next = JSON.stringify(inputs)
      if (next !== key) { key = next; body = deepFreeze(build(JSON.parse(next))) }
      return body
    },
    clear() { key = null; body = null },
  }
}
export function createReportDraft(now = () => Date.now()) {
  return createRetryableDraft(({ kind, note, location, intensity }) => {
    const body = { kind, note, location, observedAt: new Date(now()).toISOString() }
    if (intensity !== undefined) body.intensity = intensity
    return body
  })
}
// 量測摘要只依 session 快照組成：位置在按下開始時凍結，observedAt 為 App 確認開始量測的時間。
export function measurementPayload({ sessionId, location, observedAt, summary }) {
  return deepFreeze({ protocolVersion: 1, sessionId, source: 'native_microphone', location: { ...location }, observedAt, consent: true, ...summary })
}
