<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BottomNav from './components/BottomNav.vue'
import HomeView from './components/HomeView.vue'
import ProfileView from './components/ProfileView.vue'
import ServicesView from './components/ServicesView.vue'
import WalletView from './components/WalletView.vue'
import { serviceCategories, serviceItems } from './data/services.js'
import { getNativeChannel, sendToNative, subscribeToNativeMessages } from './lib/webview.js'

const activeTab = ref('home')
const toastMessage = ref('')
const bridgeChannel = ref(getNativeChannel(window))
let toastTimer
let unsubscribeFromNative = () => {}

const dateLabel = computed(() => new Intl.DateTimeFormat('zh-TW', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
}).format(new Date()))

const bridgeLabel = computed(() => {
  const labels = {
    'town-pass': '已連接城市通 flutterObject',
    webkit: '已連接 iOS WebKit',
    android: '已連接 Android CityApp',
    'react-native': '已連接 React Native WebView',
    browser: '瀏覽器示範模式',
  }
  return labels[bridgeChannel.value]
})

onMounted(() => {
  bridgeChannel.value = getNativeChannel(window)
  unsubscribeFromNative = subscribeToNativeMessages(handleNativeReply, window)
})

onUnmounted(() => {
  unsubscribeFromNative()
  window.clearTimeout(toastTimer)
})

function navigate(tab) {
  activeTab.value = tab
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function showToast(message) {
  window.clearTimeout(toastTimer)
  toastMessage.value = message
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 2600)
}

function handleService(service) {
  if (!service) return

  // open_service 是本專案的自訂 handler，App 端需依城市通文件註冊同名 handler。
  const result = sendToNative('open_service', {
    id: service.id,
    title: service.title,
    category: service.category,
  })

  bridgeChannel.value = result.channel
  showToast(result.delivered ? `正在開啟「${service.title}」` : `示範模式：已選擇「${service.title}」`)
}

function handleNativeAction(action) {
  const townPassCommands = {
    scanner: { name: 'qr_code_scan', data: null },
    'member-card': { name: 'userinfo', data: null },
    identity: { name: 'userinfo', data: null },
  }
  const command = townPassCommands[action] ?? {
    name: 'native_action',
    data: { action },
  }
  const result = sendToNative(command.name, command.data)
  bridgeChannel.value = result.channel

  const labels = {
    scanner: '掃描器',
    'case-status': '申辦進度',
    notifications: '通知中心',
    'member-card': '市民卡',
    'edit-profile': '個人資料',
    identity: '身分與卡證',
    settings: '應用程式設定',
  }
  showToast(result.delivered ? `已請原生 App 開啟${labels[action] ?? '功能'}` : `${labels[action] ?? '此功能'}將由原生 App 提供`)
}

function handleNativeReply({ name, data }) {
  if (name === 'qr_code_scan') {
    showToast(data ? `掃描完成：${data}` : '已取消掃描')
    return
  }

  if (name === 'userinfo') {
    showToast(data ? '已取得城市通會員資料' : '未取得會員資料')
    return
  }

  showToast(`已收到 App 回覆：${name}`)
}
</script>

<template>
  <main class="app-shell">
    <Transition name="page" mode="out-in">
      <HomeView
        v-if="activeTab === 'home'"
        key="home"
        :services="serviceItems"
        :date-label="dateLabel"
        @select-service="handleService"
        @native-action="handleNativeAction"
        @navigate="navigate"
      />
      <ServicesView
        v-else-if="activeTab === 'services'"
        key="services"
        :services="serviceItems"
        :categories="serviceCategories"
        @select-service="handleService"
      />
      <WalletView
        v-else-if="activeTab === 'wallet'"
        key="wallet"
        @native-action="handleNativeAction"
        @navigate="navigate"
      />
      <ProfileView
        v-else
        key="profile"
        :bridge-label="bridgeLabel"
        @native-action="handleNativeAction"
      />
    </Transition>

    <BottomNav :active-tab="activeTab" @navigate="navigate" />

    <Transition name="toast">
      <div v-if="toastMessage" class="toast" role="status" aria-live="polite">{{ toastMessage }}</div>
    </Transition>
  </main>
</template>
