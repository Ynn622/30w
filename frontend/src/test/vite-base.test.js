import { describe, expect, it } from 'vitest'
import { resolveBasePath } from '../../vite.config.js'

describe('resolveBasePath', () => {
  it('uses root locally', () => {
    expect(resolveBasePath()).toBe('/')
  })

  it('uses the repository name for a project page', () => {
    expect(resolveBasePath('city-team/citizen-webview')).toBe('/citizen-webview/')
  })

  it('uses root for an owner GitHub Pages repository', () => {
    expect(resolveBasePath('city-team/city-team.github.io')).toBe('/')
  })

  it('normalizes an explicit base path', () => {
    expect(resolveBasePath('ignored/repository', 'preview')).toBe('/preview/')
    expect(resolveBasePath('ignored/repository', '/nested/path/')).toBe('/nested/path/')
  })
})
