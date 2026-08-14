<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Grid, Plus, Trophy } from '@element-plus/icons-vue'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const genderMap = {
  0: '未知',
  1: '男',
  2: '女',
}

const nickname = computed(() => authStore.user?.nickname || authStore.user?.name || '用户')
const genderText = computed(() => genderMap[Number(authStore.user?.gender)] || '未知')

const heroClass = computed(() => {
  const gender = Number(authStore.user?.gender)
  if (gender === 2) return 'hero--female'
  if (gender === 1) return 'hero--male'
  return 'hero--unknown'
})

const genderClass = computed(() => {
  const gender = Number(authStore.user?.gender)
  if (gender === 2) return 'hero-tag--female'
  if (gender === 1) return 'hero-tag--male'
  return 'hero-tag--unknown'
})

const hasAdminPermission = computed(() => authStore.isAdmin || authStore.hasPermission('admin'))

const hasAdminCommonPermission = computed(
  () => authStore.isAdmin || authStore.hasPermission('admin-common')
)

const toAdmin = () => router.push('/admin/users')
const toCreateTournament = () => router.push('/matchs/create')
const toAllTournaments = () => router.push('/matchs/all')
</script>

<template>
  <section class="home-page">
    <div class="hero" :class="heroClass">
      <div class="hero__top">
        <div>
          <p class="hero__welcome">
            欢迎回来，<span>{{ nickname }}</span>
          </p>
          <p class="hero__subtitle">准备好开启今天的羽球时光了吗？</p>
        </div>
        <div class="hero__tags">
          <el-tag size="small" effect="dark" class="hero-tag" :class="genderClass">{{
            genderText
          }}</el-tag>
        </div>
      </div>
    </div>

    <div v-if="hasAdminPermission || hasAdminCommonPermission" class="section-title">快捷入口</div>
    <div v-if="hasAdminPermission || hasAdminCommonPermission" class="quick-grid">
      <el-card
        v-if="hasAdminPermission"
        shadow="hover"
        class="quick-card--clickable"
        @click="toAdmin"
      >
        <div class="quick-item">
          <div class="quick-item__head">
            <div class="quick-item__left">
              <span class="quick-item__icon quick-item__icon--admin"
                ><el-icon> <Grid /> </el-icon
              ></span>
              <h3>用户管理</h3>
            </div>
            <el-icon class="quick-item__arrow">
              <ArrowRight />
            </el-icon>
          </div>
          <p>进入管理页面维护用户数据</p>
        </div>
      </el-card>

      <el-card
        v-if="hasAdminCommonPermission"
        shadow="hover"
        class="quick-card--clickable"
        @click="toCreateTournament"
      >
        <div class="quick-item">
          <div class="quick-item__head">
            <div class="quick-item__left">
              <span class="quick-item__icon quick-item__icon--create"
                ><el-icon> <Plus /> </el-icon
              ></span>
              <h3>创建比赛</h3>
            </div>
            <el-icon class="quick-item__arrow">
              <ArrowRight />
            </el-icon>
          </div>
          <p>选择对局方式并挑选参赛人员</p>
        </div>
      </el-card>

      <el-card
        v-if="hasAdminPermission"
        shadow="hover"
        class="quick-card--clickable"
        @click="toAllTournaments"
      >
        <div class="quick-item">
          <div class="quick-item__head">
            <div class="quick-item__left">
              <span class="quick-item__icon quick-item__icon--all"
                ><el-icon> <Trophy /> </el-icon
              ></span>
              <h3>全部比赛</h3>
            </div>
            <el-icon class="quick-item__arrow">
              <ArrowRight />
            </el-icon>
          </div>
          <p>查看系统内全部比赛</p>
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.home-page {
  padding: 16px;
}

.hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 16px;
  min-height: 120px;
  padding: 20px 16px;
  color: #fff;
  box-shadow: 0 10px 22px rgba(64, 158, 255, 0.22);
}

.hero--male {
  background: linear-gradient(135deg, #3a8bff, #6ab2ff);
  box-shadow: 0 10px 22px rgba(64, 158, 255, 0.22);
}

.hero--female {
  background: linear-gradient(135deg, #f56c9a, #ff9fbd);
  box-shadow: 0 10px 22px rgba(245, 108, 154, 0.26);
}

.hero--unknown {
  background: linear-gradient(135deg, #909399, #b2b5bd);
  box-shadow: 0 10px 22px rgba(144, 147, 153, 0.22);
}

.hero::after {
  content: '';
  position: absolute;
  right: -24px;
  top: -24px;
  width: 96px;
  height: 96px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
}

.hero__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hero__welcome {
  margin: 0;
  font-size: 19px;
  line-height: 1.25;
}

.hero__welcome span {
  font-weight: 700;
}

.hero__subtitle {
  margin: 7px 0 0;
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
}

.hero__tags {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hero-tag {
  border: none;
}

.hero-tag--male {
  background: #5f9cf8;
}

.hero-tag--female {
  background: #f56c9a;
}

.hero-tag--unknown {
  background: #909399;
}

.section-title {
  margin: 18px 2px 10px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.quick-grid {
  display: grid;
  gap: 12px;
}

.quick-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quick-item__left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.quick-item__icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.quick-item__icon--admin {
  background: linear-gradient(135deg, #5b8ff9, #6dc8ff);
}

.quick-item__icon--create {
  background: linear-gradient(135deg, #4cc9a7, #65d6bc);
}

.quick-item__icon--all {
  background: linear-gradient(135deg, #f56c6c, #ff8a8a);
}

.quick-item__arrow {
  color: #c0c4cc;
}

.quick-item h3 {
  margin: 0;
  font-size: 15px;
  color: #303133;
}

.quick-item p {
  margin: 8px 0 0;
  color: #606266;
  font-size: 12px;
  line-height: 1.5;
}

.quick-card--clickable {
  cursor: pointer;
  border-radius: 14px;
  transition: transform 0.2s ease;
}

.quick-card--clickable:hover {
  transform: translateY(-1px);
}
</style>
