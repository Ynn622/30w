export const TOWN_PASS_BRIDGE_NAME = 'flutterObject'

export function createTownPassMessage(name, data = null) {
  return JSON.stringify({ name, data })
}

export function parseTownPassMessage(message) {
  try {
    const parsed = typeof message === 'string' ? JSON.parse(message) : message
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') {
      return null
    }
    return { name: parsed.name, data: parsed.data ?? null }
  } catch {
    return null
  }
}

export function getNativeChannel(host = globalThis) {
  if (typeof host?.[TOWN_PASS_BRIDGE_NAME]?.postMessage === 'function') return 'town-pass'
  if (typeof host?.webkit?.messageHandlers?.cityApp?.postMessage === 'function') return 'webkit'
  if (typeof host?.CityApp?.postMessage === 'function') return 'android'
  if (typeof host?.ReactNativeWebView?.postMessage === 'function') return 'react-native'
  return 'browser'
}

export function sendToNative(name, data = null, host = globalThis) {
  const message = createTownPassMessage(name, data)

  const townPassBridge = host?.[TOWN_PASS_BRIDGE_NAME]
  if (typeof townPassBridge?.postMessage === 'function') {
    townPassBridge.postMessage(message)
    return { delivered: true, channel: 'town-pass', message }
  }

  const webkitHandler = host?.webkit?.messageHandlers?.cityApp
  if (typeof webkitHandler?.postMessage === 'function') {
    webkitHandler.postMessage(message)
    return { delivered: true, channel: 'webkit', message }
  }

  if (typeof host?.CityApp?.postMessage === 'function') {
    host.CityApp.postMessage(message)
    return { delivered: true, channel: 'android', message }
  }

  if (typeof host?.ReactNativeWebView?.postMessage === 'function') {
    host.ReactNativeWebView.postMessage(message)
    return { delivered: true, channel: 'react-native', message }
  }

  return { delivered: false, channel: 'browser', message }
}

export function subscribeToNativeMessages(listener, host = globalThis) {
  const townPassBridge = host?.[TOWN_PASS_BRIDGE_NAME]
  if (!townPassBridge || typeof listener !== 'function') return () => {}

  const handleMessage = (event) => {
    const parsed = parseTownPassMessage(event?.data)
    if (parsed) listener(parsed, event)
  }

  if (typeof townPassBridge.addEventListener === 'function') {
    townPassBridge.addEventListener('message', handleMessage)
    return () => townPassBridge.removeEventListener?.('message', handleMessage)
  }

  const previousHandler = townPassBridge.onmessage
  const combinedHandler = (event) => {
    if (typeof previousHandler === 'function') previousHandler.call(townPassBridge, event)
    handleMessage(event)
  }
  townPassBridge.onmessage = combinedHandler

  return () => {
    if (townPassBridge.onmessage === combinedHandler) {
      townPassBridge.onmessage = previousHandler ?? null
    }
  }
}
