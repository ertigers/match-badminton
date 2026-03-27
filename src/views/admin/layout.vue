<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SubpageLayout from '../../layouts/subpage-layout.vue'

const route = useRoute()
const router = useRouter()

const active = computed(() =>
  route.path.includes('/admin/permissions') ? 'permissions' : 'users'
)

const goUsers = () => {
  router.push('/admin/users')
}

const goPermissions = () => {
  router.push('/admin/permissions')
}
</script>

<template>
  <SubpageLayout back-to="/home">
    <template #subnav>
      <nav class="admin-layout__subnav">
        <button
          class="subnav-btn"
          :class="{ 'subnav-btn--active': active === 'users' }"
          @click="goUsers"
        >
          用户管理
        </button>
        <button
          class="subnav-btn"
          :class="{ 'subnav-btn--active': active === 'permissions' }"
          @click="goPermissions"
        >
          权限管理
        </button>
      </nav>
    </template>
    <template #default>
      <RouterView />
    </template>
  </SubpageLayout>
</template>

<style scoped>
.admin-layout__subnav {
  position: sticky;
  top: 57px;
  z-index: 15;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 8px 14px 10px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.subnav-btn {
  border: none;
  border-radius: 10px;
  padding: 9px 0;
  font-size: 13px;
  background: #f5f7fa;
  color: #606266;
}

.subnav-btn--active {
  color: #409eff;
  background: #ecf5ff;
  font-weight: 600;
}
</style>
