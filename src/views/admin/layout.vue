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
  gap: 6px;
  padding: 8px 14px 10px;
  background: rgba(255, 255, 255, 0.88);
  border-bottom: 1px solid rgba(125, 139, 165, 0.12);
  backdrop-filter: blur(16px);
}

.subnav-btn {
  border: none;
  border-radius: 12px;
  padding: 10px 0;
  font-size: 13px;
  background: #f4f6fb;
  color: #70798b;
}

.subnav-btn--active {
  color: #425fe2;
  background: linear-gradient(135deg, #eef2ff, #e6ebff);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(79, 109, 245, 0.12);
}
</style>
