import { BaaS } from './client'

const normalizeUser = (user) => {
  if (!user) return null
  const rawLevel = user.level ?? ''
  const levelText = String(rawLevel).trim()
  return {
    id: user.id || user.user_id || user._id,
    name: user.nickname || user.username || user.email || user.phone || '用户',
    nickname: user.nickname || '',
    gender: Number.isInteger(user.gender) ? user.gender : 0,
    level: levelText || '-',
  }
}

const parseAccountPayload = (account, password) => {
  const value = account.trim()
  const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneRule = /^1\d{10}$/

  if (emailRule.test(value)) {
    return { email: value, password }
  }

  if (phoneRule.test(value)) {
    return { phone: value, password }
  }

  return { username: value, password }
}

export const registerWithAccount = async ({ account, password, gender }) => {
  if (!account || !password || gender === '' || gender === null || gender === undefined) {
    throw new Error('请输入账号、密码和性别')
  }

  const accountValue = account.trim()
  const payload = parseAccountPayload(accountValue, password)
  const result = await BaaS.auth.register(payload)
  const currentUser = await BaaS.auth.getCurrentUser()

  if (currentUser) {
    currentUser.set('nickname', accountValue)
    currentUser.set('gender', Number(gender))
    await currentUser.update()
  }

  const rawUser = result?.user || result
  const user = normalizeUser(rawUser)

  if (!user?.id) {
    throw new Error('注册成功但未获取到用户信息')
  }

  return {
    ...user,
    nickname: accountValue,
    gender: Number(gender),
  }
}

export const loginWithAccount = async ({ account, password }) => {
  if (!account || !password) {
    throw new Error('请输入账号和密码')
  }

  const payload = parseAccountPayload(account, password)
  const result = await BaaS.auth.login(payload)
  const rawUser = result?.user || result
  const user = normalizeUser(rawUser)

  if (!user?.id) {
    throw new Error('登录成功但未获取到用户信息')
  }

  return user
}

export const getCurrentUser = async () => {
  const result = await BaaS.auth.getCurrentUser()
  const rawUser = result?.user || result
  return normalizeUser(rawUser)
}

export const logoutRequest = async () => {
  await BaaS.auth.logout()
}

export const updateCurrentUserPassword = async ({ currentPassword, newPassword }) => {
  const password = String(currentPassword || '')
  const nextPassword = String(newPassword || '')

  if (!password) throw new Error('请输入当前密码')
  if (nextPassword.length < 6) throw new Error('新密码至少 6 位')
  if (password === nextPassword) throw new Error('新密码不能与当前密码相同')

  const currentUser = await BaaS.auth.getCurrentUser()
  if (!currentUser?.updatePassword) {
    throw new Error('当前账号不支持修改密码')
  }

  try {
    await currentUser.updatePassword({
      password,
      newPassword: nextPassword,
    })
  } catch (error) {
    const message =
      error?.data?.error_msg ||
      error?.data?.message ||
      error?.response?.data?.error_msg ||
      error?.message ||
      '密码修改失败，请确认当前密码是否正确'
    throw new Error(message)
  }
}
