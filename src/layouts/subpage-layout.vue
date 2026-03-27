<script setup>
import { ArrowLeft } from '@element-plus/icons-vue'
import { computed } from 'vue'
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

const pageTitle = computed(() => props.title || route.meta?.title || '详情')

const goBack = () => {
  router.push(props.backTo)
}
</script>

<template>
  <section class="subpage-layout">
    <header class="subpage-layout__header">
      <button class="back-btn" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <h1>{{ pageTitle }}</h1>
      <span class="placeholder"></span>
    </header>

    <slot name="subnav" />

    <main class="subpage-layout__main">
      <slot>
        <RouterView />
      </slot>
    </main>
  </section>
</template>

<style scoped>
.subpage-layout {
  min-height: 100vh;
  background: #f4f6fa;
}

.subpage-layout__header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.subpage-layout__header h1 {
  margin: 0;
  text-align: center;
  font-size: 17px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #f5f7fa;
  color: #606266;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  width: 36px;
  height: 36px;
}

.subpage-layout__main {
  padding: 14px;
}
</style>
