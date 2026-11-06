// Vite 環境變數會在建置時寫入前端，僅放公開網址，不放密鑰。
const baseURL = (
  import.meta.env.VITE_API_BASE_URL || 'https://30wbackend.idfc.dev/api/v1'
).replace(/\/+$/, '')

export const apiConfig = Object.freeze({
  baseURL,
  endpoints: Object.freeze({
    hello: `${baseURL}/hello`,
    // health 位於伺服器根目錄，不在 /api/v1 下。
    health: new URL('/health', baseURL).href,
  }),
})

export default apiConfig
