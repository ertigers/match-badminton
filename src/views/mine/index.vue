<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  ArrowRight,
  Calendar,
  DataLine,
  Grid,
  Medal,
  SwitchButton,
  Trophy,
  User,
} from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { listUserStatsMap } from '../../api/user-stats'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'

const router = useRouter()
const authStore = useAuthStore()

const defaultStats = {
  level: '-',
  tournament_count: 0,
  match_count: 0,
  win_rate: 0,
}

const genderMap = {
  0: '未知',
  1: '男',
  2: '女',
}

const userStats = ref({ ...defaultStats })
const statsLoading = ref(false)
const logoutLoading = ref(false)

const userName = computed(() => authStore.user?.nickname || authStore.user?.name || '用户')
const userId = computed(() => String(authStore.user?.id || '').trim())
const genderValue = computed(() => Number(authStore.user?.gender || 0))
const genderText = computed(() => genderMap[genderValue.value] || genderMap[0])
const avatarText = computed(() => userName.value.trim().slice(0, 1).toUpperCase() || '羽')
const displayLevel = computed(() => {
  const statsLevel = String(userStats.value.level ?? '').trim()
  if (statsLevel && statsLevel !== '-') return statsLevel
  return String(authStore.user?.level ?? '').trim() || '-'
})
const formatWinRate = computed(() => `${Number(userStats.value.win_rate || 0)}%`)

const profileThemeClass = computed(() => {
  if (genderValue.value === 1) return 'profile-hero--male'
  if (genderValue.value === 2) return 'profile-hero--female'
  return 'profile-hero--unknown'
})

const hasAdminCommonPermission = computed(
  () => authStore.isAdmin || authStore.hasPermission('admin-common')
)
const roleLabels = computed(() => {
  const labels = []
  if (authStore.isAdmin) labels.push('白名单管理员')
  if (authStore.hasPermission('admin')) labels.push('系统管理员')
  if (authStore.hasPermission('admin-common')) labels.push('赛事管理员')
  return labels.length ? labels : ['普通用户']
})

const loadMyStats = async () => {
  if (!userId.value) {
    userStats.value = { ...defaultStats }
    return
  }

  try {
    statsLoading.value = true
    const statsMap = await listUserStatsMap([userId.value])
    userStats.value = { ...defaultStats, ...(statsMap[userId.value] || {}) }
  } catch {
    userStats.value = { ...defaultStats }
  } finally {
    statsLoading.value = false
  }
}

const goTo = (path) => router.push(path)

const onLogout = async () => {
  try {
    await ElMessageBox.confirm('退出后需要重新输入账号和密码，确认退出吗？', '退出登录', {
      type: 'warning',
      confirmButtonText: '确认退出',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    logoutLoading.value = true
    await authStore.logout()
    router.replace('/login')
  } catch (error) {
    showErrorMessage(error)
  } finally {
    logoutLoading.value = false
  }
}

watch(userId, loadMyStats)
onMounted(loadMyStats)
</script>

<template>
  <section class="mine-page">
    <div class="profile-hero" :class="profileThemeClass">
      <div class="profile-hero__decoration profile-hero__decoration--large"></div>
      <div class="profile-hero__decoration profile-hero__decoration--small"></div>

      <div class="profile-main">
        <div class="profile-avatar">{{ avatarText }}</div>
        <div class="profile-summary">
          <div class="profile-name">{{ userName }}</div>
          <div class="profile-tags">
            <span class="profile-tag">{{ genderText }}</span>
            <span class="profile-tag profile-tag--level">Lv.{{ displayLevel }}</span>
          </div>
        </div>
        <div class="online-pill"><span></span>已登录</div>
      </div>

      <div v-loading="statsLoading" class="profile-stats" element-loading-background="transparent">
        <div class="profile-stat">
          <span class="profile-stat__label"
            ><el-icon><Trophy /></el-icon>参赛</span
          >
          <strong>{{ Number(userStats.tournament_count || 0) }}</strong>
        </div>
        <div class="profile-stat">
          <span class="profile-stat__label"
            ><el-icon><Medal /></el-icon>对局</span
          >
          <strong>{{ Number(userStats.match_count || 0) }}</strong>
        </div>
        <div class="profile-stat">
          <span class="profile-stat__label"
            ><el-icon><DataLine /></el-icon>胜率</span
          >
          <strong>{{ formatWinRate }}</strong>
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-heading">
        <div>
          <h2>赛事中心</h2>
          <p>查看属于你的比赛记录</p>
        </div>
      </div>

      <div class="menu-card">
        <button class="menu-row" type="button" @click="goTo('/matchs/my')">
          <span class="menu-icon menu-icon--participated"
            ><el-icon><Calendar /></el-icon
          ></span>
          <span class="menu-content">
            <strong>我参与的比赛</strong>
            <small>查看参赛记录和比赛详情</small>
          </span>
          <el-icon class="menu-arrow"><ArrowRight /></el-icon>
        </button>

        <button
          v-if="hasAdminCommonPermission"
          class="menu-row"
          type="button"
          @click="goTo('/matchs/created')"
        >
          <span class="menu-icon menu-icon--created"
            ><el-icon><Trophy /></el-icon
          ></span>
          <span class="menu-content">
            <strong>我创建的比赛</strong>
            <small>管理自己创建的比赛</small>
          </span>
          <el-icon class="menu-arrow"><ArrowRight /></el-icon>
        </button>
      </div>
    </div>

    <div class="section-block">
      <div class="section-heading">
        <div>
          <h2>账号信息</h2>
          <p>当前登录账号和权限状态</p>
        </div>
      </div>

      <div class="account-card">
        <div class="account-row">
          <span class="account-icon"
            ><el-icon><User /></el-icon
          ></span>
          <span class="account-label">用户 ID</span>
          <span class="account-value account-value--id">{{ userId || '-' }}</span>
        </div>
        <div class="account-row account-row--roles">
          <span class="account-icon account-icon--role"
            ><el-icon><Grid /></el-icon
          ></span>
          <span class="account-label">账号角色</span>
          <span class="role-list">
            <span v-for="item in roleLabels" :key="item" class="role-tag">{{ item }}</span>
          </span>
        </div>
      </div>
    </div>

    <el-button
      class="logout-button"
      type="danger"
      plain
      size="large"
      :loading="logoutLoading"
      @click="onLogout"
    >
      <el-icon><SwitchButton /></el-icon>
      退出登录
    </el-button>
  </section>
</template>

<style scoped>
.mine-page {
  display: grid;
  gap: 18px;
  padding: 16px 16px 24px;
}

.profile-hero {
  position: relative;
  overflow: hidden;
  min-height: 230px;
  padding: 20px 16px 16px;
  border-radius: 20px;
  color: #fff;
  box-shadow: 0 12px 28px rgba(64, 158, 255, 0.22);
}

.profile-hero--male {
  background: linear-gradient(145deg, #397ef6 0%, #66b4ff 100%);
}

.profile-hero--female {
  background: linear-gradient(145deg, #ee6594 0%, #ff9fbd 100%);
  box-shadow: 0 12px 28px rgba(245, 108, 154, 0.24);
}

.profile-hero--unknown {
  background: linear-gradient(145deg, #75808d 0%, #aab2bc 100%);
  box-shadow: 0 12px 28px rgba(96, 108, 122, 0.2);
}

.profile-hero__decoration {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.11);
}

.profile-hero__decoration--large {
  top: -46px;
  right: -34px;
  width: 150px;
  height: 150px;
}

.profile-hero__decoration--small {
  right: 92px;
  bottom: 76px;
  width: 40px;
  height: 40px;
}

.profile-main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 62px;
  height: 62px;
  place-items: center;
  border: 2px solid rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 20px rgba(25, 72, 135, 0.16);
  font-size: 26px;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.profile-summary {
  min-width: 0;
  flex: 1;
}

.profile-name {
  overflow: hidden;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.profile-tag {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
}

.profile-tag--level {
  background: rgba(255, 255, 255, 0.95);
  color: #397ef6;
  font-weight: 700;
}

.online-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-size: 10px;
}

.online-pill span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8ff0bd;
  box-shadow: 0 0 0 3px rgba(143, 240, 189, 0.16);
}

.profile-stats {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 14px;
  padding: 9px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
}

.profile-stat {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 5px 2px;
  text-align: center;
}

.profile-stat + .profile-stat {
  border-left: 1px solid rgba(255, 255, 255, 0.18);
}

.profile-stat__label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 11px;
}

.profile-stat strong {
  font-size: 18px;
}

.profile-stats :deep(.el-loading-mask) {
  background-color: transparent;
}

.profile-stats :deep(.el-loading-spinner .path) {
  stroke: #fff;
}

.section-block {
  display: grid;
  gap: 9px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 2px;
}

.section-heading h2 {
  margin: 0;
  color: #303133;
  font-size: 16px;
}

.section-heading p {
  margin: 3px 0 0;
  color: #9aa0a8;
  font-size: 11px;
}

.menu-card,
.account-card {
  overflow: hidden;
  border: 1px solid #edf0f5;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(48, 49, 51, 0.04);
}

.menu-row {
  display: flex;
  width: 100%;
  min-height: 70px;
  align-items: center;
  gap: 11px;
  border: 0;
  border-bottom: 1px solid #f1f3f6;
  padding: 12px 14px;
  background: #fff;
  color: inherit;
  text-align: left;
}

.menu-row:last-child {
  border-bottom: 0;
}

.menu-row:active {
  background: #f7f9fc;
}

.menu-icon {
  display: grid;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  font-size: 18px;
}

.menu-icon--participated {
  background: linear-gradient(135deg, #ff9f43, #ffbd70);
}

.menu-icon--created {
  background: linear-gradient(135deg, #9470ed, #bd99ff);
}

.menu-content {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.menu-content strong {
  color: #303133;
  font-size: 14px;
}

.menu-content small {
  overflow: hidden;
  color: #909399;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-arrow {
  flex: 0 0 auto;
  color: #c4c9d0;
}

.account-row {
  display: flex;
  min-height: 58px;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid #f1f3f6;
  padding: 11px 14px;
}

.account-row:last-child {
  border-bottom: 0;
}

.account-icon {
  display: grid;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: #ecf5ff;
  color: #409eff;
}

.account-icon--role {
  background: #f2edff;
  color: #8b63df;
}

.account-label {
  flex: 0 0 auto;
  color: #606266;
  font-size: 13px;
}

.account-value {
  min-width: 0;
  flex: 1;
  color: #303133;
  font-size: 12px;
  text-align: right;
}

.account-value--id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-row--roles {
  align-items: flex-start;
}

.account-row--roles .account-label {
  padding-top: 6px;
}

.role-list {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.role-tag {
  padding: 4px 8px;
  border: 1px solid #d9ecff;
  border-radius: 999px;
  background: #f2f8ff;
  color: #3f82d5;
  font-size: 10px;
}

.logout-button {
  width: 100%;
  min-height: 44px;
  border-radius: 13px;
}

@media (min-width: 768px) {
  .mine-page {
    max-width: 680px;
    margin: 0 auto;
  }
}
</style>
