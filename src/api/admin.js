import { BaaS } from './client'
import userBaseDraft from '../../cloud-schema/user-base-draft.json'
import { listUserStatsMap } from './user-stats'

const USER_PROFILE_TABLE = '_userprofile'
const PAGE_SIZE = 1000
const PROFILE_SELECT_KEYS = ['id', 'nickname', 'gender', 'level', 'updated_at']
const DEFAULT_USER_STATS = {
  level: '-',
  tournament_count: 0,
  match_count: 0,
  win_rate: 0,
}
const AUTH_CACHE_KEY = 'grouping_auth_user'
const SESSION_STORAGE_KEYS = [
  'ifx_baas_auth_token',
  'ifx_baas_uid',
  'ifx_baas_session_expires_at',
  'ifx_baas_is_anonymous_user',
  'ifx_baas_userinfo',
]

const genderMap = {
  0: '未知',
  1: '男',
  2: '女',
}

const parseGender = (value) => {
  const gender = Number(value)
  return Number.isInteger(gender) && [0, 1, 2].includes(gender) ? gender : 0
}

const parseGenderFromItem = (item) => {
  const genderByNumber = parseGender(item?.gender)
  if (genderByNumber !== 0 || Number(item?.gender) === 0) return genderByNumber

  const genderByCustom = parseGender(item?.gender_value)
  if (genderByCustom !== 0 || Number(item?.gender_value) === 0) return genderByCustom

  const genderText = String(item?.gender_text || '').trim()
  if (genderText === '男') return 1
  if (genderText === '女') return 2

  return 0
}

const normalizeDraftUsers = (users) => {
  if (!Array.isArray(users)) return []

  return users
    .filter((item) => item && typeof item.nickname === 'string' && item.nickname.trim())
    .map((item) => {
      const gender = parseGender(item.gender)
      return {
        nickname: item.nickname.trim(),
        gender,
        gender_text: genderMap[gender],
      }
    })
}

const normalizeLevel = (value) => {
  const text = String(value ?? '').trim()
  if (!text || text === '-') return ''
  const number = Number(text)
  return Number.isFinite(number) ? String(number) : text
}

const normalizeFinalLevel = (statsLevel, profileLevel) =>
  normalizeLevel(statsLevel) || normalizeLevel(profileLevel) || '-'

const snapshotSession = () => {
  const snapshot = {
    authCache: localStorage.getItem(AUTH_CACHE_KEY),
    sdkSession: {},
  }

  SESSION_STORAGE_KEYS.forEach((key) => {
    snapshot.sdkSession[key] = localStorage.getItem(key)
  })

  return snapshot
}

const restoreSession = (snapshot) => {
  if (!snapshot) return

  if (snapshot.authCache === null) {
    localStorage.removeItem(AUTH_CACHE_KEY)
  } else {
    localStorage.setItem(AUTH_CACHE_KEY, snapshot.authCache)
  }

  SESSION_STORAGE_KEYS.forEach((key) => {
    const value = snapshot.sdkSession?.[key]
    if (value === null || value === undefined) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  })
}

// 查询用户
export const listAllUsers = async () => {
  const table = new BaaS.TableObject(USER_PROFILE_TABLE)
  const allItems = []
  let offset = 0
  let useSelectKeys = true

  while (true) {
    table.limit(PAGE_SIZE)
    table.offset(offset)
    table.orderBy('-updated_at')

    if (useSelectKeys) {
      table.select(PROFILE_SELECT_KEYS)
    }

    let result
    try {
      result = await table.find()
    } catch (error) {
      const message = String(error?.message || error?.data?.error_msg || '')
      if (useSelectKeys && message.includes('Included invalid filter key')) {
        useSelectKeys = false
        result = await table.find()
      } else {
        throw error
      }
    }
    const objects = result?.data?.objects || []

    allItems.push(...objects)

    if (objects.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const baseUsers = allItems.map((item) => {
    const gender = parseGenderFromItem(item)
    return {
      ...item,
      id: item.id || item.user_id || '',
      user_id: item.user_id || item.id || '',
      nickname: item.nickname || '',
      gender,
      gender_text: genderMap[gender],
      level: normalizeLevel(item.level) || '-',
      updated_at: item.updated_at || '',
    }
  })

  const userIds = baseUsers
    .map((item) => String(item.user_id || '').trim())
    .filter(Boolean)
  const statsMap = await listUserStatsMap(userIds)

  return baseUsers.map((item) => {
    const stats = statsMap[item.user_id] || DEFAULT_USER_STATS
    return {
      ...item,
      ...stats,
      level: normalizeFinalLevel(stats.level, item.level),
    }
  })
}

// 批量导入用户
export const importDraftUsers = async () => {
  const users = normalizeDraftUsers(userBaseDraft)
  if (!users.length) return { inserted: 0, total: 0 }

  let inserted = 0
  const failed = []
  const sessionSnapshot = snapshotSession()

  try {
    for (let index = 0; index < users.length; index += 1) {
      const item = users[index]
      const username = item.nickname
      const password = '123456'

      try {
        await BaaS.auth.register({ username, password })
        const currentUser = await BaaS.auth.getCurrentUser()

        if (!currentUser) {
          throw new Error('注册成功但未获取到用户对象')
        }

        currentUser.set('nickname', item.nickname)
        currentUser.set('gender', item.gender)
        currentUser.set('gender_value', item.gender)
        await currentUser.update()

        inserted += 1
      } catch (error) {
        failed.push({
          nickname: item.nickname,
          message: error?.message || '注册失败',
        })
      }
    }
  } finally {
    restoreSession(sessionSnapshot)
  }

  return {
    inserted,
    total: users.length,
    failed,
  }
}
