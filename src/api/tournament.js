import { BaaS } from './client'

const TOURNAMENT_TABLE = 'tournament'
const TOURNAMENT_PARTICIPANT_TABLE = 'tournament_participant'
const TOURNAMENT_TEAM_GROUP_TABLE = 'tournament_team_group'
const TOURNAMENT_TEAM_ASSIGNMENT_TABLE = 'tournament_team_assignment'
const TOURNAMENT_TEAM_MATCH_SCORE_TABLE = 'tournament_team_match_score'
const PAGE_SIZE = 100

export const TEAM_EVENT_OPTIONS = [
  {
    code: 'male_double',
    label: '男双',
    requiredPlayers: 2,
    slots: ['p1', 'p2'],
    minMale: 2,
    minFemale: 0,
  },
  {
    code: 'mixed_double',
    label: '混双',
    requiredPlayers: 2,
    slots: ['mixed_male', 'mixed_female'],
    minMale: 1,
    minFemale: 1,
  },
  {
    code: 'female_double',
    label: '女双',
    requiredPlayers: 2,
    slots: ['p1', 'p2'],
    minMale: 0,
    minFemale: 2,
  },
  {
    code: 'male_single',
    label: '男单',
    requiredPlayers: 1,
    slots: ['single'],
    minMale: 1,
    minFemale: 0,
  },
  {
    code: 'female_single',
    label: '女单',
    requiredPlayers: 1,
    slots: ['single'],
    minMale: 0,
    minFemale: 1,
  },
]

export const TEAM_SCORE_TARGET_OPTIONS = [15, 21, 31]

export const TEAM_EVENT_SCHEDULE_MODES = [
  { value: 'uniform', label: '所有轮次使用相同项目' },
  { value: 'per_round', label: '每轮单独设置项目' },
]

export const TOURNAMENT_STAGES = [
  'participant_adjusting',
  'team_configuring',
  'grouping',
  'rounds_in_progress',
  'finished',
]

export const ROUND_STATES = ['waiting_lineup', 'playing', 'round_finished']

export const MATCH_MODES = [
  {
    code: 'fixed_mixed_rotate',
    label: '固定混双轮转',
    description: '固定搭档轮转对局',
    disabled: true,
    note: '暂未开放',
  },
  {
    code: 'random_mixed_rotate',
    label: '随机混双轮转',
    description: '每轮随机混双组合',
    disabled: false,
    note: '暂未开放',
  },
  {
    code: 'team',
    label: '团体赛',
    description: '按团队分组对抗',
    disabled: false,
  },
]

const normalizeParticipants = (participants) => {
  if (!Array.isArray(participants)) return []
  return participants
    .map((item) => ({
      user_id: String(item?.user_id || item?.id || '').trim(),
      nickname: String(item?.nickname || '').trim(),
    }))
    .filter((item) => item.user_id)
}

const TEAM_EVENT_CODE_SET = new Set(TEAM_EVENT_OPTIONS.map((item) => item.code))

const parseMaybeJsonArray = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return text
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }
  return []
}

const normalizeTeamEventCodes = (eventCodes) => {
  const rawList = parseMaybeJsonArray(eventCodes)
  if (!Array.isArray(rawList)) return []
  return rawList
    .map((item) => String(item || '').trim())
    .filter((item) => TEAM_EVENT_CODE_SET.has(item))
}

export const getTeamEventLabel = (eventCode) => {
  const code = String(eventCode || '').trim()
  return TEAM_EVENT_OPTIONS.find((item) => item.code === code)?.label || code
}

export const getTeamEventInstances = (eventCodes) => {
  const normalizedEventCodes = normalizeTeamEventCodes(eventCodes)
  const totalMap = normalizedEventCodes.reduce((result, code) => {
    result.set(code, Number(result.get(code) || 0) + 1)
    return result
  }, new Map())
  const occurrenceMap = new Map()

  return normalizedEventCodes.map((eventCode) => {
    const eventNo = Number(occurrenceMap.get(eventCode) || 0) + 1
    occurrenceMap.set(eventCode, eventNo)
    const repeated = Number(totalMap.get(eventCode) || 0) > 1
    return {
      eventCode,
      eventNo,
      label: `${getTeamEventLabel(eventCode)}${repeated ? ` ${eventNo}` : ''}`,
    }
  })
}

export const calculateTeamMinPlayersPerGroup = (eventCodes) => {
  const normalizedEventCodes = normalizeTeamEventCodes(eventCodes)
  return normalizedEventCodes.reduce((sum, code) => {
    const event = TEAM_EVENT_OPTIONS.find((item) => item.code === code)
    return sum + Number(event?.requiredPlayers || 0)
  }, 0)
}

export const calculateTeamGenderRequirementPerGroup = (eventCodes) => {
  const normalizedEventCodes = normalizeTeamEventCodes(eventCodes)
  return normalizedEventCodes.reduce(
    (result, code) => {
      const event = TEAM_EVENT_OPTIONS.find((item) => item.code === code)
      result.male += Number(event?.minMale || 0)
      result.female += Number(event?.minFemale || 0)
      return result
    },
    { male: 0, female: 0 }
  )
}

const normalizeTeamScheduleMode = (value) =>
  String(value || '') === 'per_round' ? 'per_round' : 'uniform'

const normalizeRoundEventCodes = (roundEventCodes, roundCount) => {
  const source = Array.isArray(roundEventCodes) ? roundEventCodes : []
  return Array.from({ length: roundCount }, (_, index) =>
    normalizeTeamEventCodes(source[index] || [])
  )
}

export const getTeamRoundEventCodes = (teamConfig, roundNo) => {
  const roundCount = Math.max(1, Number(teamConfig?.roundCount || teamConfig?.round_count || 1))
  const targetRoundNo = Math.min(roundCount, Math.max(1, Number(roundNo || 1)))
  const scheduleMode = normalizeTeamScheduleMode(
    teamConfig?.scheduleMode || teamConfig?.schedule_mode
  )
  if (scheduleMode === 'per_round') {
    const roundEventCodes = normalizeRoundEventCodes(
      teamConfig?.roundEventCodes || teamConfig?.round_event_codes || [],
      roundCount
    )
    return roundEventCodes[targetRoundNo - 1] || []
  }
  return normalizeTeamEventCodes(teamConfig?.eventCodes || teamConfig?.event_codes || [])
}

export const calculateTeamRosterRequirement = (teamConfig = {}) => {
  const roundCount = Math.max(1, Number(teamConfig?.roundCount || teamConfig?.round_count || 1))
  let male = 0
  let female = 0
  const roundRequirements = []

  for (let roundNo = 1; roundNo <= roundCount; roundNo += 1) {
    const eventCodes = getTeamRoundEventCodes(teamConfig, roundNo)
    const genderRequirement = calculateTeamGenderRequirementPerGroup(eventCodes)
    const total = calculateTeamMinPlayersPerGroup(eventCodes)
    male = Math.max(male, genderRequirement.male)
    female = Math.max(female, genderRequirement.female)
    roundRequirements.push({ roundNo, total, ...genderRequirement })
  }

  return {
    total: male + female,
    male,
    female,
    roundRequirements,
  }
}

const normalizeTeamConfig = (teamConfig = {}) => {
  const groupCount = Number(teamConfig?.groupCount || teamConfig?.team_group_count || 2)
  const roundCount = Number(teamConfig?.roundCount || teamConfig?.team_round_count || 1)
  const scoreTarget = Number(teamConfig?.scoreTarget || teamConfig?.team_score_target || 21)
  const scheduleMode = normalizeTeamScheduleMode(
    teamConfig?.scheduleMode || teamConfig?.schedule_mode || teamConfig?.team_event_schedule_mode
  )
  const eventCodes = normalizeTeamEventCodes(
    teamConfig?.eventCodes || teamConfig?.event_codes || teamConfig?.team_event_codes || []
  )
  const roundEventCodes = normalizeRoundEventCodes(
    teamConfig?.roundEventCodes ||
      teamConfig?.round_event_codes ||
      teamConfig?.team_round_event_codes ||
      [],
    roundCount
  )

  if (groupCount < 2 || !Number.isInteger(groupCount)) throw new Error('分队组数至少为 2 组')
  if (roundCount < 1 || !Number.isInteger(roundCount)) throw new Error('轮数至少为 1 轮')
  if (!TEAM_SCORE_TARGET_OPTIONS.includes(scoreTarget))
    throw new Error('对局分值仅支持 15 / 21 / 31')
  if (scheduleMode === 'uniform' && !eventCodes.length) throw new Error('请至少选择 1 个团体项目')
  if (scheduleMode === 'per_round') {
    const emptyRoundIndex = roundEventCodes.findIndex((codes) => !codes.length)
    if (emptyRoundIndex >= 0)
      throw new Error(`请至少为第 ${emptyRoundIndex + 1} 轮选择 1 个团体项目`)
  }

  const effectiveRoundEventCodes =
    scheduleMode === 'per_round'
      ? roundEventCodes
      : Array.from({ length: roundCount }, () => [...eventCodes])
  const rosterRequirement = calculateTeamRosterRequirement({
    scheduleMode,
    eventCodes,
    roundEventCodes: effectiveRoundEventCodes,
    roundCount,
  })

  return {
    groupCount,
    roundCount,
    scoreTarget,
    scheduleMode,
    eventCodes,
    roundEventCodes: effectiveRoundEventCodes,
    minPlayersPerGroup: rosterRequirement.total,
    rosterRequirement,
  }
}

export const getTeamEventSlots = (eventCodes) =>
  getTeamEventInstances(eventCodes).flatMap(({ eventCode, eventNo }) => {
    const event = TEAM_EVENT_OPTIONS.find((item) => item.code === eventCode)
    if (!event) return []
    return (event.slots || []).map((slotCode) => ({
      eventCode,
      eventNo,
      slotCode,
    }))
  })

const serializeJsonArray = (value) => JSON.stringify(Array.isArray(value) ? value : [])

const normalizeTournamentStage = (stage) => {
  const value = String(stage || '').trim()
  if (TOURNAMENT_STAGES.includes(value)) return value
  return 'participant_adjusting'
}

const normalizeRoundState = (state) => {
  const value = String(state || '').trim()
  if (value === 'lineup_submitted' || value === 'scoring') return 'playing'
  if (ROUND_STATES.includes(value)) return value
  return 'waiting_lineup'
}

const mapTournamentSchemaError = (error) => {
  const message = String(error?.message || error?.error_msg || '')
  if (
    !message.includes('Unexpected value of field') &&
    !message.includes('do not match the schema')
  )
    return error
  return new Error(
    `赛事表字段与请求不匹配：${message}。请在知晓云 tournament 表确认以下字段存在且类型正确：team_group_count(number)、team_round_count(number)、team_score_target(number)、team_min_players_per_group(number)、team_event_codes(string)、team_event_schedule_mode(string)、team_round_event_codes(string)、stage(string)、current_round_no(number)、current_round_state(string)。`
  )
}

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

const mapTournamentRecord = (item) => ({
  id: item?.id || '',
  name: item?.name || '未命名赛事',
  match_mode: item?.match_mode || '',
  status: item?.status || 'draft',
  participant_count: Number(item?.participant_count || 0),
  updated_at: item?.updated_at || '',
})

export const createTournament = async ({
  name,
  matchMode,
  participants,
  creatorUserId,
  teamConfig,
}) => {
  const tournamentName = String(name || '').trim()
  const mode = String(matchMode || '').trim()
  const participantList = normalizeParticipants(participants)

  if (!tournamentName) throw new Error('请输入赛事名称')
  if (!MATCH_MODES.some((item) => item.code === mode)) throw new Error('请选择对局方式')
  if (participantList.length < 2) throw new Error('至少选择 2 名参与人员')

  const normalizedTeamConfig = mode === 'team' ? normalizeTeamConfig(teamConfig) : null

  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const tournamentRecord = tournamentTable.create()
  tournamentRecord.set({
    name: tournamentName,
    match_mode: mode,
    status: 'draft',
    stage: 'participant_adjusting',
    current_round_no: 0,
    current_round_state: 'waiting_lineup',
    participant_count: participantList.length,
    created_by_user_id: String(creatorUserId || '').trim(),
    team_group_count: normalizedTeamConfig?.groupCount || null,
    team_event_codes: serializeJsonArray(normalizedTeamConfig?.eventCodes || []),
    team_event_schedule_mode: normalizedTeamConfig?.scheduleMode || null,
    team_round_event_codes: serializeJsonArray(normalizedTeamConfig?.roundEventCodes || []),
    team_round_count: normalizedTeamConfig?.roundCount || null,
    team_score_target: normalizedTeamConfig?.scoreTarget || null,
    team_min_players_per_group: normalizedTeamConfig?.minPlayersPerGroup || null,
  })

  let created = null
  try {
    created = await tournamentRecord.save()
  } catch (error) {
    throw mapTournamentSchemaError(error)
  }
  const tournamentId = created?.data?.id || created?.data?.id_str || created?.data?.object_id || ''
  const realTournamentId = tournamentId || tournamentRecord.id || ''
  if (!realTournamentId) throw new Error('创建赛事成功但未获取到赛事ID')

  const participantTable = new BaaS.TableObject(TOURNAMENT_PARTICIPANT_TABLE)
  for (const participant of participantList) {
    const record = participantTable.create()
    record.set({
      tournament_id: realTournamentId,
      user_id: participant.user_id,
      nickname: participant.nickname || participant.user_id,
      enabled: true,
    })
    await record.save()
  }

  return {
    id: realTournamentId,
    name: tournamentName,
    match_mode: mode,
    participant_count: participantList.length,
  }
}

export const getTournamentDetail = async (id) => {
  const tournamentId = String(id || '').trim()
  if (!tournamentId) throw new Error('缺少赛事ID')

  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const tournamentRecord = await tournamentTable.get(tournamentId)
  const tournament = tournamentRecord?.data || tournamentRecord || null
  if (!tournament) throw new Error('未找到赛事')

  const participantTable = new BaaS.TableObject(TOURNAMENT_PARTICIPANT_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', tournamentId)
  query.compare('enabled', '=', true)
  const participants = await findAll(participantTable, query)

  return {
    id: tournament.id || tournamentId,
    name: tournament.name || '',
    match_mode: tournament.match_mode || '',
    status: tournament.status || 'draft',
    stage: normalizeTournamentStage(tournament.stage),
    current_round_no: Number(tournament.current_round_no || 0),
    current_round_state: normalizeRoundState(tournament.current_round_state),
    created_by_user_id: String(tournament.created_by_user_id || ''),
    participant_count: Number(tournament.participant_count || participants.length || 0),
    team_config: {
      group_count: Number(tournament.team_group_count || 0),
      event_codes: normalizeTeamEventCodes(tournament.team_event_codes || ''),
      schedule_mode: normalizeTeamScheduleMode(tournament.team_event_schedule_mode),
      round_event_codes: normalizeRoundEventCodes(
        parseMaybeJsonArray(tournament.team_round_event_codes || ''),
        Math.max(1, Number(tournament.team_round_count || 1))
      ),
      round_count: Number(tournament.team_round_count || 0),
      score_target: Number(tournament.team_score_target || 0),
      min_players_per_group: Number(tournament.team_min_players_per_group || 0),
    },
    participants: participants.map((item) => ({
      id: item.id || '',
      user_id: item.user_id || '',
      nickname: item.nickname || '',
    })),
  }
}

export const updateTournamentTeamConfig = async ({ tournamentId, teamConfig }) => {
  const id = String(tournamentId || '').trim()
  if (!id) throw new Error('缺少赛事ID')

  const normalizedConfig = normalizeTeamConfig(teamConfig)
  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const record = tournamentTable.getWithoutData(id)
  record.set({
    team_group_count: normalizedConfig.groupCount,
    team_event_codes: serializeJsonArray(normalizedConfig.eventCodes),
    team_event_schedule_mode: normalizedConfig.scheduleMode,
    team_round_event_codes: serializeJsonArray(normalizedConfig.roundEventCodes),
    team_round_count: normalizedConfig.roundCount,
    team_score_target: normalizedConfig.scoreTarget,
    team_min_players_per_group: normalizedConfig.minPlayersPerGroup,
  })
  try {
    await record.update()
  } catch (error) {
    throw mapTournamentSchemaError(error)
  }

  return normalizedConfig
}

export const updateTournamentLifecycle = async ({
  tournamentId,
  stage,
  currentRoundNo,
  currentRoundState,
}) => {
  const id = String(tournamentId || '').trim()
  if (!id) throw new Error('缺少赛事ID')

  const payload = {}
  if (typeof stage !== 'undefined') payload.stage = normalizeTournamentStage(stage)
  if (typeof currentRoundNo !== 'undefined') payload.current_round_no = Number(currentRoundNo || 0)
  if (typeof currentRoundState !== 'undefined')
    payload.current_round_state = normalizeRoundState(currentRoundState)
  if (!Object.keys(payload).length) return null

  if (payload.stage === 'rounds_in_progress') {
    payload.status = 'running'
  } else if (payload.stage === 'finished') {
    payload.status = 'finished'
  } else if (typeof payload.stage !== 'undefined') {
    payload.status = 'draft'
  } else if (
    typeof payload.current_round_no !== 'undefined' ||
    typeof payload.current_round_state !== 'undefined'
  ) {
    payload.status = 'running'
  }

  const table = new BaaS.TableObject(TOURNAMENT_TABLE)
  const record = table.getWithoutData(id)
  record.set(payload)

  try {
    await record.update()
  } catch (error) {
    throw mapTournamentSchemaError(error)
  }

  return payload
}

const normalizeGroupList = (groups = []) =>
  (Array.isArray(groups) ? groups : [])
    .map((item) => {
      const groupNo = Number(item?.group_no)
      const memberUserIds = Array.from(
        new Set(
          parseMaybeJsonArray(item?.member_user_ids)
            .map((userId) => String(userId || '').trim())
            .filter(Boolean)
        )
      )
      return {
        group_no: groupNo,
        group_name: String(item?.group_name || `第${groupNo}组`).trim() || `第${groupNo}组`,
        member_user_ids: memberUserIds,
      }
    })
    .filter((item) => Number.isInteger(item.group_no) && item.group_no > 0)
    .sort((a, b) => a.group_no - b.group_no)

export const listTournamentTeamGroups = async (tournamentId) => {
  const id = String(tournamentId || '').trim()
  if (!id) return []

  const table = new BaaS.TableObject(TOURNAMENT_TEAM_GROUP_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  const records = await findAll(table, query)

  return normalizeGroupList(records)
}

export const saveTournamentTeamGroups = async ({ tournamentId, groups }) => {
  const id = String(tournamentId || '').trim()
  if (!id) throw new Error('缺少赛事ID')

  const normalizedGroups = normalizeGroupList(groups)
  if (!normalizedGroups.length) throw new Error('请至少配置 1 个分组')

  const duplicateGroupNo = normalizedGroups.find(
    (item, index) => normalizedGroups.findIndex((x) => x.group_no === item.group_no) !== index
  )
  if (duplicateGroupNo) throw new Error('分组编号不能重复')

  const table = new BaaS.TableObject(TOURNAMENT_TEAM_GROUP_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  const currentRecords = await findAll(table, query)

  const currentByGroupNo = new Map()
  currentRecords.forEach((item) => {
    const groupNo = Number(item?.group_no)
    if (!Number.isInteger(groupNo)) return
    currentByGroupNo.set(groupNo, item)
  })

  const nextByGroupNo = new Map()
  normalizedGroups.forEach((item) => {
    nextByGroupNo.set(item.group_no, item)
  })

  const toRemove = currentRecords.filter((item) => !nextByGroupNo.has(Number(item?.group_no)))
  const toCreate = normalizedGroups.filter((item) => !currentByGroupNo.has(item.group_no))
  const toUpdate = normalizedGroups.filter((item) => currentByGroupNo.has(item.group_no))

  for (const item of toRemove) {
    if (!item?.id) continue
    const record = table.getWithoutData(item.id)
    record.set('enabled', false)
    await record.update()
  }

  for (const item of toCreate) {
    const record = table.create()
    record.set({
      tournament_id: id,
      group_no: item.group_no,
      group_name: item.group_name,
      member_user_ids: serializeJsonArray(item.member_user_ids),
      enabled: true,
    })
    await record.save()
  }

  for (const item of toUpdate) {
    const current = currentByGroupNo.get(item.group_no)
    if (!current?.id) continue

    const record = table.getWithoutData(current.id)
    record.set({
      group_name: item.group_name,
      member_user_ids: serializeJsonArray(item.member_user_ids),
    })
    await record.update()
  }

  return normalizedGroups
}

const normalizeAssignmentList = (assignments = []) =>
  (Array.isArray(assignments) ? assignments : [])
    .map((item) => ({
      round_no: Number(item?.round_no),
      group_no: Number(item?.group_no),
      event_code: String(item?.event_code || '').trim(),
      event_no: Math.max(1, Number(item?.event_no || 1)),
      slot_code: String(item?.slot_code || '').trim(),
      user_id: String(item?.user_id || '').trim(),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.round_no) &&
        item.round_no > 0 &&
        Number.isInteger(item.group_no) &&
        item.group_no > 0 &&
        TEAM_EVENT_CODE_SET.has(item.event_code) &&
        Number.isInteger(item.event_no) &&
        item.slot_code &&
        item.user_id
    )

export const listTournamentTeamAssignments = async (tournamentId) => {
  const id = String(tournamentId || '').trim()
  if (!id) return []

  const table = new BaaS.TableObject(TOURNAMENT_TEAM_ASSIGNMENT_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  const records = await findAll(table, query)

  return normalizeAssignmentList(records).sort((a, b) => {
    if (a.round_no !== b.round_no) return a.round_no - b.round_no
    if (a.group_no !== b.group_no) return a.group_no - b.group_no
    if (a.event_code !== b.event_code)
      return String(a.event_code).localeCompare(String(b.event_code))
    if (a.event_no !== b.event_no) return a.event_no - b.event_no
    return String(a.slot_code).localeCompare(String(b.slot_code))
  })
}

const buildAssignmentKey = (item) =>
  [item.round_no, item.group_no, item.event_code, item.event_no, item.slot_code].join('::')

export const saveTournamentTeamAssignments = async ({ tournamentId, assignments }) => {
  const id = String(tournamentId || '').trim()
  if (!id) throw new Error('缺少赛事ID')

  const normalizedAssignments = normalizeAssignmentList(assignments)
  if (!normalizedAssignments.length) throw new Error('请至少保存 1 条排位记录')

  const duplicateKey = normalizedAssignments.find(
    (item, index) =>
      normalizedAssignments.findIndex((x) => buildAssignmentKey(x) === buildAssignmentKey(item)) !==
      index
  )
  if (duplicateKey) throw new Error('同轮次同分组同项目序号同位置存在重复记录')

  const table = new BaaS.TableObject(TOURNAMENT_TEAM_ASSIGNMENT_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  const currentRecords = await findAll(table, query)

  const currentByKey = new Map()
  currentRecords.forEach((item) => {
    const key = buildAssignmentKey(item)
    currentByKey.set(key, item)
  })

  const nextByKey = new Map()
  normalizedAssignments.forEach((item) => {
    nextByKey.set(buildAssignmentKey(item), item)
  })

  const toRemove = currentRecords.filter((item) => !nextByKey.has(buildAssignmentKey(item)))
  const toCreate = normalizedAssignments.filter(
    (item) => !currentByKey.has(buildAssignmentKey(item))
  )
  const toUpdate = normalizedAssignments.filter((item) =>
    currentByKey.has(buildAssignmentKey(item))
  )

  for (const item of toRemove) {
    if (!item?.id) continue
    const record = table.getWithoutData(item.id)
    record.set('enabled', false)
    await record.update()
  }

  for (const item of toCreate) {
    const record = table.create()
    record.set({
      tournament_id: id,
      round_no: item.round_no,
      group_no: item.group_no,
      event_code: item.event_code,
      event_no: item.event_no,
      slot_code: item.slot_code,
      user_id: item.user_id,
      enabled: true,
    })
    await record.save()
  }

  for (const item of toUpdate) {
    const current = currentByKey.get(buildAssignmentKey(item))
    if (!current?.id) continue
    const currentUserId = String(current?.user_id || '').trim()
    if (currentUserId === item.user_id) continue

    const record = table.getWithoutData(current.id)
    record.set('user_id', item.user_id)
    await record.update()
  }

  return normalizedAssignments
}

const normalizeMatchScoreList = (scores = []) =>
  (Array.isArray(scores) ? scores : [])
    .map((item) => ({
      round_no: Number(item?.round_no),
      event_code: String(item?.event_code || '').trim(),
      event_no: Math.max(1, Number(item?.event_no || 1)),
      home_group_no: Number(item?.home_group_no),
      away_group_no: Number(item?.away_group_no),
      home_score: Number(item?.home_score),
      away_score: Number(item?.away_score),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.round_no) &&
        item.round_no > 0 &&
        TEAM_EVENT_CODE_SET.has(item.event_code) &&
        Number.isInteger(item.event_no) &&
        Number.isInteger(item.home_group_no) &&
        item.home_group_no > 0 &&
        Number.isInteger(item.away_group_no) &&
        item.away_group_no > item.home_group_no &&
        Number.isInteger(item.home_score) &&
        item.home_score >= 0 &&
        Number.isInteger(item.away_score) &&
        item.away_score >= 0
    )

export const listTournamentTeamMatchScores = async (tournamentId) => {
  const id = String(tournamentId || '').trim()
  if (!id) return []

  const table = new BaaS.TableObject(TOURNAMENT_TEAM_MATCH_SCORE_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  const records = await findAll(table, query)

  return normalizeMatchScoreList(records).sort((a, b) => {
    if (a.round_no !== b.round_no) return a.round_no - b.round_no
    if (a.event_code !== b.event_code)
      return String(a.event_code).localeCompare(String(b.event_code))
    if (a.event_no !== b.event_no) return a.event_no - b.event_no
    if (a.home_group_no !== b.home_group_no) return a.home_group_no - b.home_group_no
    return a.away_group_no - b.away_group_no
  })
}

export const saveTournamentTeamMatchScore = async ({ tournamentId, score }) => {
  const id = String(tournamentId || '').trim()
  if (!id) throw new Error('缺少赛事ID')

  const normalized = normalizeMatchScoreList([score])[0]
  if (!normalized) throw new Error('比分参数无效，请检查轮次、分组与分值')

  const table = new BaaS.TableObject(TOURNAMENT_TEAM_MATCH_SCORE_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  query.compare('round_no', '=', normalized.round_no)
  query.compare('event_code', '=', normalized.event_code)
  query.compare('event_no', '=', normalized.event_no)
  query.compare('home_group_no', '=', normalized.home_group_no)
  query.compare('away_group_no', '=', normalized.away_group_no)
  const currentRecords = await findAll(table, query)
  const current = currentRecords[0] || null

  if (current?.id) {
    const record = table.getWithoutData(current.id)
    record.set({
      home_score: normalized.home_score,
      away_score: normalized.away_score,
      enabled: true,
    })
    await record.update()
  } else {
    const record = table.create()
    record.set({
      tournament_id: id,
      round_no: normalized.round_no,
      event_code: normalized.event_code,
      event_no: normalized.event_no,
      home_group_no: normalized.home_group_no,
      away_group_no: normalized.away_group_no,
      home_score: normalized.home_score,
      away_score: normalized.away_score,
      enabled: true,
    })
    await record.save()
  }

  return normalized
}

export const listMyParticipatingTournaments = async (userId) => {
  const uid = String(userId || '').trim()
  if (!uid) return []

  const participantTable = new BaaS.TableObject(TOURNAMENT_PARTICIPANT_TABLE)
  const participantQuery = new BaaS.Query()
  participantQuery.compare('user_id', '=', uid)
  participantQuery.compare('enabled', '=', true)
  const participantRecords = await findAll(participantTable, participantQuery)

  const tournamentIds = Array.from(
    new Set(
      participantRecords.map((item) => String(item?.tournament_id || '').trim()).filter(Boolean)
    )
  )
  if (!tournamentIds.length) return []

  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const tournamentQuery = new BaaS.Query()
  tournamentQuery.in('id', tournamentIds)
  const tournamentRecords = await findAll(tournamentTable, tournamentQuery)

  return tournamentRecords
    .map(mapTournamentRecord)
    .filter((item) => item.id)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
}

export const listMyCreatedTournaments = async (userId) => {
  const uid = String(userId || '').trim()
  if (!uid) return []

  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const query = new BaaS.Query()
  query.compare('created_by_user_id', '=', uid)
  const records = await findAll(tournamentTable, query)

  return records
    .map(mapTournamentRecord)
    .filter((item) => item.id)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
}

export const listAllTournaments = async () => {
  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const records = await findAll(tournamentTable)

  return records
    .map(mapTournamentRecord)
    .filter((item) => item.id)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
}

export const updateTournamentParticipants = async ({ tournamentId, participants }) => {
  const id = String(tournamentId || '').trim()
  const participantList = normalizeParticipants(participants)

  if (!id) throw new Error('缺少赛事ID')
  if (participantList.length < 2) throw new Error('至少保留 2 名参赛人员')

  const participantTable = new BaaS.TableObject(TOURNAMENT_PARTICIPANT_TABLE)
  const query = new BaaS.Query()
  query.compare('tournament_id', '=', id)
  query.compare('enabled', '=', true)
  const currentRecords = await findAll(participantTable, query)

  const currentByUserId = new Map()
  currentRecords.forEach((item) => {
    const userId = String(item?.user_id || '').trim()
    if (!userId) return
    currentByUserId.set(userId, item)
  })

  const nextByUserId = new Map()
  participantList.forEach((item) => {
    nextByUserId.set(item.user_id, item)
  })

  const toAdd = participantList.filter((item) => !currentByUserId.has(item.user_id))
  const toRemove = currentRecords.filter(
    (item) => !nextByUserId.has(String(item?.user_id || '').trim())
  )
  const toUpdate = participantList.filter((item) => currentByUserId.has(item.user_id))

  for (const item of toRemove) {
    if (!item?.id) continue
    const record = participantTable.getWithoutData(item.id)
    record.set('enabled', false)
    await record.update()
  }

  for (const item of toAdd) {
    const record = participantTable.create()
    record.set({
      tournament_id: id,
      user_id: item.user_id,
      nickname: item.nickname || item.user_id,
      enabled: true,
    })
    await record.save()
  }

  for (const item of toUpdate) {
    const current = currentByUserId.get(item.user_id)
    if (!current?.id) continue
    const currentNickname = String(current?.nickname || '').trim()
    const nextNickname = String(item.nickname || item.user_id).trim()
    if (currentNickname === nextNickname) continue

    const record = participantTable.getWithoutData(current.id)
    record.set('nickname', nextNickname)
    await record.update()
  }

  const tournamentTable = new BaaS.TableObject(TOURNAMENT_TABLE)
  const tournamentRecord = tournamentTable.getWithoutData(id)
  tournamentRecord.set('participant_count', participantList.length)
  await tournamentRecord.update()
}
