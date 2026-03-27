<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listMyParticipatingTournaments, MATCH_MODES } from '../../api/tournament'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'

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
    list.value = await listMyParticipatingTournaments(authStore.user?.id)
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
  <section class="my-list-page" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="title">鎴戝弬涓庣殑璧涗簨</div>
      </template>
      <div v-if="list.length" class="list-wrap">
        <div v-for="item in list" :key="item.id" class="item-card" @click="toDetail(item.id)">
          <div class="item-top">
            <div class="name">{{ item.name }}</div>
            <el-tag size="small">{{ item.status }}</el-tag>
          </div>
          <div class="meta">瀵瑰眬鏂瑰紡锛歿{ modeMap[item.match_mode] || item.match_mode || '-' }}</div>
          <div class="meta">鍙備笌浜烘暟锛歿{ item.participant_count }}</div>
        </div>
      </div>
      <el-empty v-else description="鏆傛棤鍙備笌璧涗簨" />
    </el-card>
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

