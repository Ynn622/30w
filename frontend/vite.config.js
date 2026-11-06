import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export function resolveBasePath(repository, explicitBase) {
  if (explicitBase) {
    const normalized = explicitBase.startsWith('/') ? explicitBase : `/${explicitBase}`
    return normalized.endsWith('/') ? normalized : `${normalized}/`
  }

  const repositoryName = repository?.split('/').at(-1)

  if (!repositoryName || repositoryName.endsWith('.github.io')) {
    return '/'
  }

  return `/${repositoryName}/`
}

export default defineConfig({
  plugins: [vue()],
  base: process.env.GITHUB_ACTIONS
    ? resolveBasePath(process.env.GITHUB_REPOSITORY, process.env.VITE_BASE_PATH)
    : resolveBasePath(undefined, process.env.VITE_BASE_PATH),
  test: {
    environment: 'node',
  },
})
