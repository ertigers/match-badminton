<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'

const router = useRouter()
const authStore = useAuthStore()

const genderMap = {
  0: '未知',
  1: '男',
  2: '女',
}

const userName = computed(() => authStore.user?.nickname || authStore.user?.name || '-')
const userId = computed(() => authStore.user?.id || '-')
const gender = computed(() => genderMap[Number(authStore.user?.gender)] || '未知')

const onLogout = async () => {
  try {
    await authStore.logout()
    router.replace('/login')
  } catch (error) {
    showErrorMessage(error)
  }
}
</script>

<template>
  <section class="mine-page">
    <el-card class="profile-card">
      <div class="profile-name">{{ userName }}</div>
      <div class="profile-sub">UID：{{ userId }}</div>
    </el-card>

    <el-card>
      <div class="info-item">
        <span>昵称</span>
        <span>{{ userName }}</span>
      </div>
      <div class="info-item">
        <span>性别</span>
        <span>{{ gender }}</span>
      </div>
      <div class="info-item">
        <span>用户ID</span>
        <span>{{ userId }}</span>
      </div>
    </el-card>

    <div class="actions">
      <el-button type="danger" plain @click="onLogout">退出登录</el-button>
    </div>
  </section>
</template>

<style scoped>
.mine-page {
  padding: 16px;
}

.profile-card {
  margin-bottom: 12px;
  background: #ffffff;
}

.profile-name {
  font-size: 20px;
  font-weight: 600;
}

.profile-sub {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f2f3f5;
}

.info-item:last-child {
  border-bottom: none;
}

.actions {
  margin-top: 16px;
  display: grid;
  gap: 10px;
}
</style>
