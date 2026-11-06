<script setup>
import { computed, ref } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  services: { type: Array, required: true },
  categories: { type: Array, required: true },
})

defineEmits(['select-service'])

const query = ref('')
const activeCategory = ref('全部')

const filteredServices = computed(() => {
  const normalizedQuery = query.value.trim().toLocaleLowerCase('zh-Hant')

  return props.services.filter((service) => {
    const matchesCategory = activeCategory.value === '全部' || service.category === activeCategory.value
    const searchable = `${service.title} ${service.description} ${service.category}`.toLocaleLowerCase('zh-Hant')
    return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery))
  })
})

function clearFilters() {
  query.value = ''
  activeCategory.value = '全部'
}
</script>

<template>
  <section class="view services-view" aria-labelledby="services-title">
    <header class="subpage-header">
      <span class="section-kicker">CITY SERVICES</span>
      <h1 id="services-title">探索城市服務</h1>
      <p>從日常繳費到場館預約，都從這裡開始。</p>
    </header>

    <label class="search-box">
      <AppIcon name="search" :size="21" />
      <span class="sr-only">搜尋服務</span>
      <input v-model="query" type="search" placeholder="搜尋服務，例如：停車" autocomplete="off" />
    </label>

    <div class="category-scroller" aria-label="服務分類">
      <button
        v-for="category in categories"
        :key="category"
        type="button"
        :class="{ active: activeCategory === category }"
        @click="activeCategory = category"
      >
        {{ category }}
      </button>
    </div>

    <div v-if="filteredServices.length" class="service-list">
      <button v-for="service in filteredServices" :key="service.id" type="button" @click="$emit('select-service', service)">
        <span class="service-icon" :class="`tone-${service.tone}`"><AppIcon :name="service.icon" :size="25" /></span>
        <span class="service-list__copy"><strong>{{ service.title }}</strong><small>{{ service.description }}</small></span>
        <AppIcon name="chevron" :size="18" />
      </button>
    </div>

    <div v-else class="empty-state">
      <span class="empty-state__icon"><AppIcon name="search" :size="28" /></span>
      <h2>找不到符合的服務</h2>
      <p>換個關鍵字，或清除分類後再看看。</p>
      <button type="button" @click="clearFilters">清除搜尋條件</button>
    </div>
  </section>
</template>
