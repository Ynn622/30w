<script setup>
import AppIcon from './AppIcon.vue'

defineProps({ activeTab: { type: String, required: true } })
defineEmits(['navigate'])

const items = [
  { id: 'home', label: '首頁', icon: 'home' },
  { id: 'services', label: '服務', icon: 'grid' },
  { id: 'wallet', label: '票夾', icon: 'wallet' },
  { id: 'api', label: 'API 測試', icon: 'message' },
  { id: 'profile', label: '我的', icon: 'user' },
]
</script>

<template>
  <nav class="bottom-nav" aria-label="主要導覽">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      :class="{ active: activeTab === item.id }"
      :aria-current="activeTab === item.id ? 'page' : undefined"
      @click="$emit('navigate', item.id)"
    >
      <span class="nav-icon"><AppIcon :name="item.icon" :size="22" /></span>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>
