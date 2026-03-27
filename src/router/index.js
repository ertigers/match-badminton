import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login/index.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/register/index.vue'),
  },
  {
    path: '/',
    component: () => import('../views/mobile/index.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/home' },
      {
        path: '/home',
        name: 'home',
        component: () => import('../views/home/index.vue'),
      },
      {
        path: '/mine',
        name: 'mine',
        component: () => import('../views/mine/index.vue'),
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('../views/admin/layout.vue'),
    meta: { requiresAuth: true, requiresPermission: 'admin' },
    children: [
      { path: '', redirect: '/admin/users' },
      {
        path: 'users',
        name: 'admin-users',
        component: () => import('../views/admin/index.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin',
          title: '用户管理',
        },
      },
      {
        path: 'permissions',
        name: 'admin-permissions',
        component: () => import('../views/admin/permissions.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin',
          title: '权限管理',
        },
      },
    ],
  },
  {
    path: '/matchs',
    component: () => import('../layouts/subpage-layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/matchs/my' },
      {
        path: 'create',
        name: 'match-create',
        component: () => import('../views/match/create.vue'),
        meta: {
          requiresAuth: true,
          title: '创建比赛',
        },
      },
      {
        path: 'my',
        name: 'match-my-list',
        component: () => import('../views/match/my-list.vue'),
        meta: {
          requiresAuth: true,
          title: '我参与的比赛',
        },
      },
      {
        path: 'created',
        name: 'match-created-list',
        component: () => import('../views/match/created-list.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin-common',
          title: '我创建的比赛',
        },
      },
      {
        path: 'all',
        name: 'match-all-list',
        component: () => import('../views/match/all-list.vue'),
        meta: {
          requiresAuth: true,
          requiresPermission: 'admin',
          title: '全部比赛',
        },
      },
      {
        path: ':id',
        name: 'match-detail',
        component: () => import('../views/match/detail.vue'),
        meta: {
          requiresAuth: true,
          title: '比赛详情',
        },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.restore()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresPermission) {
    await authStore.loadPermissions()
    const hasRoutePermission = authStore.hasPermission(to.meta.requiresPermission)
    if (!hasRoutePermission && !authStore.isAdmin) {
      return { name: 'home' }
    }
  }

  if ((to.name === 'login' || to.name === 'register') && authStore.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})

export default router

