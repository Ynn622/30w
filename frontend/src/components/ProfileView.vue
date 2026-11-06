<script setup>
import AppIcon from './AppIcon.vue'
import NativeMethodsPanel from './NativeMethodsPanel.vue'

defineProps({ bridgeLabel: { type: String, required: true } })
defineEmits(['native-action'])

const settings = [
  { id: 'identity', label: '身分與卡證', detail: '示範會員', icon: 'shield' },
  { id: 'notifications', label: '通知設定', detail: '重要消息', icon: 'bell' },
  { id: 'settings', label: '應用程式設定', detail: '', icon: 'settings' },
]
</script>

<template>
  <section class="view simple-view" aria-labelledby="profile-title">
    <header class="subpage-header">
      <span class="section-kicker">MY CITYLINK</span>
      <h1 id="profile-title">我的</h1>
      <p>管理個人服務與 WebView 連線。</p>
    </header>

    <article class="profile-card">
      <span class="profile-avatar">市</span>
      <div><strong>市民朋友</strong><span>DEMO MEMBER · CL1106</span></div>
      <button type="button" aria-label="編輯個人資料" @click="$emit('native-action', 'edit-profile')"><AppIcon name="chevron" :size="19" /></button>
    </article>

    <div class="bridge-status">
      <span class="status-dot"></span>
      <div><strong>WebView 連線狀態</strong><small>{{ bridgeLabel }}</small></div>
    </div>

    <div class="settings-list">
      <button v-for="item in settings" :key="item.id" type="button" @click="$emit('native-action', item.id)">
        <span class="settings-icon"><AppIcon :name="item.icon" :size="21" /></span>
        <span><strong>{{ item.label }}</strong><small v-if="item.detail">{{ item.detail }}</small></span>
        <AppIcon name="chevron" :size="18" />
      </button>
    </div>

    <NativeMethodsPanel />

    <p class="version-label">CityLink WebView Demo · v0.1.0</p>
  </section>
</template>
