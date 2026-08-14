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
const pageLoading = computed(() => loadingUsers.value || creating.value)

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
            scheduleMode: 'uniform',
            eventCodes: ['mixed_double'],
            roundEventCodes: [['mixed_double']],
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
  <section v-loading.fullscreen.lock="pageLoading" class="create-page">
    <div class="create-intro">
      <span>NEW MATCH</span>
      <strong>发起一场新比赛</strong>
      <p>设置基础信息并选择参赛人员，创建后仍可继续调整。</p>
    </div>

    <el-card class="step-card" shadow="never">
      <template #header>
        <div class="step-title"><span>1</span><div><strong>比赛信息</strong><small>给比赛起一个容易识别的名称</small></div></div>
      </template>
      <div class="form-block">
        <div class="label">比赛名称</div>
        <el-input v-model="form.name" size="large" placeholder="例如：周六羽毛球友谊赛" />
      </div>
    </el-card>

    <el-card class="step-card" shadow="never">
      <template #header>
        <div class="step-title"><span>2</span><div><strong>对局方式</strong><small>选择本场比赛使用的赛制</small></div></div>
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
          <span class="mode-radio"></span>
          <div class="mode-label">{{ mode.label }}</div>
          <div class="mode-desc">{{ mode.description }}</div>
          <div v-if="mode.disabled" class="mode-note">{{ mode.note || '暂未开放' }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="step-card" shadow="never">
      <template #header>
        <div class="header-row">
          <div class="step-title"><span>3</span><div><strong>参赛人员</strong><small>已选择 {{ form.participantUserIds.length }} 人</small></div></div>
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

    <div class="submit-bar">
      <el-button class="submit-btn" size="large" type="primary" :loading="creating" @click="onCreateTournament">
        创建并进入比赛
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.create-page {
  display: grid;
  gap: 14px;
}

.create-intro {
  padding: 18px 18px 16px;
  border-radius: 20px;
  color: #fff;
  background:
    radial-gradient(circle at 88% 0%, rgba(255, 255, 255, 0.26), transparent 30%),
    linear-gradient(135deg, #5d78f2, #654fc5);
  box-shadow: 0 16px 30px rgba(74, 88, 183, 0.2);
}

.create-intro span,
.create-intro strong {
  display: block;
}

.create-intro span {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  opacity: 0.72;
}

.create-intro strong {
  margin-top: 5px;
  font-size: 21px;
}

.create-intro p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.78;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-title > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  color: #4f6df5;
  font-size: 13px;
  font-weight: 700;
  background: #eef1ff;
}

.step-title strong,
.step-title small {
  display: block;
}

.step-title strong {
  color: #202938;
  font-size: 15px;
}

.step-title small {
  margin-top: 2px;
  color: #929aab;
  font-size: 11px;
  font-weight: 400;
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
  position: relative;
  border: 1px solid #ebeef5;
  border-radius: 14px;
  padding: 13px 13px 13px 42px;
  background: #fafbfe;
}

.mode-item--active {
  border-color: #7187f5;
  background: linear-gradient(135deg, #f1f4ff, #eef1ff);
  box-shadow: inset 0 0 0 1px rgba(79, 109, 245, 0.08);
}

.mode-radio {
  position: absolute;
  top: 17px;
  left: 14px;
  width: 16px;
  height: 16px;
  border: 2px solid #c5cada;
  border-radius: 50%;
}

.mode-item--active .mode-radio {
  border: 5px solid #4f6df5;
  background: #fff;
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
  border-radius: 12px;
  padding: 9px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 54px;
  text-align: center;
  position: relative;
}

.user-item--active {
  border-color: #6d83f2;
  box-shadow: inset 0 0 0 1px rgba(79, 109, 245, 0.1);
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
  background: #4f6df5;
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.submit-bar {
  position: sticky;
  bottom: 10px;
  z-index: 8;
  padding: 8px;
  border: 1px solid rgba(121, 135, 163, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12px 28px rgba(45, 62, 100, 0.12);
  backdrop-filter: blur(14px);
}

.submit-btn {
  width: 100%;
  min-height: 46px;
}
</style>
