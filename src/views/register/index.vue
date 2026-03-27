<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { showErrorMessage } from '../../utils/error'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const registerLoading = ref(false)
const registerFormRef = ref(null)
const registerFormModel = reactive({
  account: '',
  password: '',
  confirmPassword: '',
  gender: '',
})

const validateConfirmPassword = (_, value, callback) => {
  if (!value) {
    callback(new Error('请再次输入密码'))
    return
  }
  if (value !== registerFormModel.password) {
    callback(new Error('两次输入的密码不一致'))
    return
  }
  callback()
}

const registerRules = {
  account: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
}

const getRedirectPath = () => route.query.redirect || '/home'

const onRegister = async () => {
  try {
    registerLoading.value = true
    await registerFormRef.value.validate()
    await authStore.register({
      account: registerFormModel.account,
      password: registerFormModel.password,
      gender: registerFormModel.gender,
    })
    ElMessage.success('注册成功，已自动登录')
    router.replace(getRedirectPath())
  } catch (error) {
    showErrorMessage(error)
  } finally {
    registerLoading.value = false
  }
}

const toLogin = () => {
  const redirect = route.query.redirect ? { redirect: route.query.redirect } : undefined
  router.push({ name: 'login', query: redirect })
}
</script>

<template>
  <div class="register-page">
    <div class="register-brand">
      <h1>创建账号</h1>
      <p>注册后可直接进入移动端首页</p>
    </div>

    <el-card class="register-card" shadow="never">
      <el-form
        ref="registerFormRef"
        :model="registerFormModel"
        :rules="registerRules"
        label-position="top"
      >
        <el-form-item label="账号" prop="account">
          <el-input v-model="registerFormModel.account" size="large" placeholder="请输入登录名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="registerFormModel.password" size="large" placeholder="请输入密码" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="registerFormModel.confirmPassword" placeholder="请输入密码"
            size="large"
            type="password"
            show-password
          />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-select
            v-model="registerFormModel.gender"
            size="large"
            placeholder="请选择性别"
            style="width: 100%"
          >
            <el-option label="男" :value="1" />
            <el-option label="女" :value="2" />
            <el-option label="未知" :value="0" />
          </el-select>
        </el-form-item>
        <el-button type="primary" size="large" :loading="registerLoading" style="width: 100%" @click="onRegister">
          确认注册
        </el-button>
      </el-form>

      <div class="footer-actions">
        <span class="hint">已有账号？</span>
        <el-button type="primary" link @click="toLogin">返回登录</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(180deg, #eaf3ff 0%, #f5f7fa 35%, #f5f7fa 100%);
  padding: 16px;
  gap: 14px;
}

.register-brand {
  text-align: center;
}

.register-brand h1 {
  margin: 0;
  font-size: 26px;
  color: #1f2d3d;
}

.register-brand p {
  margin: 8px 0 0;
  color: #607080;
  font-size: 13px;
}

.register-card {
  width: min(420px, calc(100vw - 32px));
  margin: 0 auto;
  border-radius: 16px;
  border: 1px solid #e6ecf5;
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
  .register-page {
    justify-content: flex-start;
    padding-top: 46px;
  }
}
</style>
