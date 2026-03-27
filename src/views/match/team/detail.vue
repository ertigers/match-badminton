<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { listAllUsers } from '../../../api/admin'
import {
  calculateTeamGenderRequirementPerGroup,
  calculateTeamMinPlayersPerGroup,
  getTeamEventSlots,
  getTournamentDetail,
  listTournamentTeamAssignments,
  listTournamentTeamMatchScores,
  listTournamentTeamGroups,
  MATCH_MODES,
  ROUND_STATES,
  saveTournamentTeamAssignments,
  saveTournamentTeamMatchScore,
  saveTournamentTeamGroups,
  TEAM_EVENT_OPTIONS,
  TEAM_SCORE_TARGET_OPTIONS,
  TOURNAMENT_STAGES,
  updateTournamentLifecycle,
  updateTournamentParticipants,
  updateTournamentTeamConfig,
} from '../../../api/tournament'
import { useAuthStore } from '../../../stores/auth'
import { showErrorMessage } from '../../../utils/error'
import TournamentParticipantsPanel from './components/tournament-participants-panel.vue'
import TournamentTeamConfigPanel from './components/tournament-team-config-panel.vue'
import TournamentTeamGroupsPanel from './components/tournament-team-groups-panel.vue'
import TournamentTeamLineupsPanel from './components/tournament-team-lineups-panel.vue'
import TournamentTeamMatchupsPanel from './components/tournament-team-matchups-panel.vue'

const route = useRoute()
const authStore = useAuthStore()

const loading = ref(false)
const detail = ref(null)
const users = ref([])

const savingParticipants = ref(false)
const participantEditorVisible = ref(false)
const selectedParticipantIds = ref([])

const savingTeamConfig = ref(false)
const savingTeamGroups = ref(false)
const savingTeamAssignments = ref(false)
const savingLifecycle = ref(false)
const matchupScoreDraft = ref({})
const savingMatchScore = ref(false)
const refreshingMatchups = ref(false)
const firstRoundLineupCollapsed = ref(true)

const teamForm = ref({
  groupCount: 2,
  eventCodes: ['mixed_double'],
  roundCount: 1,
  scoreTarget: 21,
})
const teamGroups = ref([])
const assignmentDraft = ref([])

const genderMap = { 0: '未知', 1: '男', 2: '女' }
const slotLabelMap = {
  p1: '1号位',
  p2: '2号位',
  single: '单打位',
  mixed_male: '混双男位',
  mixed_female: '混双女位',
}
const eventLabelMap = TEAM_EVENT_OPTIONS.reduce((result, item) => {
  result[item.code] = item.label
  return result
}, {})

const stageLabelMap = {
  participant_adjusting: '参赛人员调整',
  team_configuring: '团体赛参数设置',
  grouping: '分配分组成员',
  rounds_in_progress: '轮次进行中',
  finished: '全部比赛完成',
}

const roundStateLabelMap = {
  waiting_lineup: '等待排位提交',
  playing: '对局计分中',
  round_finished: '本轮已完成',
}

const currentStage = computed(() =>
  TOURNAMENT_STAGES.includes(String(detail.value?.stage || ''))
    ? String(detail.value?.stage)
    : 'participant_adjusting'
)
const currentRoundNo = computed(() => Number(detail.value?.current_round_no || 0))
const currentRoundState = computed(() =>
  ROUND_STATES.includes(String(detail.value?.current_round_state || ''))
    ? String(detail.value?.current_round_state)
    : 'waiting_lineup'
)

const isTeamMode = computed(() => detail.value?.match_mode === 'team')
const modeLabel = computed(() => {
  const code = detail.value?.match_mode
  return MATCH_MODES.find((item) => item.code === code)?.label || code || '-'
})

const userMap = computed(() => {
  const map = new Map()
  users.value.forEach((item) => map.set(String(item.user_id || item.id), item))
  return map
})
const participantUserIdSet = computed(
  () => new Set((detail.value?.participants || []).map((item) => String(item.user_id || '')))
)

const enrichedParticipants = computed(() =>
  (detail.value?.participants || []).map((item) => {
    const user = userMap.value.get(String(item.user_id || ''))
    const gender = Number(user?.gender)
    return {
      ...item,
      gender: Number.isFinite(gender) ? gender : 0,
      gender_text: genderMap[Number.isFinite(gender) ? gender : 0],
    }
  })
)
const participantOptions = computed(() =>
  enrichedParticipants.value.map((item) => ({
    label: item.nickname || item.user_id,
    value: String(item.user_id || ''),
    gender: Number(item.gender || 0),
  }))
)

const maleCount = computed(
  () => enrichedParticipants.value.filter((item) => Number(item.gender) === 1).length
)
const femaleCount = computed(
  () => enrichedParticipants.value.filter((item) => Number(item.gender) === 2).length
)

const teamMinPlayersPerGroup = computed(() =>
  calculateTeamMinPlayersPerGroup(teamForm.value.eventCodes)
)
const teamGenderRequirementPerGroup = computed(() =>
  calculateTeamGenderRequirementPerGroup(teamForm.value.eventCodes)
)

const currentUserId = computed(() => String(authStore.user?.id || ''))
const isTournamentCreator = computed(
  () =>
    String(detail.value?.created_by_user_id || '') &&
    String(detail.value?.created_by_user_id || '') === currentUserId.value
)
const hasAdminPermission = computed(() => authStore.isAdmin || authStore.hasPermission('admin'))
const hasManagerPermission = computed(() => hasAdminPermission.value || isTournamentCreator.value)
const isParticipantUser = computed(() => participantUserIdSet.value.has(currentUserId.value))
const currentEditableRoundNo = computed(() => Math.max(1, Number(currentRoundNo.value || 1)))
const currentUserGroupNos = computed(() =>
  teamGroups.value
    .filter((group) =>
      (Array.isArray(group?.member_user_ids) ? group.member_user_ids : []).some(
        (id) => String(id || '') === currentUserId.value
      )
    )
    .map((group) => Number(group.group_no))
    .filter((groupNo) => Number.isInteger(groupNo) && groupNo > 0)
)
const editableTeamGroupNos = computed(() => {
  if (currentUserGroupNos.value.length) return currentUserGroupNos.value
  if (hasAdminPermission.value) {
    return teamGroups.value
      .map((group) => Number(group.group_no))
      .filter((groupNo) => Number.isInteger(groupNo) && groupNo > 0)
  }
  return []
})
const previewTeamGroupNos = computed(() =>
  teamGroups.value
    .map((group) => Number(group.group_no))
    .filter((groupNo) => Number.isInteger(groupNo) && groupNo > 0)
)

const canManageParticipants = computed(() => hasManagerPermission.value)
const canEditTeamConfig = computed(() => isTeamMode.value && hasManagerPermission.value)
const canManageTeamGroups = computed(() => isTeamMode.value && hasManagerPermission.value)
const canEditTeamLineups = computed(
  () =>
    isTeamMode.value &&
    (hasManagerPermission.value || isParticipantUser.value) &&
    editableTeamGroupNos.value.length > 0
)
const canOperateLifecycle = computed(() => isTeamMode.value && hasManagerPermission.value)
const stageOrder = [
  'participant_adjusting',
  'team_configuring',
  'grouping',
  'rounds_in_progress',
  'finished',
]
const currentStageIndex = computed(() => {
  const index = stageOrder.indexOf(currentStage.value)
  return index >= 0 ? index : 0
})
const showParticipantSummary = computed(() => currentStageIndex.value >= 0)
const showParticipant = computed(() => currentStageIndex.value >= 1 && currentStageIndex.value <= 2)
const showTeamConfigSummary = computed(() => isTeamMode.value && currentStageIndex.value >= 2)
const showGroupSummary = computed(() => isTeamMode.value && currentStageIndex.value >= 3)
const showParticipantsPanel = computed(() => currentStageIndex.value === 0 )
const showTeamConfigPanel = computed(() => currentStageIndex.value === 1)
const showTeamGroupsPanel = computed(() => currentStageIndex.value === 2)
const showTeamLineupsPanel = computed(
  () =>
    isTeamMode.value &&
    currentStage.value === 'rounds_in_progress' &&
    currentRoundState.value === 'waiting_lineup'
)
const showTeamMatchupsPanel = computed(() => {
  if (!isTeamMode.value || currentStage.value !== 'rounds_in_progress') return false
  if (!['playing', 'round_finished'].includes(currentRoundState.value)) return false
  return isRoundLineupCompleted(currentRoundNo.value)
})
const teamConfigSummaryText = computed(() => {
  const eventLabels = TEAM_EVENT_OPTIONS.filter((item) => teamForm.value.eventCodes.includes(item.code)).map(
    (item) => item.label
  )
  return `分组 ${teamForm.value.groupCount} 组，项目 ${eventLabels.join(' / ') || '-'}，轮数 ${teamForm.value.roundCount}，分值 ${teamForm.value.scoreTarget}`
})
const groupSummaryList = computed(() =>
  teamGroups.value.map((group) => ({
    groupNo: group.group_no,
    memberNames: (group.member_user_ids || [])
      .map((id) => participantOptions.value.find((item) => item.value === String(id))?.label || id)
      .filter(Boolean),
  }))
)
const visibleSummaryRoundNos = computed(() => {
  const roundCount = Math.max(1, Number(teamForm.value.roundCount || 1))
  const currentRound = Math.max(0, Number(currentRoundNo.value || 0))
  const isWaitingLineupInProgress =
    currentStage.value === 'rounds_in_progress' && currentRoundState.value === 'waiting_lineup'
  const maxVisibleRound = isWaitingLineupInProgress ? currentRound - 1 : currentRound
  const visibleRoundCount = Math.min(roundCount, Math.max(0, maxVisibleRound))
  return Array.from({ length: visibleRoundCount }, (_, index) => index + 1)
})

const roundLineupSummaryList = computed(() => {
  return visibleSummaryRoundNos.value.map((roundNo) => {
    const groups = previewTeamGroupNos.value.map((groupNo) => {
      const group = teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))
      const allRows = getRowsByRoundGroup(roundNo, groupNo)
      const rows = teamForm.value.eventCodes.map((eventCode) => {
        const slotOrder = getEventSlots(eventCode)
        const eventRows = allRows
          .filter((item) => String(item.event_code) === String(eventCode))
          .sort((a, b) => slotOrder.indexOf(String(a.slot_code)) - slotOrder.indexOf(String(b.slot_code)))
        const memberNames = eventRows.map((item) => getUserLabel(item.user_id)).filter(Boolean)
        return {
          key: [roundNo, groupNo, eventCode].join('::'),
          text: `${eventLabelMap[eventCode] || eventCode}：${memberNames.join('+') || '-'}`,
        }
      })
      return {
        groupNo,
        groupName: group?.group_name || `第${groupNo}组`,
        rows,
      }
    })
    return { roundNo, groups }
  })
})
const roundScoreSummaryList = computed(() => {
  const eventCodes = Array.isArray(teamForm.value.eventCodes) ? teamForm.value.eventCodes : []
  const groupNos = [...previewTeamGroupNos.value].map((item) => Number(item)).filter((item) => item > 0)
  const scoreDraft = matchupScoreDraft.value || {}

  return visibleSummaryRoundNos.value.map((roundNo) => {
    const groupMap = new Map()
    groupNos.forEach((groupNo) => {
      const group = teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))
      groupMap.set(groupNo, {
        groupNo,
        groupName: group?.group_name || `第${groupNo}组`,
        totalMatches: 0,
        totalWinPoints: 0,
        totalScore: 0,
        totalConcededScore: 0,
        totalNetScore: 0,
        eventStats: eventCodes.reduce((result, eventCode) => {
          result[eventCode] = {
            eventCode,
            eventLabel: eventLabelMap[eventCode] || eventCode,
            matches: 0,
            winPoints: 0,
            totalScore: 0,
            concededScore: 0,
            netScore: 0,
          }
          return result
        }, {}),
      })
    })

    let roundScoredMatches = 0
    eventCodes.forEach((eventCode) => {
      for (let homeIndex = 0; homeIndex < groupNos.length; homeIndex += 1) {
        for (let awayIndex = homeIndex + 1; awayIndex < groupNos.length; awayIndex += 1) {
          const homeGroupNo = groupNos[homeIndex]
          const awayGroupNo = groupNos[awayIndex]
          const key = `${roundNo}-${eventCode}-${homeGroupNo}-${awayGroupNo}`
          const score = scoreDraft[key]
          const homeScore = Number(score?.homeScore)
          const awayScore = Number(score?.awayScore)
          if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue

          roundScoredMatches += 1
          const homeGroup = groupMap.get(homeGroupNo)
          const awayGroup = groupMap.get(awayGroupNo)
          if (!homeGroup || !awayGroup) continue

          const homeEvent = homeGroup.eventStats[eventCode]
          const awayEvent = awayGroup.eventStats[eventCode]
          homeEvent.matches += 1
          awayEvent.matches += 1
          homeEvent.totalScore += homeScore
          homeEvent.concededScore += awayScore
          awayEvent.totalScore += awayScore
          awayEvent.concededScore += homeScore
          if (homeScore > awayScore) homeEvent.winPoints += 1
          if (awayScore > homeScore) awayEvent.winPoints += 1
        }
      }
    })

    const groups = groupNos.map((groupNo) => {
      const group = groupMap.get(groupNo)
      const events = eventCodes.map((eventCode) => {
        const event = group.eventStats[eventCode]
        event.netScore = event.totalScore - event.concededScore
        return event
      })
      group.totalMatches = events.reduce((sum, item) => sum + item.matches, 0)
      group.totalWinPoints = events.reduce((sum, item) => sum + item.winPoints, 0)
      group.totalScore = events.reduce((sum, item) => sum + item.totalScore, 0)
      group.totalConcededScore = events.reduce((sum, item) => sum + item.concededScore, 0)
      group.totalNetScore = group.totalScore - group.totalConcededScore
      return {
        groupNo: group.groupNo,
        totalMatches: group.totalMatches,
        totalWinPoints: group.totalWinPoints,
        totalScore: group.totalScore,
        totalNetScore: group.totalNetScore,
        events,
      }
    })

    return {
      roundNo,
      roundScoredMatches,
      groups,
    }
  })
})
const getRoundScoreSummary = (roundNo) =>
  roundScoreSummaryList.value.find((item) => Number(item.roundNo) === Number(roundNo))
const getGroupScoreSummary = (roundNo, groupNo) =>
  getRoundScoreSummary(roundNo)?.groups?.find((item) => Number(item.groupNo) === Number(groupNo))
const liveRankingList = computed(() => {
  const rankMap = new Map()
  ;(roundScoreSummaryList.value || []).forEach((round) => {
    ;(round.groups || []).forEach((group) => {
      const groupNo = Number(group.groupNo)
      if (!rankMap.has(groupNo)) {
        rankMap.set(groupNo, {
          groupNo,
          groupName: teamGroups.value.find((item) => Number(item.group_no) === groupNo)?.group_name || `第${groupNo}组`,
          totalWinPoints: 0,
          totalNetScore: 0,
          totalScore: 0,
        })
      }
      const target = rankMap.get(groupNo)
      target.totalWinPoints += Number(group.totalWinPoints || 0)
      target.totalNetScore += Number(group.totalNetScore || 0)
      target.totalScore += Number(group.totalScore || 0)
    })
  })
  return [...rankMap.values()].sort((a, b) => {
    if (b.totalWinPoints !== a.totalWinPoints) return b.totalWinPoints - a.totalWinPoints
    if (b.totalNetScore !== a.totalNetScore) return b.totalNetScore - a.totalNetScore
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return a.groupNo - b.groupNo
  })
})
const showLiveRanking = computed(() => isTeamMode.value && liveRankingList.value.length > 0)
const isRoundLineupCompleted = (roundNo, groupNos = []) => {
  const groupNoSet = new Set((Array.isArray(groupNos) ? groupNos : []).map((item) => Number(item)))
  const rows = assignmentDraft.value.filter((item) => {
    if (Number(item.round_no) !== Number(roundNo)) return false
    if (!groupNoSet.size) return true
    return groupNoSet.has(Number(item.group_no))
  })
  if (!rows.length) return false
  return rows.every((item) => String(item.user_id || '').trim())
}
const showRoundLineupSummary = computed(() => {
  if (!isTeamMode.value || currentStageIndex.value < 3) return false
  return roundLineupSummaryList.value.length > 0
})

const getGenderLabel = (gender) => (Number(gender) === 1 ? '男' : Number(gender) === 2 ? '女' : '未知')
const getGenderTagType = (gender) => {
  if (Number(gender) === 1) return 'primary'
  if (Number(gender) === 2) return 'danger'
  return 'info'
}
const getUserLabel = (userId) =>
  participantOptions.value.find((item) => String(item.value) === String(userId))?.label || String(userId || '')
const getGroupLabel = (groupNo) =>
  teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))?.group_name || `第 ${groupNo} 组`
const getEventSlots = (eventCode) =>
  TEAM_EVENT_OPTIONS.find((item) => item.code === String(eventCode))?.slots || []
const getEventSideText = (roundNo, groupNo, eventCode) => {
  const rows = getRowsByRoundGroup(roundNo, groupNo).filter((item) => String(item.event_code) === String(eventCode))
  if (!rows.length) return '-'
  const slotOrder = getEventSlots(eventCode)
  const ordered = [...rows].sort(
    (a, b) => slotOrder.indexOf(String(a.slot_code)) - slotOrder.indexOf(String(b.slot_code))
  )
  return ordered.map((item) => getUserLabel(item.user_id)).filter(Boolean).join('\n') || '-'
}
const currentRoundMatchups = computed(() => {
  const roundNo = Number(currentRoundNo.value || 0)
  if (roundNo < 1) return []
  const groupNos = [...new Set(teamGroups.value.map((item) => Number(item.group_no)).filter((item) => item > 0))].sort(
    (a, b) => a - b
  )
  if (groupNos.length < 2) return []

  return teamForm.value.eventCodes.map((eventCode) => {
    const matches = []
    for (let homeIndex = 0; homeIndex < groupNos.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < groupNos.length; awayIndex += 1) {
        const homeGroupNo = groupNos[homeIndex]
        const awayGroupNo = groupNos[awayIndex]
        matches.push({
          key: `${roundNo}-${eventCode}-${homeGroupNo}-${awayGroupNo}`,
          homeLabel: getGroupLabel(homeGroupNo),
          awayLabel: getGroupLabel(awayGroupNo),
          homeValue: getEventSideText(roundNo, homeGroupNo, eventCode),
          awayValue: getEventSideText(roundNo, awayGroupNo, eventCode),
        })
      }
    }
    return {
      key: `event-${eventCode}`,
      eventLabel: eventLabelMap[eventCode] || eventCode,
      matches,
    }
  })
})
const onMatchScoreSubmit = ({ matchKey, homeScore, awayScore }) => {
  const key = String(matchKey || '')
  if (!key) return
  const [roundNoText, eventCode, homeGroupNoText, awayGroupNoText] = key.split('-')
  const roundNo = Number(roundNoText)
  const homeGroupNo = Number(homeGroupNoText)
  const awayGroupNo = Number(awayGroupNoText)
  const nextHome = Number(homeScore)
  const nextAway = Number(awayScore)
  if (
    !Number.isInteger(roundNo) ||
    !eventCode ||
    !Number.isInteger(homeGroupNo) ||
    !Number.isInteger(awayGroupNo) ||
    !Number.isInteger(nextHome) ||
    !Number.isInteger(nextAway)
  ) {
    ElMessage.error('比分参数无效，请重试')
    return
  }

  ;(async () => {
    try {
      savingMatchScore.value = true
      await saveTournamentTeamMatchScore({
        tournamentId: detail.value?.id,
        score: {
          round_no: roundNo,
          event_code: eventCode,
          home_group_no: homeGroupNo,
          away_group_no: awayGroupNo,
          home_score: nextHome,
          away_score: nextAway,
        },
      })
      matchupScoreDraft.value[key] = { homeScore: nextHome, awayScore: nextAway }
      ElMessage.success('比分已入库')
    } catch (error) {
      showErrorMessage(error)
    } finally {
      savingMatchScore.value = false
    }
  })()
}

const normalizeTeamGroups = (groups = [], groupCount = 2) => {
  const map = new Map()
  ;(Array.isArray(groups) ? groups : []).forEach((item) => {
    const groupNo = Number(item?.group_no)
    if (!Number.isInteger(groupNo) || groupNo < 1) return
    const memberUserIds = Array.from(
      new Set(
        (Array.isArray(item?.member_user_ids) ? item.member_user_ids : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    )
    map.set(groupNo, { group_no: groupNo, group_name: `第${groupNo}组`, member_user_ids: memberUserIds })
  })

  const result = []
  for (let index = 1; index <= groupCount; index += 1) {
    result.push(map.get(index) || { group_no: index, group_name: `第${index}组`, member_user_ids: [] })
  }
  return result
}

const buildAssignmentKey = (item) =>
  [item.round_no, item.group_no, item.event_code, item.slot_code].join('::')

const rebuildAssignmentDraft = (source = null) => {
  const sourceList = Array.isArray(source) ? source : assignmentDraft.value
  const sourceMap = new Map()
  sourceList.forEach((item) => sourceMap.set(buildAssignmentKey(item), String(item.user_id || '')))

  const rows = []
  const slots = getTeamEventSlots(teamForm.value.eventCodes)
  for (let roundNo = 1; roundNo <= Number(teamForm.value.roundCount || 1); roundNo += 1) {
    teamGroups.value.forEach((group) => {
      slots.forEach((slot) => {
        rows.push({
          round_no: roundNo,
          group_no: group.group_no,
          event_code: slot.eventCode,
          slot_code: slot.slotCode,
          user_id: sourceMap.get([roundNo, group.group_no, slot.eventCode, slot.slotCode].join('::')) || '',
        })
      })
    })
  }
  assignmentDraft.value = rows
}

const getRowsByRoundGroup = (roundNo, groupNo) =>
  assignmentDraft.value.filter(
    (item) => Number(item.round_no) === Number(roundNo) && Number(item.group_no) === Number(groupNo)
  )

const getGroupMemberOptions = (groupNo) => {
  const group = teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))
  if (!group) return []
  const memberSet = new Set(group.member_user_ids || [])
  return participantOptions.value.filter((item) => memberSet.has(item.value))
}
const getLineupMemberOptions = (roundNo, groupNo, eventCode, slotCode, currentUserId = '') => {
  const options = getGroupMemberOptions(groupNo)
  if (!eventCode) return options

  const code = String(eventCode)
  const slot = String(slotCode || '')
  const pickedInGroupRound = new Set(
    getRowsByRoundGroup(roundNo, groupNo)
      .filter(
        (row) =>
          !(String(row.event_code) === code && String(row.slot_code) === slot) &&
          String(row.user_id || '').trim()
      )
      .map((row) => String(row.user_id))
  )
  const selectedCurrent = String(currentUserId || '').trim()
  const dedupedOptions = options.filter(
    (item) => !pickedInGroupRound.has(String(item.value)) || String(item.value) === selectedCurrent
  )

  if (code === 'male_double' || code === 'male_single') {
    return dedupedOptions.filter((item) => Number(item.gender) === 1)
  }
  if (code === 'female_double' || code === 'female_single') {
    return dedupedOptions.filter((item) => Number(item.gender) === 2)
  }
  if (code === 'mixed_double') {
    if (slot === 'mixed_male') return dedupedOptions.filter((item) => Number(item.gender) === 1)
    if (slot === 'mixed_female') return dedupedOptions.filter((item) => Number(item.gender) === 2)
  }
  return dedupedOptions
}

const getGroupGenderStats = (group) => {
  const memberUserIds = Array.isArray(group?.member_user_ids) ? group.member_user_ids : []
  let maleCountValue = 0
  let femaleCountValue = 0
  let unknownCount = 0
  memberUserIds.forEach((userId) => {
    const user = participantOptions.value.find((item) => item.value === String(userId))
    if (Number(user?.gender) === 1) maleCountValue += 1
    else if (Number(user?.gender) === 2) femaleCountValue += 1
    else unknownCount += 1
  })
  return {
    totalCount: memberUserIds.length,
    maleCount: maleCountValue,
    femaleCount: femaleCountValue,
    unknownCount,
  }
}

const getAssignableParticipantOptions = (groupNo) => {
  const currentGroup = teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))
  if (!currentGroup) return []
  const currentSet = new Set(currentGroup.member_user_ids || [])
  const usedByOthers = new Set()
  teamGroups.value.forEach((group) => {
    if (Number(group.group_no) === Number(groupNo)) return
    ;(group.member_user_ids || []).forEach((id) => usedByOthers.add(String(id)))
  })
  const requiredTotal = Number(teamMinPlayersPerGroup.value || 0)
  const requiredMale = Number(teamGenderRequirementPerGroup.value.male || 0)
  const requiredFemale = Number(teamGenderRequirementPerGroup.value.female || 0)
  const stats = getGroupGenderStats(currentGroup)

  return participantOptions.value
    .filter((item) => currentSet.has(item.value) || !usedByOthers.has(item.value))
    .map((item) => {
      if (currentSet.has(item.value)) return { ...item, disabled: false }
      if (stats.totalCount >= requiredTotal) return { ...item, disabled: true }
      if (Number(item.gender) === 0) return { ...item, disabled: true }
      if (Number(item.gender) === 1 && stats.maleCount >= requiredMale) return { ...item, disabled: true }
      if (Number(item.gender) === 2 && stats.femaleCount >= requiredFemale) return { ...item, disabled: true }
      return { ...item, disabled: false }
    })
}

const autoFillLastGroupMembers = (changedGroupNo) => {
  const total = Number(teamForm.value.groupCount || 0)
  if (total < 2 || Number(changedGroupNo) !== total - 1) return

  const lastGroup = teamGroups.value.find((item) => Number(item.group_no) === total)
  const penultimateGroup = teamGroups.value.find((item) => Number(item.group_no) === total - 1)
  if (!lastGroup) return
  if (!penultimateGroup) return

  const usedByNonLast = new Set()
  teamGroups.value.forEach((group) => {
    if (Number(group.group_no) === total) return
    ;(group.member_user_ids || []).forEach((id) => usedByNonLast.add(String(id)))
  })

  const lastStats = getGroupGenderStats(lastGroup)
  const penultimateStats = getGroupGenderStats(penultimateGroup)
  const requiredTotal = Number(teamMinPlayersPerGroup.value || 0)
  const requiredMale = Number(teamGenderRequirementPerGroup.value.male || 0)
  const requiredFemale = Number(teamGenderRequirementPerGroup.value.female || 0)
  if (
    penultimateStats.totalCount !== requiredTotal ||
    penultimateStats.maleCount !== requiredMale ||
    penultimateStats.femaleCount !== requiredFemale ||
    penultimateStats.unknownCount > 0
  ) {
    return
  }

  const remainUserIds = participantOptions.value
    .map((item) => item.value)
    .filter((id) => !usedByNonLast.has(id))
  const remainStats = getGroupGenderStats({ member_user_ids: remainUserIds })
  if (
    remainStats.totalCount !== requiredTotal ||
    remainStats.maleCount !== requiredMale ||
    remainStats.femaleCount !== requiredFemale ||
    remainStats.unknownCount > 0
  ) {
    return
  }

  lastGroup.member_user_ids = remainUserIds
  const updatedLastStats = getGroupGenderStats(lastGroup)
  if (
    updatedLastStats.totalCount !== requiredTotal ||
    updatedLastStats.maleCount !== requiredMale ||
    updatedLastStats.femaleCount !== requiredFemale ||
    updatedLastStats.unknownCount > 0
  ) {
    ElMessage.warning('最后一组自动分配后未满足团体参数，请调整前面分组')
  }
}

const onGroupMembersChange = (groupNo) => {
  const group = teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))
  if (group) {
    const uniqueIds = Array.from(new Set((group.member_user_ids || []).map((id) => String(id || ''))))
    const optionSet = new Set(getAssignableParticipantOptions(groupNo).map((item) => item.value))
    group.member_user_ids = uniqueIds.filter((id) => optionSet.has(id))
  }
  autoFillLastGroupMembers(groupNo)
}

const syncTeamFormFromDetail = () => {
  const config = detail.value?.team_config || {}
  teamForm.value.groupCount = Math.max(2, Number(config.group_count || 2))
  teamForm.value.eventCodes =
    Array.isArray(config.event_codes) && config.event_codes.length ? config.event_codes : ['mixed_double']
  teamForm.value.roundCount = Math.max(1, Number(config.round_count || 1))
  teamForm.value.scoreTarget = TEAM_SCORE_TARGET_OPTIONS.includes(Number(config.score_target))
    ? Number(config.score_target)
    : 21
}

const buildScoreMap = (matchScores = [], roundNo) => {
  const hasRoundFilter = Number.isFinite(Number(roundNo))
  const targetRoundNo = Number(roundNo)
  const scoreMap = {}
  ;(Array.isArray(matchScores) ? matchScores : []).forEach((item) => {
    if (hasRoundFilter && Number(item.round_no) !== targetRoundNo) return
    const key = [item.round_no, item.event_code, item.home_group_no, item.away_group_no].join('-')
    scoreMap[key] = {
      homeScore: Number(item.home_score),
      awayScore: Number(item.away_score),
    }
  })
  return scoreMap
}

const loadTeamBusinessData = async () => {
  if (!isTeamMode.value || !detail.value?.id) return
  const [groups, assignments, matchScores] = await Promise.all([
    listTournamentTeamGroups(detail.value.id),
    listTournamentTeamAssignments(detail.value.id),
    listTournamentTeamMatchScores(detail.value.id),
  ])
  teamGroups.value = normalizeTeamGroups(groups, teamForm.value.groupCount)
  rebuildAssignmentDraft(assignments)
  matchupScoreDraft.value = buildScoreMap(matchScores)
}

const loadDetail = async () => {
  try {
    loading.value = true
    const [detailResult, userList] = await Promise.all([
      getTournamentDetail(route.params.id),
      listAllUsers(),
    ])
    detail.value = detailResult
    users.value = userList
    selectedParticipantIds.value = (detailResult?.participants || []).map((item) => String(item.user_id || ''))
    if (detailResult?.match_mode === 'team') {
      syncTeamFormFromDetail()
      await loadTeamBusinessData()
    }
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loading.value = false
  }
}
const onRefreshMatchups = async () => {
  if (refreshingMatchups.value || savingMatchScore.value || !detail.value?.id) return
  const roundNo = Number(currentRoundNo.value || 0)
  if (roundNo < 1) return
  try {
    refreshingMatchups.value = true
    const matchScores = await listTournamentTeamMatchScores(detail.value.id)
    const nextScoreMap = { ...(matchupScoreDraft.value || {}) }
    const roundPrefix = `${roundNo}-`
    Object.keys(nextScoreMap).forEach((key) => {
      if (String(key).startsWith(roundPrefix)) delete nextScoreMap[key]
    })
    Object.assign(nextScoreMap, buildScoreMap(matchScores, roundNo))
    matchupScoreDraft.value = nextScoreMap
  } catch (error) {
    showErrorMessage(error)
  } finally {
    refreshingMatchups.value = false
  }
}

const setLifecycle = async (payload) => {
  try {
    savingLifecycle.value = true
    await updateTournamentLifecycle({ tournamentId: detail.value?.id, ...payload })
    await loadDetail()
  } finally {
    savingLifecycle.value = false
  }
}

const validateGroups = () => {
  const participantSet = participantUserIdSet.value
  const requiredTotal = Number(teamMinPlayersPerGroup.value || 0)
  const requiredMale = Number(teamGenderRequirementPerGroup.value.male || 0)
  const requiredFemale = Number(teamGenderRequirementPerGroup.value.female || 0)
  const duplicateUserIdSet = new Set()
  const usedUserIdSet = new Set()

  for (const group of teamGroups.value) {
    const memberUserIds = Array.from(new Set(group.member_user_ids || []))
    if (memberUserIds.length !== requiredTotal) throw new Error(`${group.group_name} 人数必须为 ${requiredTotal}`)
    const stats = getGroupGenderStats({ member_user_ids: memberUserIds })
    if (stats.unknownCount > 0) throw new Error(`${group.group_name} 存在性别未知成员`)
    if (stats.maleCount !== requiredMale)
      throw new Error(`${group.group_name} 男生人数需为 ${requiredMale}，当前 ${stats.maleCount}`)
    if (stats.femaleCount !== requiredFemale)
      throw new Error(`${group.group_name} 女生人数需为 ${requiredFemale}，当前 ${stats.femaleCount}`)

    for (const userId of memberUserIds) {
      if (!participantSet.has(userId)) throw new Error(`${group.group_name} 存在非参赛人员`)
      if (usedUserIdSet.has(userId)) duplicateUserIdSet.add(userId)
      else usedUserIdSet.add(userId)
    }
  }
  if (duplicateUserIdSet.size) throw new Error('同一用户不能同时分配到多个分组')
}

const hasCurrentRoundLineupCompleted = () => {
  const roundNo = Number(currentRoundNo.value || 0)
  if (roundNo < 1) return false
  return isRoundLineupCompleted(roundNo)
}
const getRoundMatchKeys = (roundNo) => {
  const targetRoundNo = Number(roundNo || 0)
  if (targetRoundNo < 1) return []
  const groupNos = [...new Set(teamGroups.value.map((item) => Number(item.group_no)).filter((item) => item > 0))].sort(
    (a, b) => a - b
  )
  if (groupNos.length < 2) return []
  const keys = []
  ;(teamForm.value.eventCodes || []).forEach((eventCode) => {
    for (let homeIndex = 0; homeIndex < groupNos.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < groupNos.length; awayIndex += 1) {
        keys.push(`${targetRoundNo}-${eventCode}-${groupNos[homeIndex]}-${groupNos[awayIndex]}`)
      }
    }
  })
  return keys
}
const getUnscoredMatchKeys = (roundNo) =>
  getRoundMatchKeys(roundNo).filter((key) => {
    const score = matchupScoreDraft.value?.[String(key)] || {}
    const home = Number(score.homeScore)
    const away = Number(score.awayScore)
    return !Number.isFinite(home) || !Number.isFinite(away)
  })

const onLifecycleAction = async (action) => {
  try {
    if (!canOperateLifecycle.value) throw new Error('仅管理员或创建者可操作赛事阶段')
    if (!detail.value?.id) throw new Error('缺少赛事ID')

    if (action === 'to_team_configuring') {
      if ((detail.value?.participant_count || 0) < 2) throw new Error('参赛人数不足，无法进入参数设置')
      await onSaveParticipants()
      await setLifecycle({ stage: 'team_configuring' })
      ElMessage.success('已进入团体赛参数设置阶段')
      return
    }
    if (action === 'to_grouping') {
      if (Number(teamMinPlayersPerGroup.value || 0) < 1) throw new Error('请先保存团体参数')
      await onSaveTeamConfig()
      await setLifecycle({ stage: 'grouping' })
      ElMessage.success('已进入分组成员阶段')
      return
    }
    if (action === 'start_rounds') {
      await onSaveTeamGroups()
      validateGroups()
      await setLifecycle({
        stage: 'rounds_in_progress',
        currentRoundNo: 1,
        currentRoundState: 'waiting_lineup',
      })
      ElMessage.success('赛事已正式开始，进入第一轮排位')
      return
    }
    if (action === 'mark_lineup_submitted') {
      await onSaveTeamAssignments()
      if (!hasCurrentRoundLineupCompleted()) throw new Error('当前轮排位未全部提交完成')
      await setLifecycle({ currentRoundState: 'playing' })
      ElMessage.success('当前轮排位已确认，并已开始对局计分')
      return
    }
    if (action === 'finish_round') {
      const roundCount = Number(teamForm.value.roundCount || 1)
      const roundNo = Number(currentRoundNo.value || 1)
      if (!hasAdminPermission.value) {
        const unscoredMatchKeys = getUnscoredMatchKeys(roundNo)
        if (unscoredMatchKeys.length) {
          throw new Error(`当前轮还有 ${unscoredMatchKeys.length} 场对局未计分，不能完成本轮`)
        }
      }
      if (roundNo >= roundCount) {
        await setLifecycle({ currentRoundState: 'round_finished' })
        ElMessage.success('最后一轮已完成，可执行完赛')
        return
      }
      await setLifecycle({
        currentRoundNo: roundNo + 1,
        currentRoundState: 'waiting_lineup',
      })
      ElMessage.success(`第 ${roundNo} 轮已完成，进入第 ${roundNo + 1} 轮`)
      return
    }
    if (action === 'finish_tournament') {
      await ElMessageBox.confirm('确认完成全部比赛并封盘吗？', '完成赛事', {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await setLifecycle({ stage: 'finished', currentRoundState: 'round_finished' })
      ElMessage.success('赛事已完成')
    }
  } catch (error) {
    showErrorMessage(error)
  }
}

const lifecycleActionButtons = computed(() => {
  if (currentStage.value === 'participant_adjusting') {
    return [{ key: 'to_team_configuring', label: '进入参数设置' }]
  }
  if (currentStage.value === 'team_configuring') {
    return [{ key: 'to_grouping', label: '进入分组阶段' }]
  }
  if (currentStage.value === 'grouping') {
    return [{ key: 'start_rounds', label: '开始赛事', type: 'primary' }]
  }
  if (currentStage.value === 'rounds_in_progress') {
    if (currentRoundState.value === 'waiting_lineup') {
      return [{ key: 'mark_lineup_submitted', label: '确认排位并开始计分' }]
    }
    if (currentRoundState.value === 'playing') {
      return [{ key: 'finish_round', label: '完成本轮', type: 'primary' }]
    }
    if (currentRoundState.value === 'round_finished') {
      const isLastRound = Number(currentRoundNo.value || 0) >= Number(teamForm.value.roundCount || 1)
      return [
        isLastRound
          ? { key: 'finish_tournament', label: '完成全部比赛', type: 'danger' }
          : { key: 'finish_round', label: '进入下一轮', type: 'primary' },
      ]
    }
  }
  return []
})

const toggleParticipant = (userId) => {
  const id = String(userId || '')
  const index = selectedParticipantIds.value.indexOf(id)
  if (index >= 0) selectedParticipantIds.value.splice(index, 1)
  else selectedParticipantIds.value.push(id)
}

const onSaveParticipants = async () => {
  try {
    if (!canManageParticipants.value) throw new Error('仅管理员或赛事创建者可修改参赛人员')
    savingParticipants.value = true
    const selectedSet = new Set(selectedParticipantIds.value)
    const selectedUsers = users.value
      .filter((item) => selectedSet.has(String(item.user_id || item.id)))
      .map((item) => ({
        user_id: item.user_id || item.id,
        nickname: item.nickname || item.user_id || item.id,
      }))
    await updateTournamentParticipants({ tournamentId: detail.value?.id, participants: selectedUsers })
    ElMessage.success('参赛人员已更新')
    await loadDetail()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingParticipants.value = false
  }
}

const onApplyTeamConfig = () => {
  teamGroups.value = normalizeTeamGroups(teamGroups.value, Number(teamForm.value.groupCount || 2))
  rebuildAssignmentDraft()
}

const onSaveTeamConfig = async () => {
  try {
    if (!canEditTeamConfig.value) throw new Error('仅管理员或赛事创建者可保存团体参数')
    savingTeamConfig.value = true
    await updateTournamentTeamConfig({
      tournamentId: detail.value?.id,
      teamConfig: {
        groupCount: Number(teamForm.value.groupCount || 2),
        eventCodes: teamForm.value.eventCodes,
        roundCount: Number(teamForm.value.roundCount || 1),
        scoreTarget: Number(teamForm.value.scoreTarget || 21),
      },
    })
    ElMessage.success('团体赛参数已保存')
    onApplyTeamConfig()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingTeamConfig.value = false
  }
}

const onSaveTeamGroups = async () => {
  try {
    if (!canManageTeamGroups.value) throw new Error('仅管理员或赛事创建者可操作分组成员')
    savingTeamGroups.value = true
    validateGroups()
    await saveTournamentTeamGroups({ tournamentId: detail.value?.id, groups: teamGroups.value })
    ElMessage.success('分组成员已保存')
    await loadTeamBusinessData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingTeamGroups.value = false
  }
}

const validateAssignments = (rows = []) => {
  if (!rows.length) throw new Error('当前可编辑范围内没有可保存的排位记录')
  const groupMemberMap = new Map()
  teamGroups.value.forEach((group) =>
    groupMemberMap.set(Number(group.group_no), new Set(group.member_user_ids || []))
  )
  const sameGroupRoundMap = new Map()
  const mixedMap = new Map()

  rows.forEach((row) => {
    if (!row.user_id) {
      throw new Error(
        `第 ${row.round_no} 轮 ${eventLabelMap[row.event_code] || row.event_code} ${slotLabelMap[row.slot_code] || row.slot_code} 未选择人员`
      )
    }
    const memberSet = groupMemberMap.get(Number(row.group_no))
    if (!memberSet || !memberSet.has(row.user_id)) {
      throw new Error(`第 ${row.round_no} 轮第 ${row.group_no} 组排位存在非本组成员`)
    }
    const groupRoundKey = [row.round_no, row.group_no].join('::')
    const usedSet = sameGroupRoundMap.get(groupRoundKey) || new Set()
    if (usedSet.has(row.user_id)) throw new Error(`第 ${row.round_no} 轮第 ${row.group_no} 组存在重复上场人员`)
    usedSet.add(row.user_id)
    sameGroupRoundMap.set(groupRoundKey, usedSet)

    if (row.event_code === 'mixed_double') {
      const mixedKey = [row.round_no, row.group_no, row.event_code].join('::')
      const mixedRecord = mixedMap.get(mixedKey) || {}
      mixedRecord[row.slot_code] = row.user_id
      mixedMap.set(mixedKey, mixedRecord)
    }
  })

  mixedMap.forEach((item) => {
    const maleUser = userMap.value.get(String(item.mixed_male || ''))
    const femaleUser = userMap.value.get(String(item.mixed_female || ''))
    if (!item.mixed_male || !item.mixed_female) throw new Error('混双排位需要同时设置男女位置')
    if (Number(maleUser?.gender) === 2 || Number(femaleUser?.gender) === 1) {
      throw new Error('混双男女位置与用户性别不匹配')
    }
  })
}

const onSaveTeamAssignments = async () => {
  try {
    if (!canEditTeamLineups.value) throw new Error('仅参赛人员、管理员或赛事创建者可保存轮次排位')
    savingTeamAssignments.value = true
    const editableGroupNoSet = new Set(editableTeamGroupNos.value.map((item) => Number(item)))
    const scopedRows = assignmentDraft.value.filter(
      (row) =>
        Number(row.round_no) === Number(currentEditableRoundNo.value) &&
        editableGroupNoSet.has(Number(row.group_no))
    )
    validateAssignments(scopedRows)
    const assignmentsToSave = assignmentDraft.value.filter((item) => String(item.user_id || '').trim())
    await saveTournamentTeamAssignments({
      tournamentId: detail.value?.id,
      assignments: assignmentsToSave,
    })
    ElMessage.success('团体排位已保存')
    await loadTeamBusinessData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingTeamAssignments.value = false
  }
}

onMounted(async () => {
  await authStore.loadPermissions()
  await loadDetail()
})
</script>

<template>
  <section class="detail-page" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="title">{{ detail?.name || '赛事详情' }}</div>
      </template>
      <div class="meta">对局方式：{{ modeLabel }}</div>
      <div class="meta">状态：{{ detail?.status || 'draft' }}</div>
      <div class="meta">赛事阶段：{{ stageLabelMap[currentStage] || currentStage }}</div>
      <div v-if="showParticipantSummary" class="meta">
        参赛人数：{{ detail?.participant_count || 0 }}（男 {{ maleCount }} / 女 {{ femaleCount }}）
      </div>
      <div v-if="showParticipant" class="summary-block">
        <div class="summary-title">已报名人员</div>
        <div class="summary-tags">
          <el-tag
            v-for="item in enrichedParticipants"
            :key="item.user_id"
            effect="plain"
            size="small"
            :type="getGenderTagType(item.gender)"
          >
            {{ item.nickname || item.user_id }}
          </el-tag>
        </div>
      </div>
      <div v-if="showTeamConfigSummary" class="summary-block">
        <div class="summary-title">团体赛参数</div>
        <div class="meta">{{ teamConfigSummaryText }}</div>
      </div>
      <div v-if="showGroupSummary" class="summary-block">
        <div class="summary-title">分组成员</div>
        <div v-for="item in groupSummaryList" :key="item.groupNo" class="meta">
          第 {{ item.groupNo }} 组：{{ item.memberNames.join('、') || '未分配' }}
        </div>
      </div>
      <div v-if="showLiveRanking" class="summary-block">
        <div class="summary-title">实时排名</div>
        <div class="ranking-list">
          <div v-for="(item, index) in liveRankingList" :key="item.groupNo" class="ranking-item">
            <div class="ranking-left">
              <span class="ranking-index">{{ index + 1 }}</span>
              <span class="ranking-name">{{ item.groupName }}</span>
            </div>
            <div class="ranking-right">
              <span>总积分 {{ item.totalWinPoints }}</span>
              <span>净胜分 {{ item.totalNetScore }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showRoundLineupSummary" class="summary-block">
        <div class="summary-title-row">
          <div class="summary-title">轮次组内项目参与情况</div>
          <el-button text size="small" @click="firstRoundLineupCollapsed = !firstRoundLineupCollapsed">
            {{ firstRoundLineupCollapsed ? '展开' : '收起' }}
          </el-button>
        </div>
        <div v-show="!firstRoundLineupCollapsed">
          <div v-for="round in roundLineupSummaryList" :key="round.roundNo" class="lineup-summary-round">
            <div class="lineup-summary-round-title">第 {{ round.roundNo }} 轮</div>
            <div class="meta">
              本轮已计分对局：{{ getRoundScoreSummary(round.roundNo)?.roundScoredMatches || 0 }}
            </div>
            <div class="lineup-summary-group-grid">
              <div v-for="group in round.groups" :key="`${round.roundNo}-${group.groupNo}`" class="lineup-summary-group">
                <div class="lineup-summary-group-title">{{ group.groupName }}</div>
                <div v-for="row in group.rows" :key="row.key" class="meta">{{ row.text }}</div>
                <div class="group-score-summary">
                  <div class="meta">
                    组内总得分：{{ getGroupScoreSummary(round.roundNo, group.groupNo)?.totalWinPoints || 0 }}，
                    组内总净胜分：{{ getGroupScoreSummary(round.roundNo, group.groupNo)?.totalNetScore || 0 }}
                  </div>
                  <div
                    v-for="event in getGroupScoreSummary(round.roundNo, group.groupNo)?.events || []"
                    :key="`${round.roundNo}-${group.groupNo}-${event.eventCode}`"
                    class="meta"
                  >
                    {{ event.eventLabel }}：得分 {{ event.winPoints }}，总分 {{ event.totalScore }}，净胜分 {{ event.netScore }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentStage === 'rounds_in_progress' || currentStage === 'finished'" class="summary-block">
        <div class="meta">
          当前轮次：{{ currentRoundNo || '-' }}
        </div>
        <div class="meta">
          轮次状态：{{ roundStateLabelMap[currentRoundState] || currentRoundState }}
        </div>
      </div>
    </el-card>

    <TournamentParticipantsPanel
      v-if="showParticipantsPanel"
      :can-manage-participants="canManageParticipants"
      :participant-editor-visible="participantEditorVisible"
      :enriched-participants="enrichedParticipants"
      :users="users"
      :selected-participant-ids="selectedParticipantIds"
      :saving-participants="savingParticipants"
      @toggle-editor="participantEditorVisible = !participantEditorVisible"
      @toggle-participant="toggleParticipant"
      @save-participants="onSaveParticipants"
    />

    <TournamentTeamConfigPanel
      v-if="showTeamConfigPanel"
      :can-edit-team-config="canEditTeamConfig"
      :team-form="teamForm"
      :team-event-options="TEAM_EVENT_OPTIONS"
      :team-score-target-options="TEAM_SCORE_TARGET_OPTIONS"
      :team-min-players-per-group="teamMinPlayersPerGroup"
      :team-gender-requirement-per-group="teamGenderRequirementPerGroup"
      :saving-team-config="savingTeamConfig"
      @save-config="onSaveTeamConfig"
    />

    <TournamentTeamGroupsPanel
      v-if="showTeamGroupsPanel"
      :team-groups="teamGroups"
      :can-manage-team-groups="canManageTeamGroups"
      :get-assignable-participant-options="getAssignableParticipantOptions"
      :get-gender-label="getGenderLabel"
      :saving-team-groups="savingTeamGroups"
      @group-members-change="onGroupMembersChange"
      @save-groups="onSaveTeamGroups"
    />

    <TournamentTeamLineupsPanel
      v-if="showTeamLineupsPanel"
      :can-edit-team-lineups="canEditTeamLineups"
      :team-form="teamForm"
      :team-groups="teamGroups"
      :current-round-no="currentEditableRoundNo"
      :editable-group-nos="editableTeamGroupNos"
      :get-rows-by-round-group="getRowsByRoundGroup"
      :event-label-map="eventLabelMap"
      :slot-label-map="slotLabelMap"
      :get-lineup-member-options="getLineupMemberOptions"
      :saving-team-assignments="savingTeamAssignments"
      @save-assignments="onSaveTeamAssignments"
    />

    <TournamentTeamMatchupsPanel
      v-if="showTeamMatchupsPanel"
      :round-no="currentRoundNo"
      :matchups="currentRoundMatchups"
      :score-target="teamForm.scoreTarget"
      :score-draft="matchupScoreDraft"
      :saving-score="savingMatchScore"
      :refreshing="refreshingMatchups"
      @score-submit="onMatchScoreSubmit"
      @refresh="onRefreshMatchups"
    />

    <div v-if="isTeamMode" class="action-row">
      <div class="meta" v-if="!canOperateLifecycle">仅管理员或赛事创建者可操作阶段变更</div>
      <el-button
        v-for="item in lifecycleActionButtons"
        :key="item.key"
        :type="item.type || 'primary'"
        size="large"
        :loading="savingLifecycle"
        :disabled="!canOperateLifecycle"
        class="action-btn"
        @click="onLifecycleAction(item.key)"
      >
        {{ item.label }}
      </el-button>
    </div>
  </section>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: 12px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.meta {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.summary-block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
}

.summary-title {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.summary-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lineup-summary-round + .lineup-summary-round {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.lineup-summary-round-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.lineup-summary-group-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.lineup-summary-group {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 8px;
}

.group-score-summary {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
  display: grid;
  gap: 4px;
}

.ranking-list {
  display: grid;
  gap: 8px;
}

.ranking-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
}

.ranking-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ranking-index {
  width: 22px;
  height: 22px;
  border-radius: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  background: #409eff;
}

.ranking-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.ranking-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12px;
  color: #606266;
}

.lineup-summary-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.action-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.action-btn {
  min-width: 180px;
}
</style>
