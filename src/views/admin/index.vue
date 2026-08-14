<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataLine, Medal, Plus, Trophy } from '@element-plus/icons-vue'
import { importDraftUsers, listAllUsers, registerUserByAdmin } from '../../api/admin'
import { showErrorMessage } from '../../utils/error'

const loading = ref(false)
const importing = ref(false)
const registering = ref(false)
const registerDialogVisible = ref(false)
const registerFormRef = ref(null)
const list = ref([])

const registerForm = reactive({
  account: '',
  nickname: '',
  gender: '',
  password: '',
  confirmPassword: '',
})

const genderMap = {
  0: '未知',
  1: '男',
  2: '女',
}

const formatGender = (value) => {
  const gender = Number(value)
  return genderMap[gender] || genderMap[0]
}

const formatWinRate = (value) => `${Number(value || 0)}%`

const validateConfirmPassword = (_, value, callback) => {
  if (!value) {
    callback(new Error('请再次输入密码'))
    return
  }
  if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
    return
  }
  callback()
}

const registerRules = {
  account: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入用户昵称', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
}

const totalCount = computed(() => list.value.length)
const maleCount = computed(() => list.value.filter((item) => Number(item.gender) === 1).length)
const femaleCount = computed(() => list.value.filter((item) => Number(item.gender) === 2).length)

const loadData = async () => {
  try {
    loading.value = true
    list.value = await listAllUsers()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const resetRegisterForm = () => {
  Object.assign(registerForm, {
    account: '',
    nickname: '',
    gender: '',
    password: '',
    confirmPassword: '',
  })
  registerFormRef.value?.clearValidate()
}

const openRegisterDialog = () => {
  resetRegisterForm()
  registerDialogVisible.value = true
}

const submitRegisterUser = async () => {
  const valid = await registerFormRef.value?.validate().catch(() => false)
  if (!valid) return

  try {
    registering.value = true
    await registerUserByAdmin({
      account: registerForm.account,
      nickname: registerForm.nickname,
      password: registerForm.password,
      gender: registerForm.gender,
    })
    ElMessage.success('用户注册成功')
    registerDialogVisible.value = false
    await loadData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    registering.value = false
  }
}

const handleImportUsers = async () => {
  try {
    await ElMessageBox.confirm(
      '将 user-base-draft.json 中的数据批量导入用户表，是否继续？',
      '导入用户',
      {
        type: 'warning',
        confirmButtonText: '开始导入',
        cancelButtonText: '取消',
      }
    )
  } catch {
    return
  }

  try {
    importing.value = true
    const { inserted, total, failed = [] } = await importDraftUsers()
    if (failed.length) {
      ElMessage.warning(`导入完成：成功 ${inserted}/${total}，失败 ${failed.length}`)
      console.warn('用户导入失败明细：', failed)
    } else {
      ElMessage.success(`导入成功：${inserted}/${total}`)
    }
    await loadData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <section v-loading="loading" class="user-page">
    <div class="action-bar">
      <el-button class="action-btn" type="primary" @click="openRegisterDialog">
        <el-icon><Plus /></el-icon>
        注册用户
      </el-button>
      <el-button class="action-btn action-btn--refresh" plain @click="loadData">刷新</el-button>
      <!-- <el-button class="action-btn" :loading="importing" type="primary" @click="handleImportUsers">
        导入用户
      </el-button> -->
    </div>

    <el-card shadow="never" class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">总人数</div>
          <div class="stat-value">{{ totalCount }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">男生</div>
          <div class="stat-value stat-value--male">{{ maleCount }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">女生</div>
          <div class="stat-value stat-value--female">{{ femaleCount }}</div>
        </div>
      </div>
    </el-card>

    <div v-if="!list.length" class="empty-wrap">
      <el-empty description="暂无用户数据" />
    </div>

    <div v-else class="user-list">
      <el-card v-for="item in list" :key="item.id || item.user_id" class="user-card" shadow="hover">
        <div class="user-card__top">
          <div class="name">{{ item.nickname || '未命名用户' }}</div>
          <div class="badge-group">
            <el-tag
              size="small"
              :type="
                Number(item.gender) === 2
                  ? 'danger'
                  : Number(item.gender) === 1
                    ? 'info'
                    : 'warning'
              "
              :effect="Number(item.gender) === 2 ? 'light' : 'plain'"
              :class="{
                'gender-tag--female': Number(item.gender) === 2,
                'gender-tag--male': Number(item.gender) === 1,
              }"
            >
              {{ formatGender(item.gender) }}
            </el-tag>
            <el-tag size="small" type="success" effect="plain">Lv.{{ item.level || '-' }}</el-tag>
          </div>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">
              <el-icon><Trophy /></el-icon>
              参赛次数
            </span>
            <span class="meta-value">{{ Number(item.tournament_count || 0) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">
              <el-icon><Medal /></el-icon>
              对局次数
            </span>
            <span class="meta-value">{{ Number(item.match_count || 0) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">
              <el-icon><DataLine /></el-icon>
              胜率
            </span>
            <span class="meta-value">{{ formatWinRate(item.win_rate) }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog
      v-model="registerDialogVisible"
      title="注册用户"
      width="min(420px, calc(100vw - 32px))"
      :close-on-click-modal="!registering"
      :close-on-press-escape="!registering"
      :show-close="!registering"
      @closed="resetRegisterForm"
    >
      <el-form
        ref="registerFormRef"
        :model="registerForm"
        :rules="registerRules"
        label-position="top"
      >
        <el-form-item label="登录账号" prop="account">
          <el-input
            v-model="registerForm.account"
            size="large"
            placeholder="用户名、手机号或邮箱"
          />
        </el-form-item>
        <el-form-item label="用户昵称" prop="nickname">
          <el-input v-model="registerForm.nickname" size="large" placeholder="请输入用户昵称" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-select
            v-model="registerForm.gender"
            size="large"
            placeholder="请选择性别"
            style="width: 100%"
          >
            <el-option label="男" :value="1" />
            <el-option label="女" :value="2" />
            <el-option label="未知" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input
            v-model="registerForm.password"
            size="large"
            type="password"
            show-password
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            size="large"
            type="password"
            show-password
            placeholder="请再次输入密码"
            @keyup.enter="submitRegisterUser"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" :disabled="registering" @click="registerDialogVisible = false"
            >取消</el-button
          >
          <el-button size="large" type="primary" :loading="registering" @click="submitRegisterUser">
            确认注册
          </el-button>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.user-page {
  display: grid;
  gap: 14px;
}

.action-bar {
  display: flex;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(121, 135, 163, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 24px rgba(46, 64, 104, 0.07);
}

.action-btn {
  flex: 1;
  height: 36px;
  border-radius: 10px;
  font-weight: 600;
}

.action-btn--refresh {
  background: #f5f7fa;
  border-color: #dcdfe6;
  color: #606266;
}

.dialog-footer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stats-card {
  color: #fff;
  background:
    radial-gradient(circle at 90% 0%, rgba(255, 255, 255, 0.24), transparent 30%),
    linear-gradient(135deg, #607af2, #5e53c8);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stat-item {
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 11px 8px;
  background: rgba(255, 255, 255, 0.1);
  text-align: center;
}

.stat-label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  text-align: center;
}

.stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  text-align: center;
}

.stat-value--male {
  color: #dceaff;
}

.stat-value--female {
  color: #ffe0ec;
}

.empty-wrap {
  margin-top: 24px;
}

.user-list {
  display: grid;
  gap: 12px;
}

.user-card {
  border-radius: 17px;
}

.user-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.name {
  font-size: 18px;
  font-weight: 600;
}

.badge-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.meta-item {
  border: 1px solid rgba(121, 135, 163, 0.1);
  background: #f7f8fc;
  border-radius: 10px;
  padding: 8px 6px;
  min-width: 0;
}

.meta-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.meta-value {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
}

.gender-tag--female {
  background: #fdf0f6;
  border-color: #f8c2d7;
  color: #d84b82;
}

.gender-tag--male {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #3a84e8;
}
</style>
