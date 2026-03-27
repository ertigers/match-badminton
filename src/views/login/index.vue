<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loginLoading = ref(false)
const loginFormRef = ref(null)
const loginFormModel = reactive({
  account: '',
  password: '',
})

const isMobile = ref(window.innerWidth <= 768)

const handleResize = () => {
  isMobile.value = window.innerWidth <= 768
}

const loginRules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const getRedirectPath = () => route.query.redirect || '/home'

const onLogin = async () => {
  try {
    loginLoading.value = true
    await loginFormRef.value.validate()
    await authStore.login(loginFormModel)
    router.replace(getRedirectPath())
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loginLoading.value = false
  }
}

const toRegister = () => {
  const redirect = route.query.redirect ? { redirect: route.query.redirect } : undefined
  router.push({ name: 'register', query: redirect })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="login-page">
    <div class="login-brand">
      <h1>上树VIP系统</h1>
      <p>快乐，交流，进步，羽球</p>
    </div>

    <el-card class="login-card" shadow="never">
      <h2 class="title">欢迎登录</h2>
      <el-form ref="loginFormRef" :model="loginFormModel" :rules="loginRules" label-position="top">
        <el-form-item label="账号" prop="account">
          <el-input v-model="loginFormModel.account" size="large" placeholder="请输入登录名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="loginFormModel.password" size="large" type="password" placeholder="请输入密码"  show-password />
        </el-form-item>
        <el-button type="primary" size="large" :loading="loginLoading" style="width: 100%" @click="onLogin">
          登录
        </el-button>
      </el-form>

      <div class="footer-actions">
        <span class="hint">没有账号？</span>
        <el-button type="primary" link @click="toRegister">立即注册</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(180deg, #eaf3ff 0%, #f5f7fa 35%, #f5f7fa 100%);
  padding: 16px;
  gap: 14px;
}

.login-brand {
  text-align: center;
}

.login-brand h1 {
  margin: 0;
  font-size: 26px;
  color: #1f2d3d;
}

.login-brand p {
  margin: 8px 0 0;
  color: #607080;
  font-size: 13px;
}

.login-card {
  width: min(420px, calc(100vw - 32px));
  margin: 0 auto;
  border-radius: 16px;
  border: 1px solid #e6ecf5;
}

.title {
  margin: 2px 0 14px;
  font-size: 20px;
}

.footer-actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.hint {
  color: #909399;
  font-size: 13px;
}

@media (max-width: 768px) {
  .login-page {
    justify-content: flex-start;
    padding-top: 46px;
  }

  .login-brand h1 {
    font-size: 24px;
  }
}
</style>
