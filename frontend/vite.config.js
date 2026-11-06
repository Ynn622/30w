import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const buildTime = new Date().toISOString()
const appVersion = `${buildTime}-${process.env.GITHUB_SHA?.slice(0, 7) || 'local'}`

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
  server: {
    port: 7890,
    strictPort: true,
  },
  plugins: [vue(), {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: appVersion, buildTime }, null, 2),
      })
    },
  }],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  base: process.env.GITHUB_ACTIONS
    ? resolveBasePath(process.env.GITHUB_REPOSITORY, process.env.VITE_BASE_PATH)
    : resolveBasePath(undefined, process.env.VITE_BASE_PATH),
  test: {
    environment: 'node',
  },
})
