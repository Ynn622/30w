<script setup>
import { useId } from 'vue'
defineProps({ kind: { type: String, default: 'library' } })
const id = useId()
</script>
<template>
  <svg class="place-artwork" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" role="img" :aria-label="`${kind === 'park' ? '綠蔭公園' : '閱讀空間'}原創示意插畫，非實景`">
    <defs><linearGradient :id="id" x2="0.8" y2="1"><stop stop-color="#e6f0e3"/><stop offset="1" stop-color="#b8d6c5"/></linearGradient></defs>
    <rect width="400" height="240" :fill="`url(#${id})`"/>
    <template v-if="kind === 'park'">
      <path d="M0 150Q110 110 210 151T400 145V240H0Z" fill="#a5c7a4"/><path d="M195 148q-40 40-10 92h90q-70-58-49-92" fill="#eee9d6"/>
      <g v-for="(x,i) in [30,100,305,380]" :key="x" :transform="`translate(${x},${i % 2 ? 0 : 17})`"><path d="M0 70v108" stroke="#74846c" stroke-width="9"/><ellipse cy="64" rx="57" ry="65" :fill="i % 2 ? '#6d9b83' : '#80ae91'"/><ellipse cx="-12" cy="40" rx="37" ry="39" fill="#94bba0"/></g>
      <g transform="translate(245 166)"><path d="M0 0h73v10H0Zm4-25h65v19H4Z" fill="#b78c66"/><path d="M8 8v24m56-24v24" stroke="#627d70" stroke-width="5"/></g>
      <circle cx="210" cy="46" r="22" fill="#fff9db" opacity=".7"/>
    </template>
    <template v-else>
      <path d="M0 0h400v173H0" fill="#e4ddcd"/><path d="m0 173 400 0v67H0Z" fill="#d1bda2"/>
      <path d="M235 21h142v139H235Z" fill="#a1bca6"/><path d="M246 30h120v120H246Z" fill="#d6e5cb"/><path d="M307 25v132m-69-66h139" stroke="#faf6eb" stroke-width="7"/>
      <path d="M15 25h190v138H15Z" fill="#9a927d"/>
      <g v-for="y in [35,75,115]" :key="y"><path :d="`M25 ${y+29}h170`" stroke="#d2c1a1" stroke-width="6"/><path v-for="(x,i) in [30,47,63,81,98,118,136,155,174]" :key="x" :d="`M${x} ${y}v25`" :stroke="['#ebd7b0','#b1c4ac','#9eb7b2','#d3b99d'][i%4]" :stroke-width="i%3+10"/></g>
      <path d="m98 186 184-12 39 21-187 16Z" fill="#f1e5ca"/><path d="m134 211 1 29m176-44v44m-198-49v32" stroke="#9f8f75" stroke-width="6"/>
      <g v-for="x in [70,244,339]" :key="x"><path :d="`M${x} 195v-30h28v34m-28 0h32m-28 0v30m25-30v28`" fill="#70998a" stroke="#668c7e" stroke-width="5"/></g>
      <path d="M358 141v45" stroke="#87a18a" stroke-width="5"/><path d="M358 157q-45-28-20-48 30 4 20 48 2-49 23-46 20 20-23 46" fill="#86a48b"/><path d="M342 179h32l-5 22h-22Z" fill="#e7dbc2"/>
    </template>
  </svg>
</template>
