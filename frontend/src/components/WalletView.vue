<script setup>
import AppIcon from './AppIcon.vue'

defineEmits(['navigate', 'native-action'])
</script>

<template>
  <section class="view simple-view" aria-labelledby="wallet-title">
    <header class="subpage-header">
      <span class="section-kicker">MY WALLET</span>
      <h1 id="wallet-title">我的票夾</h1>
      <p>收藏優惠票券與活動憑證。</p>
    </header>

    <div class="wallet-card">
      <div class="wallet-card__ticket"><AppIcon name="ticket" :size="34" /></div>
      <p>AVAILABLE TICKETS</p>
      <strong>0</strong>
      <span>目前沒有可使用的票券</span>
    </div>

    <div class="empty-state wallet-empty">
      <span class="empty-state__icon"><AppIcon name="wallet" :size="28" /></span>
      <h2>票夾還是空的</h2>
      <p>前往城市服務探索最新活動與場館票券。</p>
      <button type="button" @click="$emit('navigate', 'services')">探索城市服務</button>
    </div>
  </section>
</template>
