<script setup>
// 聆靜原創標誌：喇叭與逐漸變淡的聲波，代表把城市的聲音調小；不使用官方商標或外部素材。
defineProps({ size: { type: Number, default: 40 } })
</script>

<template>
  <svg class="quiet-logo" :width="size" :height="size" viewBox="0 0 48 48" role="img" aria-label="聆靜標誌">
    <rect width="48" height="48" rx="13" fill="#0391A7" />
    <path d="M9 41V34h4v-4h5v11Zm21 0V31h4v3h5v7Z" fill="#7fd0dc" />
    <path d="M12 17h5l7-6v19l-7-6h-5Z" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M28.5 16.5a6 6 0 0 1 0 9" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />
    <path d="M32.5 13a11 11 0 0 1 0 16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45" />
  </svg>
</template>

<style scoped>
.quiet-logo { flex-shrink: 0; display: block; }
</style>
