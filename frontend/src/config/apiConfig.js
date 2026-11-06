// Vite 環境變數會在建置時寫入前端，僅放公開網址，不放密鑰。
const baseURL = (
  import.meta.env.VITE_API_BASE_URL || 'https://30wbackend.idfc.dev/api/v1'
).replace(/\/+$/, '')

export const apiConfig = Object.freeze({
  baseURL,
})

export default apiConfig
