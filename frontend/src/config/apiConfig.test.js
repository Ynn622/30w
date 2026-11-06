import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('normalizes the configured API base URL', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api/v1///')
  const { apiConfig } = await import('./apiConfig.js')

  expect(apiConfig.baseURL).toBe('https://example.com/api/v1')
})
