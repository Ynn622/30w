export const VERSION_CHECK_INTERVAL_MS = 60_000

// 版本號由同一次 Vite 建置同時寫入 bundle 與 version.json。
export function startVersionChecker({
  currentVersion = import.meta.env.VITE_APP_VERSION,
  manifestPath = `${import.meta.env.BASE_URL}version.json`,
  onVersionMismatch,
}) {
  if (!currentVersion || import.meta.env.DEV) return () => {}

  let stopped = false
  let notified = false
  let controller

  async function check() {
    if (stopped || notified || controller) return
    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), 15_000)
    try {
      const separator = manifestPath.includes('?') ? '&' : '?'
      const response = await fetch(`${manifestPath}${separator}t=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) return
      const remote = await response.json()
      if (stopped || typeof remote?.version !== 'string' || !remote.version.trim()) return
      if (remote.version !== currentVersion) {
        notified = true
        onVersionMismatch({ currentVersion, remoteVersion: remote.version, remoteBuildTime: remote.buildTime })
      }
    } catch {
      // 網路或部署暫時失敗時，保留目前頁面並於下一分鐘重試。
    } finally {
      clearTimeout(timeout)
      controller = undefined
    }
  }

  void check()
  const timer = setInterval(() => { void check() }, VERSION_CHECK_INTERVAL_MS)
  return () => {
    stopped = true
    clearInterval(timer)
    controller?.abort()
  }
}
