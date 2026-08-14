<script setup>
import { ArrowLeft, RefreshRight } from '@element-plus/icons-vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  backTo: {
    type: String,
    default: '/home',
  },
})

const route = useRoute()
const router = useRouter()
const pageRefreshKey = ref(0)
const refreshing = ref(false)
let refreshTimer = null

const pageTitle = computed(() => props.title || route.meta?.title || '详情')
const showPageRefresh = computed(() => route.name === 'match-detail')

const goBack = () => {
  router.push(props.backTo)
}

const refreshPage = () => {
  if (refreshing.value) return
  refreshing.value = true
  pageRefreshKey.value += 1
  refreshTimer = window.setTimeout(() => {
    refreshing.value = false
    refreshTimer = null
  }, 800)
}

onBeforeUnmount(() => {
  if (refreshTimer) window.clearTimeout(refreshTimer)
})
</script>

<template>
  <section class="subpage-layout">
    <header class="subpage-layout__header">
      <button class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <h1>{{ pageTitle }}</h1>
      <button
        v-if="showPageRefresh"
        class="refresh-btn"
        :class="{ 'is-refreshing': refreshing }"
        :disabled="refreshing"
        aria-label="刷新比赛详情"
        title="刷新比赛详情"
        @click="refreshPage"
      >
        <el-icon><RefreshRight /></el-icon>
      </button>
      <span v-else class="placeholder"></span>
    </header>

    <slot name="subnav" />

    <main class="subpage-layout__main">
      <slot>
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="`${route.fullPath}-${pageRefreshKey}`" />
        </RouterView>
      </slot>
    </main>
  </section>
</template>

<style scoped>
.subpage-layout {
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% 0%, rgba(93, 122, 247, 0.13), transparent 30%),
    radial-gradient(circle at 100% 18%, rgba(126, 96, 226, 0.1), transparent 28%),
    #f5f7fb;
}

.subpage-layout__header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 38px 1fr 38px;
  align-items: center;
  gap: 8px;
  min-height: 58px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.86);
  border-bottom: 1px solid rgba(125, 139, 165, 0.12);
  box-shadow: 0 8px 24px rgba(47, 65, 105, 0.06);
  backdrop-filter: blur(16px);
}

.subpage-layout__header h1 {
  margin: 0;
  text-align: center;
  color: #1f2937;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.back-btn,
.refresh-btn {
  width: 34px;
  height: 34px;
  border: 1px solid rgba(117, 131, 158, 0.14);
  border-radius: 11px;
  background: rgba(245, 247, 252, 0.9);
  color: #4b5568;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn {
  justify-self: end;
  color: var(--app-primary);
  cursor: pointer;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.refresh-btn:active {
  transform: scale(0.92);
}

.refresh-btn:disabled {
  cursor: default;
  opacity: 0.72;
}

.refresh-btn.is-refreshing .el-icon {
  animation: page-refresh-rotate 0.8s ease-in-out;
}

.placeholder {
  width: 36px;
  height: 36px;
}

.subpage-layout__main {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: 16px 14px calc(28px + env(safe-area-inset-bottom));
}

@keyframes page-refresh-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .refresh-btn,
  .refresh-btn.is-refreshing .el-icon {
    animation-duration: 0.01ms;
    transition-duration: 0.01ms;
  }
}
</style>
