<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getTournamentDetail } from '@/api/tournament'
import { showErrorMessage } from '@/utils/error'
import TeamDetailPage from '@/views/match/team/detail.vue'
import RandomMixedDetailPage from '@/views/match/random-mixed/detail.vue'

const route = useRoute()

const loading = ref(false)
const detail = ref(null)

const mode = computed(() => String(detail.value?.match_mode || ''))

const loadDetail = async () => {
  try {
    loading.value = true
    detail.value = await getTournamentDetail(route.params.id)
  } catch (error) {
    showErrorMessage(error)
    detail.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadDetail()
})
</script>

<template>
  <section class="detail-dispatch-page" v-loading.fullscreen.lock="loading">
    <TeamDetailPage v-if="mode === 'team'" />
    <RandomMixedDetailPage v-else-if="mode === 'random_mixed_rotate'" />

    <el-card v-else shadow="never">
      <template #header>
        <div class="title">赛事详情</div>
      </template>
      <div class="meta">当前对局模式暂未接入详情页：{{ mode || '-' }}</div>
    </el-card>
  </section>
</template>

<style scoped>
.detail-dispatch-page {
  display: grid;
  gap: 12px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.meta {
  font-size: 13px;
  color: #606266;
}
</style>
