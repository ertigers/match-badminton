<script setup>
import { computed } from 'vue'
import { House, User } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => (route.path.startsWith('/mine') ? 'mine' : 'home'))

const onTabChange = (value) => {
  if (value === activeTab.value) return
  router.push(value === 'home' ? '/home' : '/mine')
}
</script>

<template>
  <div class="mobile-layout">
    <main class="mobile-layout__content">
      <RouterView />
    </main>

    <nav class="mobile-layout__tabbar">
      <button
        class="mobile-tab"
        :class="{ 'mobile-tab--active': activeTab === 'home' }"
        @click="onTabChange('home')"
      >
        <el-icon class="mobile-tab__icon"><House /></el-icon>
        <span>首页</span>
      </button>
      <button
        class="mobile-tab"
        :class="{ 'mobile-tab--active': activeTab === 'mine' }"
        @click="onTabChange('mine')"
      >
        <el-icon class="mobile-tab__icon"><User /></el-icon>
        <span>我的</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.mobile-layout {
  min-height: 100vh;
  background: #f4f6fa;
}

.mobile-layout__content {
  padding-bottom: 72px;
}

.mobile-layout__tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #edf0f5;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.mobile-tab {
  position: relative;
  border: none;
  background: transparent;
  border-radius: 0;
  padding: 6px 0 8px;
  font-size: 12px;
  color: #8b9098;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: color 0.2s ease;
}

.mobile-tab::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  width: 18px;
  height: 3px;
  border-radius: 999px;
  transform: translateX(-50%) scaleX(0);
  transform-origin: center;
  background: #409eff;
  transition: transform 0.2s ease;
}

.mobile-tab__icon {
  font-size: 19px;
}

.mobile-tab--active {
  color: #409eff;
  font-weight: 600;
}

.mobile-tab--active::after {
  transform: translateX(-50%) scaleX(1);
}
</style>
