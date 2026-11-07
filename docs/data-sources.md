# 聆靜資料與第三方來源

查核日期：2026-11-07。本次新增一個正式 npm 依賴 `maplibre-gl@6.16.0`；不新增外部字型、場所照片、LLM SDK 或商用地圖 SDK。

## 實際使用

| 項目 | 來源與授權 | 使用方式與可移轉性 |
| --- | --- | --- |
| MapLibre GL JS 6.16.0 | [原始碼／BSD-3-Clause](https://github.com/maplibre/maplibre-gl-js/blob/v6.16.0/LICENSE.txt) | npm 固定版本；隨 Vite 打包、延遲載入，worker 以 Vite URL 資產輸出，支援 Pages base。第三方聲明保留於 `frontend/public/third-party/maplibre-gl-LICENSE.txt` |
| OpenFreeMap Liberty | [OpenFreeMap styles 原始碼與授權](https://github.com/hyperknot/openfreemap-styles/blob/main/LICENSE.md)；repo MIT，Liberty code BSD-3-Clause，設計包含 CC BY 3.0／4.0 衍生條款 | 使用公開 `https://tiles.openfreemap.org/styles/liberty`，無 API key。保留原始版權與地圖 attribution |
| OpenMapTiles | [官方授權](https://github.com/openmaptiles/openmaptiles/blob/master/LICENSE.md)；code BSD-3-Clause，design CC BY 4.0 | 地圖角落保留 © OpenMapTiles 與連結 |
| OpenStreetMap | [ODbL 與 attribution](https://www.openstreetmap.org/copyright) | 使用經 OpenFreeMap 提供的向量圖資，地圖角落保留 © OpenStreetMap contributors |
| Liberty 內含字型／符號 | 同 OpenFreeMap styles LICENSE；Noto Sans 為 SIL OFL 1.1、Maki 圖示 CC0 | 由底圖公開服務載入，不將外部字型套用到本作品 UI；如自架需一起移轉 glyphs/sprites |
| 聆靜主視覺標誌（首頁 logo、favicon） | 開發者提供的設計圖（2026-11-07） | `frontend/src/assets/logo.webp`（160px）、`frontend/public/favicon.png`（64px）、`apple-touch-icon.png`（180px）由原圖縮製；非官方或第三方商標，隨專案交付 |
| UI 圖示、天際線、場所示意插畫 | 本次以 Vue 內嵌 SVG 原創繪製 | 隨專案原始碼交付；不使用官方商標、照片或不明素材 |
| 測試情境資料（remote-mock） | 後端 `test/mock/places`（Ynn622/30w#4），資料集 `taipei-sensory-mock-v1` | 僅在「我的 › 測試資料」切換後使用。60 個臺北設施代表點的人工情境推估與合成分數，非即時觀測；各場所引用的開放資料來源與授權由回應 `meta.sources` 提供並在詳情頁列出。照片僅大安森林公園、北投公園兩處，為 Wikimedia Commons 歷史影像（依各檔 CC 授權，畫面顯示作者、授權連結、來源與修改說明），經後端以同一路徑轉送，不代表推估子區域或目前狀況 |
| 感官天氣／回報／場所模擬資料 | `frontend/src/data/quietMock.js`，專案自製 | 僅在後端無法連線時使用，時間依目前時間往前推算；三區各 6 個場所、敏感圖層模擬格網 `frontend/src/data/mock-sensory-cells.json`（臺北市範圍內約 2.7 萬個不規則分布的模擬回報點，一般區域約 150m、熱區約 50m 一點，數值由固定亂數種子的隨機熱點與雜訊產生；由 `npm run mock:cells` 以 `frontend/scripts/generate-mock-cells.mjs` 產生，可手動修改）與概況。場所名稱、位置與描述皆為虛構，不宣稱真實設施，不用於導航；畫面以通知與「模擬」標示 |
| 臺北市里界（座標轉里） | [Taipei City Dashboard](https://github.com/taipei-doit/Taipei-City-Dashboard/blob/develop/Taipei-City-Dashboard-FE/public/mapData/taipei_village.geojson)（臺北市政府資訊局），[AGPL-3.0](https://github.com/taipei-doit/Taipei-City-Dashboard/blob/develop/LICENSE)；© Department of Information Technology, Taipei City Government | `frontend/src/data/taipei-villages.json`：456 里，只保留區名、里名、內政部村里代碼，邊界簡化約 3 公尺（`npm run geo:villages` 產生）。來源檔最後修改於 2024-01-30，repo 未載明原始圖資出處與版本；欄位格式與內政部村里界一致，正式上架前宜再與內政部國土測繪中心公開版本核對。只在裝置端判斷所在的里，不作為法定界線 |
| OpenStreetMap Nominatim（地址查詢） | [軟體 GPL-3.0](https://github.com/osm-search/Nominatim)；資料 [ODbL](https://www.openstreetmap.org/copyright)；公用伺服器遵守 [使用規範](https://operations.osmfoundation.org/policies/nominatim/) | `frontend/src/lib/reverseGeocode.js` 只在定位成功且位於臺北市時查一次，間隔至少 1.1 秒、約 11 公尺內記憶體快取、不定時輪詢；畫面標示 © OpenStreetMap contributors。座標會送到 OSMF 伺服器（開發者 2026-11-08 決定 App 內不列資料來源，目前未在畫面揭露）。公用伺服器可能隨時收回權限，正式交付建議改由後端轉送或自架 Nominatim，網址以 `VITE_GEOCODE_URL` 切換 |
| UI 字型 | 作業系統字型 stack | 不下載或重新散布第三方字型檔 |

OpenFreeMap 提供完整開源與自架方式，公開 instance 不需 key，沒有以商用免費額度冒充開源。[官方整合方式](https://openfreemap.org/quick_start/)與[公開服務說明](https://openfreemap.org/)。公開服務仍需網路，沒有 SLA 保證；正式可移轉交付若需自架，應包含 vector tiles、glyphs、sprites 與樣式來源，並保留所有授權。此版未實作離線地圖下載。

新地圖傳遞依賴中的 `@mapbox/jsonlint-lines-primitives@2.0.3` 要求 Node >=22，因此本專案統一 Node >=22.12，CI 同步 Node 22。25 個新增依賴的版本、宣告授權與原文清單保留在 `frontend/public/third-party/README.md`。

第三方授權原文隨靜態站的 `third-party/` 目錄交付：MapLibre LICENSE、OpenFreeMap styles LICENSE、上游 OSM Liberty LICENSE。底圖 attribution 使用 MapLibre 的非折疊 AttributionControl，不隱藏來源。

## 尚未接入的候選開放資料

需求單指定 CWA、MOENV、TDX 的候選資料集已整理在 [後端契約](backend-api.md#開放資料整合工作)。本版後端尚未提供感官接口，前端以自製模擬資料備援，沒有聲稱即時串接這些資料，也不在前端存 API key。正式資料接入前需確認該資料集的實際授權、更新頻率、地理涵蓋與欄位。

特別區分：噪音測站位置、歷史環境音量統計、陳情數均不能替代街道即時分貝。正式場所資料及可進入性來源尚待後端選定。

## 外部導航

`launch_map` 沿用官方 bridge 名稱，真實場所才可將 Google Maps 公開的步行路線連結（[Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)，`https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=walking`）交給原生 App；一般瀏覽器以新視窗開啟。2026-11-07 依開發者要求由 Apple Maps 改為 Google Maps；只是把連結交給 Google 地圖 App／網站開啟，不嵌入地圖、不安裝 Apple／Google 商用地圖 SDK、不需 API key，不在本站依賴外部導航服務提供核心感官資料。若正式作品要依賴某個導航服務、SDK 或新增路由 API，須依 AGENTS.md 再核對授權與競賽適用性。
