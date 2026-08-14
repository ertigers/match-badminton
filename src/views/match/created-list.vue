<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMyCreatedTournaments, MATCH_MODES } from '../../api/tournament'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'
import TournamentListPanel from './components/tournament-list-panel.vue'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const list = ref([])

const modeMap = computed(() => {
  const map = {}
  MATCH_MODES.forEach((item) => {
    map[item.code] = item.label
  })
  return map
})

const loadData = async () => {
  try {
    loading.value = true
    list.value = await listMyCreatedTournaments(authStore.user?.id)
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const toDetail = (id) => {
  router.push(`/matchs/${id}`)
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <section v-loading.fullscreen.lock="loading" class="my-list-page">
    <TournamentListPanel
      title="我创建的比赛"
      description="管理你发起的赛事与比赛进度"
      empty-text="暂无创建比赛"
      :list="list"
      :mode-map="modeMap"
      @select="toDetail"
    />
  </section>
</template>

<style scoped>
.my-list-page {

}

.title {
  font-size: 15px;
  font-weight: 600;
}

.list-wrap {
  display: grid;
  gap: 10px;
}

.item-card {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 10px;
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.name {
  font-size: 14px;
  font-weight: 600;
}

.meta {
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}
</style>
