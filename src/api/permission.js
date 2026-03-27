import { BaaS } from './client'

const PERMISSION_TABLE = 'permission'
const USER_PERMISSION_TABLE = 'user_permission'
const PAGE_SIZE = 100

const extractPermissionCode = (item) =>
  String(item?.permission_code || item?.code || item?.permission || '').trim()

const findAll = async (table, query = null) => {
  if (query) {
    table.setQuery(query)
  }

  const result = []
  let offset = 0

  while (true) {
    table.limit(PAGE_SIZE)
    table.offset(offset)
    table.orderBy('-updated_at')

    const response = await table.find()
    const objects = response?.data?.objects || []
    result.push(...objects)

    if (objects.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return result
}

export const listPermissions = async () => {
  const table = new BaaS.TableObject(PERMISSION_TABLE)
  const query = new BaaS.Query()
  query.compare('enabled', '=', true)

  const records = await findAll(table, query)
  return records
    .map((item) => ({
      id: item.id || '',
      code: String(item.code || '').trim(),
      name: String(item.name || '').trim(),
      enabled: item.enabled !== false,
      updated_at: item.updated_at || '',
    }))
    .filter((item) => item.code)
}

export const createPermission = async ({ code, name }) => {
  const permissionCode = String(code || '').trim()
  const permissionName = String(name || '').trim()

  if (!permissionCode) throw new Error('请输入权限码')
  if (!permissionName) throw new Error('请输入权限名称')

  const table = new BaaS.TableObject(PERMISSION_TABLE)
  const query = new BaaS.Query()
  query.compare('code', '=', permissionCode)
  query.compare('enabled', '=', true)

  const exists = await findAll(table, query)
  if (exists.length) {
    throw new Error('权限码已存在')
  }

  const record = table.create()
  record.set({
    code: permissionCode,
    name: permissionName,
    enabled: true,
  })
  await record.save()
}

export const listUserPermissionCodes = async (userId) => {
  if (!userId) return []

  const table = new BaaS.TableObject(USER_PERMISSION_TABLE)
  const query = new BaaS.Query()
  query.compare('user_id', '=', String(userId))
  query.compare('enabled', '=', true)
  const result = await findAll(table, query)

  return Array.from(
    new Set(
      result
        .map((item) => extractPermissionCode(item))
        .filter(Boolean)
    )
  )
}

export const grantPermissionToUser = async ({ userId, permissionCode }) => {
  const uid = String(userId || '').trim()
  const code = String(permissionCode || '').trim()

  if (!uid) throw new Error('请选择用户')
  if (!code) throw new Error('请选择权限')

  const table = new BaaS.TableObject(USER_PERMISSION_TABLE)
  const query = new BaaS.Query()
  query.compare('user_id', '=', uid)
  query.compare('permission_code', '=', code)
  query.compare('enabled', '=', true)

  const exists = await findAll(table, query)
  if (exists.length) {
    throw new Error('该用户已拥有此权限')
  }

  const record = table.create()
  record.set({
    user_id: uid,
    permission_code: code,
    enabled: true,
  })
  await record.save()
}

export const listUserPermissions = async () => {
  const table = new BaaS.TableObject(USER_PERMISSION_TABLE)
  const query = new BaaS.Query()
  query.compare('enabled', '=', true)

  const records = await findAll(table, query)
  return records
    .map((item) => ({
      id: item.id || '',
      user_id: String(item.user_id || '').trim(),
      permission_code: extractPermissionCode(item),
      updated_at: item.updated_at || '',
    }))
    .filter((item) => item.user_id && item.permission_code)
}

export const revokeUserPermission = async (id) => {
  const relationId = String(id || '').trim()
  if (!relationId) throw new Error('缺少授权记录ID')

  const table = new BaaS.TableObject(USER_PERMISSION_TABLE)
  const record = table.getWithoutData(relationId)
  record.set('enabled', false)
  await record.update()
}
