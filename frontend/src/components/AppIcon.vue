<script setup>
const paths = {
  sound: ['M11 4 6 8H3v8h3l5 4Z', 'M15 8a6 6 0 0 1 0 8', 'M18 5a10 10 0 0 1 0 14'],
  sun: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'],
  people: ['M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M20 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M1 21v-3a6 6 0 0 1 12 0v3m2-7a5 5 0 0 1 8 4v3'],
  leaf: ['M20 3C10 2 3 6 4 13s14 11 16-10Z', 'M3 22 16 9'],
  wind: ['M2 8h13a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M2 17h7a3 3 0 1 1-3 3'],
  plus: ['M12 4v16M4 12h16'],
  map: ['m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16m6-14v16'],
  pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  locate: ['M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0', 'M12 2v4m0 12v4M2 12h4m12 0h4', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0'],
  back: ['M20 12H4m7-7-7 7 7 7'],
  close: ['m6 6 12 12M18 6 6 18'],
  check: ['m4 12 5 5L20 6'],
  share: ['M16 7 8 11m0 3 8 4', 'M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  route: ['M5 19h.01M19 5h.01', 'M8 19h9a4 4 0 0 0 0-8H7a4 4 0 0 1 0-8h9', 'M8 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  sliders: ['M4 4v5m0 4v7M12 4v10m0 4v2M20 4v2m0 4v10M1 9h6m2 5h6m2-8h6'],
  wave: ['M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4'],
  cloud: ['M7 18h12a4 4 0 0 0 0-8h-1A7 7 0 0 0 4 9a4.5 4.5 0 0 0 3 9'],
  layers: ['m12 2 10 5-10 5L2 7Zm-10 10 10 5 10-5M2 17l10 5 10-5'],
  arrow: ['M4 12h16m-7-7 7 7-7 7'],
}
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 24 },
  strokeWidth: { type: Number, default: 1.9 },
})
</script>

<template>
  <svg
    class="app-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'home'">
      <path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" />
    </template>
    <template v-else-if="name === 'grid'">
      <rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" />
    </template>
    <template v-else-if="name === 'wallet'">
      <path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12" /><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" />
    </template>
    <template v-else-if="name === 'user'">
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </template>
    <template v-else-if="name === 'bell'">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" />
    </template>
    <template v-else-if="name === 'scan'">
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" />
    </template>
    <template v-else-if="name === 'ticket'">
      <path d="M3 8V5h18v3a3 3 0 0 0 0 6v3H3v-3a3 3 0 0 0 0-6Z" /><path d="M13 7v2M13 13v2" />
    </template>
    <template v-else-if="name === 'receipt'">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </template>
    <template v-else-if="name === 'car'">
      <path d="m5 11 2-5h10l2 5" /><path d="M4 11h16v6H4zM6 17v2M18 17v2" /><circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" /><circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'bus'">
      <rect x="5" y="3" width="14" height="16" rx="3" /><path d="M5 11h14M8 7h8M8 19v2M16 19v2" /><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'calendar'">
      <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
    </template>
    <template v-else-if="name === 'message'">
      <path d="M21 12a8 8 0 0 1-9 8 9 9 0 0 1-4-.9L3 21l1.6-4A8 8 0 1 1 21 12Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" />
    </template>
    <template v-else-if="name === 'heart'">
      <path d="M20.8 5.8a5.4 5.4 0 0 0-7.6 0L12 7l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 22l8.8-8.6a5.4 5.4 0 0 0 0-7.6Z" />
    </template>
    <template v-else-if="name === 'recycle'">
      <path d="m8 4 2-2 2 3M10 2l3 5h3M19 10l3 1-1 3M22 11l-3 5-2 3M10 20l-1 3-3-2M9 23l-3-5 2-3" />
    </template>
    <template v-else-if="name === 'book'">
      <path d="M4 19a3 3 0 0 1 3-3h13V4H7a3 3 0 0 0-3 3Z" /><path d="M4 7v12a2 2 0 0 0 2 2h14" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
    </template>
    <template v-else-if="name === 'chevron'">
      <path d="m9 18 6-6-6-6" />
    </template>
    <template v-else-if="name === 'shield'">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </template>
    <template v-else-if="paths[name]">
      <path v-for="(d, index) in paths[name]" :key="index" :d="d" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
    </template>
  </svg>
</template>
