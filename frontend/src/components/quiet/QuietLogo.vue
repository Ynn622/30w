<script setup>
// 聆靜主視覺標誌（開發者提供的設計圖，縮為 160px WebP 供 40px 顯示時在高解析度螢幕保持清晰）。
import logoUrl from '../../assets/logo.webp'
defineProps({ size: { type: Number, default: 40 } })
</script>

<template>
  <img class="quiet-logo" :src="logoUrl" :width="size" :height="size" alt="聆靜標誌" decoding="async" />
</template>

<style scoped>
.quiet-logo { flex-shrink: 0; display: block; border-radius: 27%; object-fit: cover; }
</style>
