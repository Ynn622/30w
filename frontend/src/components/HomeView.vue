<script setup>
import AppIcon from './AppIcon.vue'

const props = defineProps({
  services: { type: Array, required: true },
  dateLabel: { type: String, required: true },
})

const emit = defineEmits(['select-service', 'navigate', 'native-action'])

const quickActions = [
  { label: '掃描服務碼', icon: 'scan', action: 'scanner' },
  { label: '我的票券', icon: 'ticket', tab: 'wallet' },
  { label: '生活繳費', icon: 'receipt', serviceId: 'bills' },
  { label: '申辦進度', icon: 'clock', action: 'case-status' },
]

function runQuickAction(action) {
  if (action.tab) {
    emit('navigate', action.tab)
    return
  }

  if (action.serviceId) {
    emit('select-service', props.services.find((service) => service.id === action.serviceId))
    return
  }

  emit('native-action', action.action)
}
</script>

<template>
  <section class="view home-view" aria-labelledby="home-title">
    <header class="home-header">
      <div class="brand-mark" aria-label="CityLink 城市通">
        <span class="brand-symbol">C</span>
        <span><strong>CITYLINK</strong><small>城市通</small></span>
      </div>
      <button class="icon-button notification-button" type="button" aria-label="查看通知" @click="$emit('native-action', 'notifications')">
        <AppIcon name="bell" :size="22" />
        <span class="notification-dot" aria-hidden="true"></span>
      </button>
    </header>

    <div class="welcome-copy">
      <p>{{ dateLabel }}</p>
      <h1 id="home-title">早安，市民朋友</h1>
    </div>

    <article class="citizen-card" aria-label="示範市民卡">
      <div class="card-orb card-orb-one"></div>
      <div class="card-orb card-orb-two"></div>
      <div class="citizen-card__top">
        <div>
          <span class="eyebrow">DIGITAL CITIZEN CARD</span>
          <strong>城市生活卡</strong>
        </div>
        <span class="demo-badge">DEMO</span>
      </div>
      <div class="citizen-card__bottom">
        <div>
          <span>會員編號</span>
          <strong>CL · 2026 · 1106</strong>
        </div>
        <button type="button" class="card-code" aria-label="開啟我的市民卡" @click="$emit('native-action', 'member-card')">
          <span></span><span></span><span></span><span></span>
        </button>
      </div>
    </article>

    <div class="quick-actions" aria-label="快捷功能">
      <button v-for="action in quickActions" :key="action.label" type="button" @click="runQuickAction(action)">
        <span class="quick-icon"><AppIcon :name="action.icon" :size="23" /></span>
        <span>{{ action.label }}</span>
      </button>
    </div>

    <button class="announcement-card" type="button" @click="$emit('select-service', services.find((service) => service.id === 'recycle'))">
      <span class="announcement-tag">NEW</span>
      <span class="announcement-copy"><strong>垃圾清運即時查詢</strong><small>快速查看附近清運點與預估到達時間</small></span>
      <AppIcon name="chevron" :size="19" />
    </button>

    <div class="section-heading">
      <div><span class="section-kicker">DAILY SERVICES</span><h2>常用服務</h2></div>
      <button type="button" @click="$emit('navigate', 'services')">查看全部</button>
    </div>

    <div class="service-grid">
      <button v-for="service in services.slice(0, 4)" :key="service.id" class="service-tile" type="button" @click="$emit('select-service', service)">
        <span class="service-icon" :class="`tone-${service.tone}`"><AppIcon :name="service.icon" :size="25" /></span>
        <span class="service-tile__copy"><strong>{{ service.title }}</strong><small>{{ service.category }}</small></span>
        <AppIcon class="service-chevron" name="chevron" :size="17" />
      </button>
    </div>
  </section>
</template>
