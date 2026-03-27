import { BaaS } from './client'

const USER_STATS_TABLE = 'user_stats'
const PAGE_SIZE = 100

const toNumberOrZero = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const normalizeStats = (item) => ({
  id: item?.id || '',
  user_id: String(item?.user_id || '').trim(),
  level: String(item?.level || '').trim() || '-',
  tournament_count: toNumberOrZero(item?.tournament_count),
  match_count: toNumberOrZero(item?.match_count),
  win_rate: toNumberOrZero(item?.win_rate),
})

const findAll = async (table, query = null) => {
  if (query) {
    table.setQuery(query)
  }

  const records = []
  let offset = 0

  while (true) {
    table.limit(PAGE_SIZE)
    table.offset(offset)
    table.orderBy('-updated_at')

    const result = await table.find()
    const objects = result?.data?.objects || []
    records.push(...objects)

    if (objects.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return records
}

export const listUserStatsMap = async (userIds = []) => {
  const table = new BaaS.TableObject(USER_STATS_TABLE)
  let records = []

  if (Array.isArray(userIds) && userIds.length) {
    const query = new BaaS.Query()
    query.in('user_id', userIds.map((item) => String(item)))
    records = await findAll(table, query)
  } else {
    records = await findAll(table)
  }

  const map = {}
  records.forEach((item) => {
    const normalized = normalizeStats(item)
    if (normalized.user_id) {
      map[normalized.user_id] = normalized
    }
  })
  return map
}

export const upsertUserStats = async ({
  userId,
  level = '-',
  tournamentCount = 0,
  matchCount = 0,
  winRate = 0,
}) => {
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('缺少 userId')

  const table = new BaaS.TableObject(USER_STATS_TABLE)
  const query = new BaaS.Query()
  query.compare('user_id', '=', uid)
  table.setQuery(query)
  table.limit(1)

  const found = await table.find()
  const current = found?.data?.objects?.[0]

  const payload = {
    user_id: uid,
    level: String(level || '-'),
    tournament_count: toNumberOrZero(tournamentCount),
    match_count: toNumberOrZero(matchCount),
    win_rate: toNumberOrZero(winRate),
  }

  if (current?.id) {
    const record = table.getWithoutData(current.id)
    record.set(payload)
    await record.update()
  } else {
    const record = table.create()
    record.set(payload)
    await record.save()
  }
}
