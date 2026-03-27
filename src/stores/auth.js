import { defineStore } from 'pinia'
import { getCurrentUser, loginWithAccount, logoutRequest, registerWithAccount } from '../api/auth'
import { listUserPermissionCodes } from '../api/permission'

const AUTH_STORAGE_KEY = 'grouping_auth_user'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    permissionCodes: [],
    permissionsLoaded: false,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.user?.id),
    isAdmin: (state) => {
      const whitelist = (import.meta.env.VITE_ADMIN_USER_IDS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      if (!whitelist.length) return false
      return whitelist.includes(String(state.user?.id || ''))
    },
    hasPermission: (state) => (permissionCode) =>
      state.permissionCodes.includes(String(permissionCode || '')),
  },
  actions: {
    async restore() {
      if (this.initialized) return
      const cached = localStorage.getItem(AUTH_STORAGE_KEY)
      if (cached) {
        this.user = JSON.parse(cached)
      }
      try {
        const current = await getCurrentUser()
        if (current) {
          this.user = current
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(current))
          await this.loadPermissions()
        } else {
          this.user = null
          this.permissionCodes = []
          this.permissionsLoaded = false
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        this.user = null
        this.permissionCodes = []
        this.permissionsLoaded = false
      }
      this.initialized = true
    },
    async loadPermissions(force = false) {
      if (!this.user?.id) {
        this.permissionCodes = []
        this.permissionsLoaded = false
        return []
      }
      if (this.permissionsLoaded && !force) return this.permissionCodes

      try {
        this.permissionCodes = await listUserPermissionCodes(this.user.id)
      } catch {
        this.permissionCodes = []
      }
      this.permissionsLoaded = true
      return this.permissionCodes
    },
    async login(payload) {
      const user = await loginWithAccount(payload)
      this.user = user
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
      await this.loadPermissions(true)
      return user
    },
    async register(payload) {
      const user = await registerWithAccount(payload)
      this.user = user
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
      await this.loadPermissions(true)
      return user
    },
    async logout() {
      await logoutRequest()
      this.user = null
      this.permissionCodes = []
      this.permissionsLoaded = false
      localStorage.removeItem(AUTH_STORAGE_KEY)
    },
  },
})
