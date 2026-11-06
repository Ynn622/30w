import { describe, expect, it, vi } from 'vitest'
import {
  createTownPassMessage,
  getNativeChannel,
  parseTownPassMessage,
  sendToNative,
  subscribeToNativeMessages,
} from './webview.js'

describe('sendToNative', () => {
  it('falls back safely in a regular browser', () => {
    const result = sendToNative('open_service', { id: 'parking' }, {})

    expect(result.delivered).toBe(false)
    expect(result.channel).toBe('browser')
    expect(JSON.parse(result.message)).toEqual({
      name: 'open_service',
      data: { id: 'parking' },
    })
  })

  it('uses the TownPass flutterObject first', () => {
    const postMessage = vi.fn()
    const fallbackPostMessage = vi.fn()
    const host = {
      flutterObject: { postMessage },
      webkit: { messageHandlers: { cityApp: { postMessage: fallbackPostMessage } } },
    }

    const result = sendToNative('qr_code_scan', null, host)

    expect(result.channel).toBe('town-pass')
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith('{"name":"qr_code_scan","data":null}')
    expect(fallbackPostMessage).not.toHaveBeenCalled()
  })

  it('keeps the legacy WebKit bridge as a fallback', () => {
    const webkitPostMessage = vi.fn()
    const host = { webkit: { messageHandlers: { cityApp: { postMessage: webkitPostMessage } } } }
    const result = sendToNative('userinfo', null, host)

    expect(result.channel).toBe('webkit')
    expect(webkitPostMessage).toHaveBeenCalledWith('{"name":"userinfo","data":null}')
  })

  it('detects the TownPass bridge', () => {
    expect(getNativeChannel({ flutterObject: { postMessage: vi.fn() } })).toBe('town-pass')
    expect(getNativeChannel({})).toBe('browser')
  })
})

describe('TownPass message helpers', () => {
  it('creates the documented name and data envelope', () => {
    expect(createTownPassMessage('open_link', 'https://www.gov.taipei/'))
      .toBe('{"name":"open_link","data":"https://www.gov.taipei/"}')
  })

  it('parses valid messages and ignores invalid input', () => {
    expect(parseTownPassMessage('{"name":"location","data":{"latitude":25}}'))
      .toEqual({ name: 'location', data: { latitude: 25 } })
    expect(parseTownPassMessage('not-json')).toBeNull()
    expect(parseTownPassMessage('{"data":null}')).toBeNull()
  })

  it('subscribes to and removes the TownPass message listener', () => {
    const listeners = new Map()
    const flutterObject = {
      addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
      removeEventListener: vi.fn((name) => listeners.delete(name)),
    }
    const listener = vi.fn()

    const unsubscribe = subscribeToNativeMessages(listener, { flutterObject })
    listeners.get('message')({ data: '{"name":"qr_code_scan","data":"result"}' })

    expect(listener).toHaveBeenCalledWith(
      { name: 'qr_code_scan', data: 'result' },
      expect.any(Object),
    )

    unsubscribe()
    expect(flutterObject.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('falls back to onmessage when event listeners are unavailable', () => {
    const flutterObject = {}
    const listener = vi.fn()
    const unsubscribe = subscribeToNativeMessages(listener, { flutterObject })

    flutterObject.onmessage({ data: '{"name":"userinfo","data":null}' })
    expect(listener).toHaveBeenCalledWith({ name: 'userinfo', data: null }, expect.any(Object))

    unsubscribe()
    expect(flutterObject.onmessage).toBeNull()
  })
})
