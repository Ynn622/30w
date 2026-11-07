<script setup>
// 首頁右上角的臺北 101 插畫（專案自繪 SVG，非官方圖片）。
// 動態刻意放慢放輕：雲幾乎察覺不到地飄、塔頂燈與單圈聆聽聲波緩慢呼吸、窗燈偶爾微亮；
// 系統「減少動態」或低刺激模式時全部停止（低刺激模式另由全域樣式隱藏插畫）。
const SEGMENTS = Array.from({ length: 8 }, (_, index) => {
  const bottom = 88 - index * 7
  return { bottom, top: bottom - 7 }
})
const WINDOWS = [
  { x: 10, y: 94, delay: 0 }, { x: 16, y: 102, delay: 3.5 }, { x: 27, y: 90, delay: 6.5 },
  { x: 110, y: 98, delay: 2 }, { x: 117, y: 90, delay: 5 }, { x: 126, y: 102, delay: 8 },
]
</script>

<template>
  <svg class="city-illustration taipei-101" viewBox="0 0 140 120" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="t101-face" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#8dd5e0" />
        <stop offset=".5" stop-color="#2eabbe" />
        <stop offset=".5" stop-color="#1494a8" />
        <stop offset="1" stop-color="#0b7888" />
      </linearGradient>
      <radialGradient id="t101-sky" cx=".5" cy=".55" r=".55">
        <stop offset="0" stop-color="#e6f6fa" />
        <stop offset="1" stop-color="#f6fcfd" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- 天空與太陽 -->
    <ellipse cx="70" cy="62" rx="68" ry="54" fill="url(#t101-sky)" />
    <circle class="t101-sun" cx="110" cy="24" r="8" fill="#ffe4a8" />

    <!-- 緩慢飄移的雲 -->
    <path class="t101-cloud t101-cloud-a" d="M14 36h21a5 5 0 0 0 0-10h-1.5a7 7 0 0 0-13-2.4A6 6 0 0 0 14 36Z" fill="#ffffff" />
    <path class="t101-cloud t101-cloud-b" d="M98 46h16a4 4 0 0 0 0-8h-1a5.5 5.5 0 0 0-10-2 4.6 4.6 0 0 0-5 10Z" fill="#ffffff" opacity=".9" />

    <!-- 遠景山與低樓 -->
    <path d="M0 112c12-13 26-19 40-17 10 1 16 6 22 9v8Z" fill="#e2f2f6" />
    <path d="M78 112c9-9 23-15 38-13 10 1 18 5 24 9v4Z" fill="#e2f2f6" />
    <path d="M4 112V88h13v24Zm15 0V83h14v29Zm14 0V96h9v16Zm65 0V98h9v14Zm11 0V84h14v28Zm16 0V93h11v19Z" fill="#bfe4eb" />
    <rect v-for="(item, index) in WINDOWS" :key="index" class="t101-window" :x="item.x" :y="item.y" width="3" height="3" rx=".6" fill="#ffffff" :style="{ animationDelay: `${item.delay}s` }" />

    <!-- 聆聽聲波：自塔尖緩慢向外擴散 -->
    <circle class="t101-wave" cx="70" cy="9" r="6" stroke="#0391A7" stroke-width="1" />

    <!-- 臺北 101 -->
    <g class="t101-tower">
      <path d="M70 5v15" stroke="#0b7888" stroke-width="1.5" stroke-linecap="round" />
      <path d="M67 24h6l1-4h-8Z" fill="url(#t101-face)" />
      <path d="M63 32h14l-2-8H65Z" fill="url(#t101-face)" />
      <path d="M63 32h14" stroke="#e8f8fb" stroke-opacity=".7" stroke-width=".8" />
      <g v-for="segment in SEGMENTS" :key="segment.bottom">
        <path :d="`M60.5 ${segment.bottom}h19l3-7h-25Z`" fill="url(#t101-face)" />
        <path :d="`M57.5 ${segment.top}h25`" stroke="#e8f8fb" stroke-opacity=".75" stroke-width=".8" />
        <path :d="`M62 ${segment.bottom - 2.6}h16`" stroke="#e8f8fb" stroke-opacity=".28" stroke-width=".6" />
      </g>
      <path d="M52 112h36l-7-24H59Z" fill="url(#t101-face)" />
      <path d="M59 88h22" stroke="#e8f8fb" stroke-opacity=".75" stroke-width=".8" />
      <!-- 基座如意圓紋 -->
      <circle cx="70" cy="98" r="3.4" stroke="#e8f8fb" stroke-opacity=".85" stroke-width="1" />
      <circle cx="70" cy="98" r="1.2" fill="#e8f8fb" fill-opacity=".85" />
      <circle class="t101-beacon" cx="70" cy="5.5" r="1.6" fill="#f59c80" />
    </g>

    <!-- 地面與行道樹 -->
    <path d="M2 112h136" stroke="#b9e0e7" stroke-width="2" stroke-linecap="round" />
    <g fill="#a6d9bd">
      <circle cx="45" cy="107" r="5" /><circle cx="50" cy="109" r="3.5" />
      <circle cx="94" cy="107.5" r="4.5" /><circle cx="90" cy="109.5" r="3" />
    </g>
  </svg>
</template>

<style scoped>
.taipei-101 { overflow: visible; }
.taipei-101 :is(.t101-tower, .t101-cloud, .t101-wave, .t101-sun) { transform-box: fill-box; transform-origin: center; }
.t101-tower { transform-origin: 50% 100%; animation: t101-rise 1.4s cubic-bezier(.2, .7, .2, 1) both; }
.t101-cloud-a { animation: t101-drift 30s ease-in-out infinite alternate; }
.t101-cloud-b { animation: t101-drift 36s ease-in-out -12s infinite alternate-reverse; }
.t101-sun { animation: t101-glow 10s ease-in-out infinite; }
.t101-beacon { animation: t101-blink 6s ease-in-out infinite; }
.t101-wave { opacity: 0; animation: t101-wave 8s ease-out infinite; }
.t101-window { opacity: .4; animation: t101-twinkle 10s ease-in-out infinite; }
@keyframes t101-rise { from { opacity: 0; transform: translateY(4px); } }
@keyframes t101-drift { from { transform: translateX(-3px); } to { transform: translateX(3px); } }
@keyframes t101-glow { 50% { opacity: .82; } }
@keyframes t101-blink { 0%, 100% { opacity: .95; } 50% { opacity: .5; } }
@keyframes t101-wave { 0% { opacity: .3; transform: scale(.5); } 60%, 100% { opacity: 0; transform: scale(2.2); } }
@keyframes t101-twinkle { 0%, 100% { opacity: .4; } 45%, 55% { opacity: .8; } }
@media (prefers-reduced-motion: reduce) {
  .taipei-101 * { animation: none !important; }
}
</style>
