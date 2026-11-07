<script setup>
import AppIcon from '../AppIcon.vue'
defineProps({ city: { type: Object, required: true } })
defineEmits(['select', 'explore', 'sources'])
const options = [{ key: 'noise', label: '減少聲音刺激', text: '只推薦聲音指數低且有近期資料的空間', icon: 'sound' }, { key: 'light', label: '喜歡柔和光線', text: '減少明亮、刺眼的環境', icon: 'sun' }, { key: 'crowd', label: '避開擁擠人潮', text: '優先尋找人潮較少的角落', icon: 'people' }, { key: 'odor', label: '避開明顯氣味', text: '只推薦氣味刺激低且有近期資料的空間', icon: 'wind' }, { key: 'indoor', label: '偏好室內空間', text: '探索可以進入的室內休息點', icon: 'home' }]
const sensitivities = [{ key: 'noise', label: '聲音', icon: 'sound' }, { key: 'light', label: '光線', icon: 'sun' }, { key: 'crowd', label: '人潮', icon: 'people' }, { key: 'odor', label: '氣味', icon: 'wind' }]
const levelWords = ['', '不太在意', '稍微在意', '普通', '在意', '非常在意']
</script>
<template>
  <section class="quiet-view profile-quiet-view"><header class="q-page-header"><h1>我的感官偏好</h1><p>選擇舒服的環境，收藏你的安靜角落。</p></header>
    <div class="profile-note"><div class="profile-leaf"><AppIcon name="leaf" :size="32"/></div><div><strong>你的專屬安靜指南</strong><p>不需要標籤，也不需要解釋。<br>選擇讓你舒服的環境就好。</p></div></div>
    <section class="q-settings-card"><div class="section-heading"><h2>我的感官偏好</h2><span>儲存在此裝置</span></div><label v-for="option in options" :key="option.key" class="q-setting-row"><span class="setting-icon"><AppIcon :name="option.icon" :size="22"/></span><span><strong>{{ option.label }}</strong><small>{{ option.text }}</small></span><input v-model="city.preferences.value[option.key]" class="q-switch" type="checkbox"/></label><label class="q-setting-row"><span class="setting-icon"><AppIcon name="route" :size="22"/></span><span><strong>最多探索距離</strong><small>以起點到場所的直線距離估算</small></span><select v-model.number="city.preferences.value.radius" aria-label="最多探索距離"><option :value="300">300 公尺</option><option :value="500">500 公尺</option><option :value="1000">1 公里</option></select></label></section>
    <section class="q-settings-card"><div class="section-heading"><h2>感官敏感度</h2><span>僅在此裝置計算</span></div>
      <p class="q-helper sensitivity-help">數字越大代表越在意，用於計算個人適配分數（SFS）並排序推薦；不會改變環境刺激指數，也不會上傳。</p>
      <div v-for="item in sensitivities" :key="item.key" class="sensitivity-row">
        <label :for="`sensitivity-${item.key}`"><span class="setting-icon"><AppIcon :name="item.icon" :size="20"/></span><strong>{{ item.label }}</strong><output :for="`sensitivity-${item.key}`">{{ city.preferences.value.sensitivities[item.key] }}／5 {{ levelWords[city.preferences.value.sensitivities[item.key]] }}</output></label>
        <input :id="`sensitivity-${item.key}`" v-model.number="city.preferences.value.sensitivities[item.key]" class="q-range" type="range" min="1" max="5" step="1" :aria-valuetext="`${city.preferences.value.sensitivities[item.key]}，${levelWords[city.preferences.value.sensitivities[item.key]]}`"/>
      </div>
    </section>
    <section class="q-settings-card"><div class="section-heading"><h2>介面</h2></div><label class="q-setting-row"><span class="setting-icon"><AppIcon name="layers" :size="22"/></span><span><strong>低刺激模式</strong><small>柔和配色、停止動畫、加大按鈕並隱藏裝飾；警示仍以文字顯示。</small></span><input v-model="city.preferences.value.lowStimulus" class="q-switch" type="checkbox"/></label></section>
    <section class="q-settings-card"><div class="section-heading"><h2>我的安靜角落</h2><span>{{ city.favorites.value.length }} 個收藏</span></div><div v-if="!city.favorites.value.length" class="favorite-empty"><AppIcon name="heart" :size="30"/><strong>把喜歡的安靜，留在這裡</strong><p>探索場所後，按下愛心就能收藏。</p><button class="q-text-button" @click="$emit('explore')">去找一個角落<AppIcon name="arrow" :size="16"/></button></div><div v-for="id in city.favorites.value" :key="id" class="favorite-row"><button @click="$emit('select', id)"><AppIcon name="leaf" :size="21"/><span>{{ city.places.data.value?.places?.find(place => place.id === id)?.name || '已收藏的安靜角落' }}<small>點選查看場所資訊</small></span><AppIcon name="chevron" :size="16"/></button><button class="q-icon-button" aria-label="移除此收藏" @click="city.toggleFavorite(id)"><AppIcon name="close" :size="17"/></button></div></section>
    <section class="q-settings-card"><div class="section-heading"><h2>隱私與資料</h2><AppIcon name="shield" :size="19"/></div><div class="privacy-copy"><strong>分享的每一步，都由你同意</strong><p>定位與麥克風各自取得授權。定位成功後，會把座標送到 OpenStreetMap 的 Nominatim 服務查詢地址，結果只留在本次使用的記憶體。完成量測後，還需要另外勾選同意，才會分享數值摘要。我們不要求疾病資料，也不保留原始錄音。</p><p>此裝置只保留偏好與收藏編號，不保留精確位置及量測結果。</p></div><button class="source-link" @click="$emit('sources')"><span><AppIcon name="layers" :size="18"/>資料來源與使用說明</span><AppIcon name="chevron" :size="17"/></button></section>
    <footer class="quiet-footer"><AppIcon name="wave" :size="18"/><span>城市靜音鍵・讓每一種感受，都有地方。</span></footer>
  </section>
</template>
