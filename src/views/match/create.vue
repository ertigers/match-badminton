<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { listAllUsers } from '../../api/admin'
import { createTournament, MATCH_MODES } from '../../api/tournament'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'

const router = useRouter()
const authStore = useAuthStore()

const loadingUsers = ref(false)
const creating = ref(false)
const users = ref([])

const form = ref({
  name: '',
  matchMode: 'team',
  participantUserIds: [],
})

const selectedUsers = computed(() => {
  const selectedSet = new Set(form.value.participantUserIds)
  return users.value.filter((item) => selectedSet.has(item.user_id))
})

const loadUsers = async () => {
  try {
    loadingUsers.value = true
    users.value = await listAllUsers()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loadingUsers.value = false
  }
}

const toggleUser = (userId) => {
  const ids = form.value.participantUserIds
  const index = ids.indexOf(userId)
  if (index >= 0) {
    ids.splice(index, 1)
  } else {
    ids.push(userId)
  }
}

const selectAllUsers = () => {
  form.value.participantUserIds = users.value.map((item) => item.user_id)
}

const clearUsers = () => {
  form.value.participantUserIds = []
}

const onCreateTournament = async () => {
  try {
    creating.value = true
    const mode = String(form.value.matchMode || '')
    const selectedMode = MATCH_MODES.find((item) => item.code === mode)
    if (!selectedMode) throw new Error('请选择对局方式')
    if (selectedMode.disabled) throw new Error(selectedMode.note || '该对局方式暂未开放')
    const teamConfig =
      mode === 'team'
        ? {
            groupCount: 2,
            eventCodes: ['mixed_double'],
            roundCount: 1,
            scoreTarget: 21,
          }
        : undefined
    const created = await createTournament({
      name: form.value.name,
      matchMode: mode,
      participants: selectedUsers.value,
      creatorUserId: authStore.user?.id,
      teamConfig,
    })
    ElMessage.success('比赛创建成功')
    router.push(`/matchs/${created.id}`)
  } catch (error) {
    showErrorMessage(error)
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  await loadUsers()
})
</script>

<template>
  <section class="create-page">
    <el-card shadow="never">
      <template #header>
        <div class="title">创建比赛</div>
      </template>
      <div class="form-block">
        <div class="label">比赛名称</div>
        <el-input v-model="form.name" placeholder="请输入比赛名称" />
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="title">对局方式</div>
      </template>
      <div class="mode-list">
        <div
          v-for="mode in MATCH_MODES"
          :key="mode.code"
          class="mode-item"
          :class="{
            'mode-item--active': form.matchMode === mode.code,
            'mode-item--disabled': !!mode.disabled,
          }"
          @click="!mode.disabled && (form.matchMode = mode.code)"
        >
          <div class="mode-label">{{ mode.label }}</div>
          <div class="mode-desc">{{ mode.description }}</div>
          <div v-if="mode.disabled" class="mode-note">{{ mode.note || '暂未开放' }}</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" v-loading="loadingUsers">
      <template #header>
        <div class="header-row">
          <div class="title">选择参赛人员（{{ form.participantUserIds.length }}）</div>
          <div class="actions">
            <el-button size="small" @click="selectAllUsers">全选</el-button>
            <el-button size="small" @click="clearUsers">清空</el-button>
          </div>
        </div>
      </template>
      <div class="user-list">
        <div
          v-for="item in users"
          :key="item.user_id"
          class="user-item"
          :class="{
            'user-item--active': form.participantUserIds.includes(item.user_id),
            'user-item--male': Number(item.gender) === 1,
            'user-item--female': Number(item.gender) === 2,
          }"
          @click="toggleUser(item.user_id)"
        >
          <el-icon v-if="form.participantUserIds.includes(item.user_id)" class="selected-icon">
            <Check />
          </el-icon>
          <span class="user-name">{{ item.nickname || item.user_id }}</span>
        </div>
      </div>
    </el-card>

    <el-button type="primary" :loading="creating" @click="onCreateTournament">创建并进入比赛</el-button>
  </section>
</template>

<style scoped>
.create-page {
  display: grid;
  gap: 12px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.form-block .label {
  margin-bottom: 8px;
  color: #606266;
  font-size: 13px;
}

.mode-list {
  display: grid;
  gap: 8px;
}

.mode-item {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 10px;
}

.mode-item--active {
  border-color: #409eff;
  background: #ecf5ff;
}

.mode-item--disabled {
  opacity: 0.72;
  cursor: not-allowed;
  border-style: dashed;
}

.mode-label {
  font-size: 14px;
  font-weight: 600;
}

.mode-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.mode-note {
  margin-top: 6px;
  display: inline-block;
  font-size: 11px;
  color: #e6a23c;
  border: 1px solid #f3d19e;
  border-radius: 10px;
  padding: 1px 8px;
  background: #fdf6ec;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.actions {
  display: flex;
  gap: 8px;
}

.user-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.user-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 6px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 46px;
  text-align: center;
  position: relative;
}

.user-item--active {
  border-color: #67c23a;
  background: #f0f9eb;
}

.user-item--male {
  background: #eff6ff;
}

.user-item--female {
  background: #fff0f6;
}

.user-name {
  font-size: 12px;
  color: #303133;
  word-break: break-all;
  line-height: 1.2;
}

.selected-icon {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #67c23a;
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>

