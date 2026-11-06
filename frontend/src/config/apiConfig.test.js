import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('uses the configured API prefix for hello and the server root for health', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api/v1///')
  const { apiConfig } = await import('./apiConfig.js')

  expect(apiConfig.baseURL).toBe('https://example.com/api/v1')
  expect(apiConfig.endpoints.hello).toBe('https://example.com/api/v1/hello')
  expect(apiConfig.endpoints.health).toBe('https://example.com/health')
})
