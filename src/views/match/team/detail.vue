<script setup>
import { computed, onMounted, ref } from 'vue'
import { Trophy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { listAllUsers } from '../../../api/admin'
import {
  calculateTeamRosterRequirement,
  getTeamEventInstances,
  getTeamEventLabel,
  getTeamEventSlots,
  getTeamRoundEventCodes,
  getTournamentDetail,
  listTournamentTeamAssignments,
  listTournamentTeamMatchScores,
  listTournamentTeamGroups,
  MATCH_MODES,
  ROUND_STATES,
  settleTournamentStatistics,
  saveTournamentTeamAssignments,
  saveTournamentTeamMatchScore,
  saveTournamentTeamGroups,
  TEAM_EVENT_SCHEDULE_MODES,
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
const settlingStatistics = ref(false)
const matchupScoreDraft = ref({})
const savingMatchScore = ref(false)
const refreshingMatchups = ref(false)
const firstRoundLineupCollapsed = ref(true)
const pageLoading = computed(
  () =>
    loading.value ||
    savingParticipants.value ||
    savingTeamConfig.value ||
    savingTeamGroups.value ||
    savingTeamAssignments.value ||
    savingLifecycle.value ||
    settlingStatistics.value ||
    savingMatchScore.value ||
    refreshingMatchups.value
)

const teamForm = ref({
  groupCount: 2,
  scheduleMode: 'uniform',
  eventCodes: ['mixed_double'],
  roundEventCodes: [['mixed_double']],
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
const statusMeta = computed(() => {
  const statusMap = {
    draft: { label: '筹备中', className: 'is-draft' },
    running: { label: '进行中', className: 'is-running' },
    finished: { label: '已完成', className: 'is-finished' },
  }
  return (
    statusMap[String(detail.value?.status || '')] || {
      label: String(detail.value?.status || '未知'),
      className: 'is-draft',
    }
  )
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

const teamRosterRequirement = computed(() => calculateTeamRosterRequirement(teamForm.value))
const teamMinPlayersPerGroup = computed(() => teamRosterRequirement.value.total)
const teamGenderRequirementPerGroup = computed(() => ({
  male: teamRosterRequirement.value.male,
  female: teamRosterRequirement.value.female,
}))
const getRoundEventInstances = (roundNo) =>
  getTeamEventInstances(getTeamRoundEventCodes(teamForm.value, roundNo))
const getEventDisplayLabel = (eventCode, eventNo = 1, roundNo = 1) => {
  const instances = getRoundEventInstances(roundNo)
  const matched = instances.find(
    (item) =>
      String(item.eventCode) === String(eventCode) && Number(item.eventNo) === Number(eventNo)
  )
  return matched?.label || getTeamEventLabel(eventCode)
}

const currentUserId = computed(() => String(authStore.user?.id || ''))
const isTournamentCreator = computed(
  () =>
    String(detail.value?.created_by_user_id || '') &&
    String(detail.value?.created_by_user_id || '') === currentUserId.value
)
const hasAdminPermission = computed(() => authStore.isAdmin || authStore.hasPermission('admin'))
const hasAdminCommonPermission = computed(() => authStore.hasPermission('admin-common'))
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
const canOperateLifecycle = computed(
  () => isTeamMode.value && (hasManagerPermission.value || hasAdminCommonPermission.value)
)
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
const showParticipantsPanel = computed(() => currentStageIndex.value === 0)
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
const teamConfigRoundList = computed(() => {
  if (teamForm.value.scheduleMode !== 'per_round') {
    return [
      {
        roundNo: 0,
        label: '每轮',
        events: getTeamEventInstances(teamForm.value.eventCodes),
      },
    ]
  }
  return Array.from({ length: Number(teamForm.value.roundCount || 1) }, (_, index) => ({
    roundNo: index + 1,
    label: `第 ${index + 1} 轮`,
    events: getTeamEventInstances(getTeamRoundEventCodes(teamForm.value, index + 1)),
  }))
})
const groupSummaryList = computed(() =>
  teamGroups.value.map((group) => {
    const members = (group.member_user_ids || [])
      .map((id) => {
        const participant = participantOptions.value.find((item) => item.value === String(id))
        return {
          id: String(id),
          name: participant?.label || id,
          gender: Number(participant?.gender || 0),
        }
      })
      .filter((item) => item.name)
    return {
      groupNo: group.group_no,
      members,
      maleCount: members.filter((item) => item.gender === 1).length,
      femaleCount: members.filter((item) => item.gender === 2).length,
    }
  })
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
      const rows = getRoundEventInstances(roundNo).map(({ eventCode, eventNo, label }) => {
        const slotOrder = getEventSlots(eventCode)
        const eventRows = allRows
          .filter(
            (item) =>
              String(item.event_code) === String(eventCode) &&
              Number(item.event_no) === Number(eventNo)
          )
          .sort(
            (a, b) =>
              slotOrder.indexOf(String(a.slot_code)) - slotOrder.indexOf(String(b.slot_code))
          )
        const memberNames = eventRows.map((item) => getUserLabel(item.user_id)).filter(Boolean)
        return {
          key: [roundNo, groupNo, eventCode, eventNo].join('::'),
          eventCode,
          eventNo,
          label,
          memberNames,
          text: `${label}：${memberNames.join('+') || '-'}`,
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
  const groupNos = [...previewTeamGroupNos.value]
    .map((item) => Number(item))
    .filter((item) => item > 0)
  const scoreDraft = matchupScoreDraft.value || {}

  return visibleSummaryRoundNos.value.map((roundNo) => {
    const eventInstances = getRoundEventInstances(roundNo)
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
        eventStats: eventInstances.reduce((result, event) => {
          const eventKey = `${event.eventCode}::${event.eventNo}`
          result[eventKey] = {
            eventCode: event.eventCode,
            eventNo: event.eventNo,
            eventLabel: event.label,
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
    eventInstances.forEach(({ eventCode, eventNo }) => {
      const eventKey = `${eventCode}::${eventNo}`
      for (let homeIndex = 0; homeIndex < groupNos.length; homeIndex += 1) {
        for (let awayIndex = homeIndex + 1; awayIndex < groupNos.length; awayIndex += 1) {
          const homeGroupNo = groupNos[homeIndex]
          const awayGroupNo = groupNos[awayIndex]
          const key = `${roundNo}-${eventCode}-${eventNo}-${homeGroupNo}-${awayGroupNo}`
          const score = scoreDraft[key]
          const homeScore = Number(score?.homeScore)
          const awayScore = Number(score?.awayScore)
          if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue

          roundScoredMatches += 1
          const homeGroup = groupMap.get(homeGroupNo)
          const awayGroup = groupMap.get(awayGroupNo)
          if (!homeGroup || !awayGroup) continue

          const homeEvent = homeGroup.eventStats[eventKey]
          const awayEvent = awayGroup.eventStats[eventKey]
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
      const events = eventInstances.map(({ eventCode, eventNo }) => {
        const event = group.eventStats[`${eventCode}::${eventNo}`]
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
const getEventScoreSummary = (roundNo, groupNo, eventCode, eventNo) =>
  getGroupScoreSummary(roundNo, groupNo)?.events?.find(
    (item) =>
      String(item.eventCode) === String(eventCode) && Number(item.eventNo) === Number(eventNo)
  )
const liveRankingList = computed(() => {
  const rankMap = new Map()
  ;(roundScoreSummaryList.value || []).forEach((round) => {
    ;(round.groups || []).forEach((group) => {
      const groupNo = Number(group.groupNo)
      if (!rankMap.has(groupNo)) {
        rankMap.set(groupNo, {
          groupNo,
          groupName:
            teamGroups.value.find((item) => Number(item.group_no) === groupNo)?.group_name ||
            `第${groupNo}组`,
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

const getGenderLabel = (gender) =>
  Number(gender) === 1 ? '男' : Number(gender) === 2 ? '女' : '未知'
const getGenderTagType = (gender) => {
  if (Number(gender) === 1) return 'primary'
  if (Number(gender) === 2) return 'danger'
  return 'info'
}
const getUserLabel = (userId) =>
  participantOptions.value.find((item) => String(item.value) === String(userId))?.label ||
  String(userId || '')
const getGroupLabel = (groupNo) =>
  teamGroups.value.find((item) => Number(item.group_no) === Number(groupNo))?.group_name ||
  `第 ${groupNo} 组`
const getEventSlots = (eventCode) =>
  TEAM_EVENT_OPTIONS.find((item) => item.code === String(eventCode))?.slots || []
const getEventSideText = (roundNo, groupNo, eventCode, eventNo) => {
  const rows = getRowsByRoundGroup(roundNo, groupNo).filter(
    (item) =>
      String(item.event_code) === String(eventCode) && Number(item.event_no) === Number(eventNo)
  )
  if (!rows.length) return '-'
  const slotOrder = getEventSlots(eventCode)
  const ordered = [...rows].sort(
    (a, b) => slotOrder.indexOf(String(a.slot_code)) - slotOrder.indexOf(String(b.slot_code))
  )
  return (
    ordered
      .map((item) => getUserLabel(item.user_id))
      .filter(Boolean)
      .join('\n') || '-'
  )
}
const currentRoundMatchups = computed(() => {
  const roundNo = Number(currentRoundNo.value || 0)
  if (roundNo < 1) return []
  const groupNos = [
    ...new Set(teamGroups.value.map((item) => Number(item.group_no)).filter((item) => item > 0)),
  ].sort((a, b) => a - b)
  if (groupNos.length < 2) return []

  return getRoundEventInstances(roundNo).map(({ eventCode, eventNo, label }) => {
    const matches = []
    for (let homeIndex = 0; homeIndex < groupNos.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < groupNos.length; awayIndex += 1) {
        const homeGroupNo = groupNos[homeIndex]
        const awayGroupNo = groupNos[awayIndex]
        matches.push({
          key: `${roundNo}-${eventCode}-${eventNo}-${homeGroupNo}-${awayGroupNo}`,
          homeLabel: getGroupLabel(homeGroupNo),
          awayLabel: getGroupLabel(awayGroupNo),
          homeValue: getEventSideText(roundNo, homeGroupNo, eventCode, eventNo),
          awayValue: getEventSideText(roundNo, awayGroupNo, eventCode, eventNo),
        })
      }
    }
    return {
      key: `event-${eventCode}-${eventNo}`,
      eventLabel: label,
      matches,
    }
  })
})
const onMatchScoreSubmit = ({ matchKey, homeScore, awayScore }) => {
  const key = String(matchKey || '')
  if (!key) return
  const [roundNoText, eventCode, eventNoText, homeGroupNoText, awayGroupNoText] = key.split('-')
  const roundNo = Number(roundNoText)
  const eventNo = Number(eventNoText)
  const homeGroupNo = Number(homeGroupNoText)
  const awayGroupNo = Number(awayGroupNoText)
  const nextHome = Number(homeScore)
  const nextAway = Number(awayScore)
  if (
    !Number.isInteger(roundNo) ||
    !eventCode ||
    !Number.isInteger(eventNo) ||
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
          event_no: eventNo,
          home_group_no: homeGroupNo,
          away_group_no: awayGroupNo,
          home_score: nextHome,
          away_score: nextAway,
        },
      })
      await loadRoundMatchScores(roundNo)
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
    map.set(groupNo, {
      group_no: groupNo,
      group_name: `第${groupNo}组`,
      member_user_ids: memberUserIds,
    })
  })

  const result = []
  for (let index = 1; index <= groupCount; index += 1) {
    result.push(
      map.get(index) || { group_no: index, group_name: `第${index}组`, member_user_ids: [] }
    )
  }
  return result
}

const buildAssignmentKey = (item) =>
  [item.round_no, item.group_no, item.event_code, item.event_no, item.slot_code].join('::')

const rebuildAssignmentDraft = (source = null) => {
  const sourceList = Array.isArray(source) ? source : assignmentDraft.value
  const sourceMap = new Map()
  sourceList.forEach((item) => sourceMap.set(buildAssignmentKey(item), String(item.user_id || '')))

  const rows = []
  for (let roundNo = 1; roundNo <= Number(teamForm.value.roundCount || 1); roundNo += 1) {
    const slots = getTeamEventSlots(getTeamRoundEventCodes(teamForm.value, roundNo))
    teamGroups.value.forEach((group) => {
      slots.forEach((slot) => {
        rows.push({
          round_no: roundNo,
          group_no: group.group_no,
          event_code: slot.eventCode,
          event_no: slot.eventNo,
          slot_code: slot.slotCode,
          user_id:
            sourceMap.get(
              [roundNo, group.group_no, slot.eventCode, slot.eventNo, slot.slotCode].join('::')
            ) || '',
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
const getLineupMemberOptions = (
  roundNo,
  groupNo,
  eventCode,
  eventNo,
  slotCode,
  currentUserId = ''
) => {
  const options = getGroupMemberOptions(groupNo)
  if (!eventCode) return options

  const code = String(eventCode)
  const slot = String(slotCode || '')
  const pickedInGroupRound = new Set(
    getRowsByRoundGroup(roundNo, groupNo)
      .filter(
        (row) =>
          !(
            String(row.event_code) === code &&
            Number(row.event_no) === Number(eventNo) &&
            String(row.slot_code) === slot
          ) && String(row.user_id || '').trim()
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
      if (Number(item.gender) === 1 && stats.maleCount >= requiredMale)
        return { ...item, disabled: true }
      if (Number(item.gender) === 2 && stats.femaleCount >= requiredFemale)
        return { ...item, disabled: true }
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
    const uniqueIds = Array.from(
      new Set((group.member_user_ids || []).map((id) => String(id || '')))
    )
    const optionSet = new Set(getAssignableParticipantOptions(groupNo).map((item) => item.value))
    group.member_user_ids = uniqueIds.filter((id) => optionSet.has(id))
  }
  autoFillLastGroupMembers(groupNo)
}

const syncTeamFormFromDetail = () => {
  const config = detail.value?.team_config || {}
  teamForm.value.groupCount = Math.max(2, Number(config.group_count || 2))
  teamForm.value.scheduleMode = config.schedule_mode === 'per_round' ? 'per_round' : 'uniform'
  teamForm.value.eventCodes =
    Array.isArray(config.event_codes) && config.event_codes.length
      ? config.event_codes
      : ['mixed_double']
  teamForm.value.roundCount = Math.max(1, Number(config.round_count || 1))
  teamForm.value.roundEventCodes = Array.from({ length: teamForm.value.roundCount }, (_, index) => {
    const eventCodes = Array.isArray(config.round_event_codes?.[index])
      ? config.round_event_codes[index]
      : []
    return eventCodes.length ? [...eventCodes] : [...teamForm.value.eventCodes]
  })
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
    const key = [
      item.round_no,
      item.event_code,
      item.event_no,
      item.home_group_no,
      item.away_group_no,
    ].join('-')
    scoreMap[key] = {
      homeScore: Number(item.home_score),
      awayScore: Number(item.away_score),
    }
  })
  return scoreMap
}

const loadRoundMatchScores = async (roundNo) => {
  const targetRoundNo = Number(roundNo || 0)
  if (!detail.value?.id || targetRoundNo < 1) return
  const matchScores = await listTournamentTeamMatchScores(detail.value.id, {
    roundNo: targetRoundNo,
  })
  const nextScoreMap = { ...(matchupScoreDraft.value || {}) }
  const roundPrefix = `${targetRoundNo}-`
  Object.keys(nextScoreMap).forEach((key) => {
    if (String(key).startsWith(roundPrefix)) delete nextScoreMap[key]
  })
  Object.assign(nextScoreMap, buildScoreMap(matchScores, targetRoundNo))
  matchupScoreDraft.value = nextScoreMap
}

const loadTeamBusinessData = async () => {
  if (!isTeamMode.value || !detail.value?.id) return
  if (currentStage.value === 'participant_adjusting') return
  if (['team_configuring', 'grouping'].includes(currentStage.value)) {
    const groups = await listTournamentTeamGroups(detail.value.id)
    teamGroups.value = normalizeTeamGroups(groups, teamForm.value.groupCount)
    rebuildAssignmentDraft([])
    matchupScoreDraft.value = {}
    return
  }
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
    selectedParticipantIds.value = (detailResult?.participants || []).map((item) =>
      String(item.user_id || '')
    )
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
    await loadRoundMatchScores(roundNo)
  } catch (error) {
    showErrorMessage(error)
  } finally {
    refreshingMatchups.value = false
  }
}

const setLifecycle = async (payload) => {
  try {
    savingLifecycle.value = true
    const updated = await updateTournamentLifecycle({ tournamentId: detail.value?.id, ...payload })
    if (!detail.value || !updated) return
    detail.value = {
      ...detail.value,
      status: updated.status || detail.value.status,
      stage: updated.stage || detail.value.stage,
      current_round_no:
        typeof updated.current_round_no === 'undefined'
          ? detail.value.current_round_no
          : Number(updated.current_round_no),
      current_round_state: updated.current_round_state || detail.value.current_round_state,
    }
  } finally {
    savingLifecycle.value = false
  }
}

const settleStatistics = async () => {
  try {
    settlingStatistics.value = true
    const settled = await settleTournamentStatistics(detail.value?.id)
    detail.value = { ...detail.value, ...settled }
    return settled
  } finally {
    settlingStatistics.value = false
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
    if (memberUserIds.length !== requiredTotal)
      throw new Error(`${group.group_name} 人数必须为 ${requiredTotal}`)
    const stats = getGroupGenderStats({ member_user_ids: memberUserIds })
    if (stats.unknownCount > 0) throw new Error(`${group.group_name} 存在性别未知成员`)
    if (stats.maleCount !== requiredMale)
      throw new Error(`${group.group_name} 男生人数需为 ${requiredMale}，当前 ${stats.maleCount}`)
    if (stats.femaleCount !== requiredFemale)
      throw new Error(
        `${group.group_name} 女生人数需为 ${requiredFemale}，当前 ${stats.femaleCount}`
      )

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
  const groupNos = [
    ...new Set(teamGroups.value.map((item) => Number(item.group_no)).filter((item) => item > 0)),
  ].sort((a, b) => a - b)
  if (groupNos.length < 2) return []
  const keys = []
  getRoundEventInstances(targetRoundNo).forEach(({ eventCode, eventNo }) => {
    for (let homeIndex = 0; homeIndex < groupNos.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < groupNos.length; awayIndex += 1) {
        keys.push(
          `${targetRoundNo}-${eventCode}-${eventNo}-${groupNos[homeIndex]}-${groupNos[awayIndex]}`
        )
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
      if ((detail.value?.participant_count || 0) < 2)
        throw new Error('参赛人数不足，无法进入参数设置')
      await onSaveParticipants(true)
      await setLifecycle({ stage: 'team_configuring' })
      ElMessage.success('已进入团体赛参数设置阶段')
      return
    }
    if (action === 'to_grouping') {
      if (Number(teamMinPlayersPerGroup.value || 0) < 1) throw new Error('请先保存团体参数')
      await onSaveTeamConfig(true)
      await setLifecycle({ stage: 'grouping' })
      ElMessage.success('已进入分组成员阶段')
      return
    }
    if (action === 'back_to_team_configuring') {
      await ElMessageBox.confirm(
        '返回后请重新保存团体参数，并重新核对各组成员。确认返回吗？',
        '返回参数设置',
        {
          confirmButtonText: '确认返回',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
      await setLifecycle({
        stage: 'team_configuring',
        currentRoundNo: 0,
        currentRoundState: 'waiting_lineup',
      })
      ElMessage.success('已返回团体赛参数设置阶段')
      return
    }
    if (action === 'start_rounds') {
      await onSaveTeamGroups(true)
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
      await onSaveTeamAssignments(true)
      if (!hasCurrentRoundLineupCompleted()) throw new Error('当前轮排位未全部提交完成')
      await setLifecycle({ currentRoundState: 'playing' })
      ElMessage.success('当前轮排位已确认，并已开始对局计分')
      return
    }
    if (action === 'finish_round') {
      const roundCount = Number(teamForm.value.roundCount || 1)
      const roundNo = Number(currentRoundNo.value || 1)
      await loadRoundMatchScores(roundNo)
      const unscoredMatchKeys = getUnscoredMatchKeys(roundNo)
      if (unscoredMatchKeys.length) {
        throw new Error(`当前轮还有 ${unscoredMatchKeys.length} 场对局未计分，不能完成本轮`)
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
      await settleStatistics()
      await setLifecycle({ stage: 'finished', currentRoundState: 'round_finished' })
      ElMessage.success('赛事已完成')
      return
    }
    if (action === 'settle_statistics') {
      await ElMessageBox.confirm('确认根据现有排位和比分补结算个人统计吗？', '补结算统计', {
        confirmButtonText: '确认结算',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await settleStatistics()
      ElMessage.success('赛事统计已补结算')
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
    return [
      { key: 'back_to_team_configuring', label: '返回参数设置', type: 'info' },
      { key: 'start_rounds', label: '开始赛事', type: 'primary' },
    ]
  }
  if (currentStage.value === 'rounds_in_progress') {
    if (currentRoundState.value === 'waiting_lineup') {
      return [{ key: 'mark_lineup_submitted', label: '确认排位并开始计分' }]
    }
    if (currentRoundState.value === 'playing') {
      const unscoredCount = getUnscoredMatchKeys(currentRoundNo.value).length
      return [
        {
          key: 'finish_round',
          label: unscoredCount ? `完成本轮（还差 ${unscoredCount} 场）` : '完成本轮',
          type: 'primary',
          disabled: unscoredCount > 0,
        },
      ]
    }
    if (currentRoundState.value === 'round_finished') {
      const isLastRound =
        Number(currentRoundNo.value || 0) >= Number(teamForm.value.roundCount || 1)
      return [
        isLastRound
          ? { key: 'finish_tournament', label: '完成全部比赛', type: 'danger' }
          : { key: 'finish_round', label: '进入下一轮', type: 'primary' },
      ]
    }
  }
  if (currentStage.value === 'finished' && detail.value?.settlement_status !== 'completed') {
    return [{ key: 'settle_statistics', label: '补结算统计', type: 'warning' }]
  }
  return []
})

const toggleParticipant = (userId) => {
  const id = String(userId || '')
  const index = selectedParticipantIds.value.indexOf(id)
  if (index >= 0) selectedParticipantIds.value.splice(index, 1)
  else selectedParticipantIds.value.push(id)
}

const onSaveParticipants = async (throwOnError = false) => {
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
    const savedParticipants = await updateTournamentParticipants({
      tournamentId: detail.value?.id,
      participants: selectedUsers,
    })
    const currentParticipantMap = new Map(
      (detail.value?.participants || []).map((item) => [String(item.user_id || ''), item])
    )
    detail.value = {
      ...detail.value,
      participant_count: savedParticipants.length,
      participants: savedParticipants.map((item) => ({
        id: currentParticipantMap.get(String(item.user_id))?.id || '',
        user_id: item.user_id,
        nickname: item.nickname,
      })),
    }
    ElMessage.success('参赛人员已更新')
  } catch (error) {
    if (throwOnError) throw error
    showErrorMessage(error)
  } finally {
    savingParticipants.value = false
  }
}

const onApplyTeamConfig = () => {
  teamGroups.value = normalizeTeamGroups(teamGroups.value, Number(teamForm.value.groupCount || 2))
  rebuildAssignmentDraft()
}

const syncRoundEventCodes = (seedEmptyRounds = false) => {
  const roundCount = Math.max(1, Number(teamForm.value.roundCount || 1))
  const source = Array.isArray(teamForm.value.roundEventCodes) ? teamForm.value.roundEventCodes : []
  teamForm.value.roundEventCodes = Array.from({ length: roundCount }, (_, index) => {
    const current = Array.isArray(source[index]) ? source[index] : []
    if (current.length || !seedEmptyRounds) return [...current]
    return [...teamForm.value.eventCodes]
  })
}

const onTeamRoundCountChange = () =>
  syncRoundEventCodes(teamForm.value.scheduleMode === 'per_round')

const onTeamScheduleModeChange = () => {
  if (teamForm.value.scheduleMode === 'per_round') syncRoundEventCodes(true)
}

const onSaveTeamConfig = async (throwOnError = false) => {
  try {
    if (!canEditTeamConfig.value) throw new Error('仅管理员或赛事创建者可保存团体参数')
    savingTeamConfig.value = true
    syncRoundEventCodes(false)
    await updateTournamentTeamConfig({
      tournamentId: detail.value?.id,
      teamConfig: {
        groupCount: Number(teamForm.value.groupCount || 2),
        scheduleMode: teamForm.value.scheduleMode,
        eventCodes: teamForm.value.eventCodes,
        roundEventCodes: teamForm.value.roundEventCodes,
        roundCount: Number(teamForm.value.roundCount || 1),
        scoreTarget: Number(teamForm.value.scoreTarget || 21),
      },
    })
    ElMessage.success('团体赛参数已保存')
    onApplyTeamConfig()
  } catch (error) {
    if (throwOnError) throw error
    showErrorMessage(error)
  } finally {
    savingTeamConfig.value = false
  }
}

const onSaveTeamGroups = async (throwOnError = false) => {
  try {
    if (!canManageTeamGroups.value) throw new Error('仅管理员或赛事创建者可操作分组成员')
    savingTeamGroups.value = true
    validateGroups()
    await saveTournamentTeamGroups({
      tournamentId: detail.value?.id,
      groups: teamGroups.value,
    })
    const serverGroups = await listTournamentTeamGroups(detail.value?.id)
    teamGroups.value = normalizeTeamGroups(serverGroups, teamForm.value.groupCount)
    ElMessage.success('分组成员已保存')
  } catch (error) {
    if (throwOnError) throw error
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
        `第 ${row.round_no} 轮 ${getEventDisplayLabel(row.event_code, row.event_no, row.round_no)} ${slotLabelMap[row.slot_code] || row.slot_code} 未选择人员`
      )
    }
    const memberSet = groupMemberMap.get(Number(row.group_no))
    if (!memberSet || !memberSet.has(row.user_id)) {
      throw new Error(`第 ${row.round_no} 轮第 ${row.group_no} 组排位存在非本组成员`)
    }
    const groupRoundKey = [row.round_no, row.group_no].join('::')
    const usedSet = sameGroupRoundMap.get(groupRoundKey) || new Set()
    if (usedSet.has(row.user_id))
      throw new Error(`第 ${row.round_no} 轮第 ${row.group_no} 组存在重复上场人员`)
    usedSet.add(row.user_id)
    sameGroupRoundMap.set(groupRoundKey, usedSet)

    if (row.event_code === 'mixed_double') {
      const mixedKey = [row.round_no, row.group_no, row.event_code, row.event_no].join('::')
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

const onSaveTeamAssignments = async (throwOnError = false) => {
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
    const roundNo = Number(currentEditableRoundNo.value)
    await saveTournamentTeamAssignments({
      tournamentId: detail.value?.id,
      assignments: scopedRows,
      scope: {
        roundNo,
        groupNos: [...editableGroupNoSet],
      },
    })
    const serverRoundAssignments = await listTournamentTeamAssignments(detail.value?.id, {
      roundNo,
    })
    const otherRoundAssignments = assignmentDraft.value.filter(
      (item) => Number(item.round_no) !== roundNo && String(item.user_id || '').trim()
    )
    rebuildAssignmentDraft([...otherRoundAssignments, ...serverRoundAssignments])
    ElMessage.success('团体排位已保存')
  } catch (error) {
    if (throwOnError) throw error
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
  <section v-loading.fullscreen.lock="pageLoading" class="detail-page">
    <el-card class="overview-card" shadow="never">
      <template #header>
        <div class="overview-header">
          <div class="title">{{ detail?.name || '赛事详情' }}</div>
          <span class="status-chip" :class="statusMeta.className">{{ statusMeta.label }}</span>
        </div>
      </template>
      <div class="overview-chips">
        <span class="info-chip">{{ modeLabel }}</span>
        <span class="info-chip info-chip--stage">
          {{ stageLabelMap[currentStage] || currentStage }}
        </span>
      </div>
      <div v-if="showParticipantSummary" class="stat-grid">
        <div class="stat-item stat-item--total">
          <strong>{{ detail?.participant_count || 0 }}</strong>
          <span>参赛人数</span>
        </div>
        <div class="stat-item stat-item--male">
          <strong>{{ maleCount }}</strong>
          <span>男生</span>
        </div>
        <div class="stat-item stat-item--female">
          <strong>{{ femaleCount }}</strong>
          <span>女生</span>
        </div>
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
        <div class="summary-title-row summary-title-row--section">
          <div class="summary-title">团体赛参数</div>
          <span class="config-mode-badge">
            {{ teamForm.scheduleMode === 'per_round' ? '每轮单独配置' : '所有轮次相同' }}
          </span>
        </div>
        <div class="config-stat-grid">
          <div class="config-stat">
            <span>分组</span>
            <strong>{{ teamForm.groupCount }} 组</strong>
          </div>
          <div class="config-stat">
            <span>轮数</span>
            <strong>{{ teamForm.roundCount }} 轮</strong>
          </div>
          <div class="config-stat">
            <span>分值</span>
            <strong>{{ teamForm.scoreTarget }} 分</strong>
          </div>
        </div>
        <div class="round-config-list">
          <div v-for="round in teamConfigRoundList" :key="round.roundNo" class="round-config-row">
            <span class="round-label">{{ round.label }}</span>
            <div class="event-tags">
              <span
                v-for="event in round.events"
                :key="`${round.roundNo}-${event.eventCode}-${event.eventNo}`"
                class="event-tag"
              >
                {{ event.label }}
              </span>
              <span v-if="!round.events.length" class="event-tag event-tag--empty">未配置</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showGroupSummary" class="summary-block">
        <div class="summary-title">分组成员</div>
        <div class="group-summary-list">
          <div v-for="item in groupSummaryList" :key="item.groupNo" class="group-summary-card">
            <div class="group-summary-header">
              <strong>第 {{ item.groupNo }} 组</strong>
              <span>{{ item.members.length }} 人 · 男 {{ item.maleCount }} / 女 {{ item.femaleCount }}</span>
            </div>
            <div v-if="item.members.length" class="member-tags">
              <span
                v-for="member in item.members"
                :key="member.id"
                class="member-tag"
                :class="{
                  'member-tag--male': member.gender === 1,
                  'member-tag--female': member.gender === 2,
                }"
              >
                {{ member.name }}
              </span>
            </div>
            <div v-else class="empty-members">暂未分配成员</div>
          </div>
        </div>
      </div>
      <div v-if="showLiveRanking" class="summary-block">
        <div class="summary-title-row ranking-title-row">
          <div class="summary-title">实时排名</div>
          <span class="ranking-tip">积分优先 · 净胜分次之</span>
        </div>
        <div class="ranking-list">
          <div
            v-for="(item, index) in liveRankingList"
            :key="item.groupNo"
            class="ranking-item"
            :class="{ 'ranking-item--champion': index === 0 }"
          >
            <div class="ranking-left">
              <span class="ranking-index">
                <el-icon v-if="index === 0"><Trophy /></el-icon>
                <template v-else>{{ index + 1 }}</template>
              </span>
              <div class="ranking-team">
                <span v-if="index === 0" class="champion-label">领先</span>
                <span class="ranking-name">{{ item.groupName }}</span>
              </div>
            </div>
            <div class="ranking-right">
              <div class="ranking-points">
                <strong>{{ item.totalWinPoints }}</strong>
                <span>总积分</span>
              </div>
              <span class="ranking-net-score">净胜分 {{ item.totalNetScore }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showRoundLineupSummary" class="summary-block">
        <div class="summary-title-row">
          <div class="summary-title">轮次组内项目参与情况</div>
          <el-button
            text
            size="small"
            @click="firstRoundLineupCollapsed = !firstRoundLineupCollapsed"
          >
            {{ firstRoundLineupCollapsed ? '展开' : '收起' }}
          </el-button>
        </div>
        <div v-show="!firstRoundLineupCollapsed">
          <div
            v-for="round in roundLineupSummaryList"
            :key="round.roundNo"
            class="lineup-summary-round"
          >
            <div class="lineup-summary-round-header">
              <div class="lineup-summary-round-title">第 {{ round.roundNo }} 轮</div>
              <span class="round-scored-count">
                已计分 {{ getRoundScoreSummary(round.roundNo)?.roundScoredMatches || 0 }} 场
              </span>
            </div>
            <div class="lineup-summary-group-grid">
              <div
                v-for="group in round.groups"
                :key="`${round.roundNo}-${group.groupNo}`"
                class="lineup-summary-group"
              >
                <div class="lineup-summary-group-header">
                  <div class="lineup-summary-group-title">{{ group.groupName }}</div>
                  <div class="group-score-overview">
                    <div>
                      <strong>{{
                        getGroupScoreSummary(round.roundNo, group.groupNo)?.totalWinPoints || 0
                      }}</strong>
                      <span>总得分</span>
                    </div>
                    <div class="group-net-score">
                      <strong>{{
                        getGroupScoreSummary(round.roundNo, group.groupNo)?.totalNetScore || 0
                      }}</strong>
                      <span>净胜分</span>
                    </div>
                  </div>
                </div>
                <div class="lineup-event-list">
                  <div v-for="row in group.rows" :key="row.key" class="lineup-event-row">
                    <div class="lineup-event-info">
                      <span class="lineup-event-name">{{ row.label }}</span>
                      <span class="lineup-event-members">
                        {{ row.memberNames.join(' · ') || '暂未安排' }}
                      </span>
                    </div>
                    <div class="lineup-event-score">
                      <strong>{{
                        getEventScoreSummary(
                          round.roundNo,
                          group.groupNo,
                          row.eventCode,
                          row.eventNo
                        )?.winPoints || 0
                      }}</strong>
                      <span>得分</span>
                      <small>
                        净胜
                        {{
                          getEventScoreSummary(
                            round.roundNo,
                            group.groupNo,
                            row.eventCode,
                            row.eventNo
                          )?.netScore || 0
                        }}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="currentStage === 'rounds_in_progress' || currentStage === 'finished'"
        class="round-progress"
      >
        <div class="round-progress-index">
          <span>当前轮次</span>
          <strong>第 {{ currentRoundNo || '-' }} 轮</strong>
        </div>
        <div class="round-progress-state">
          <span class="progress-dot"></span>
          {{ roundStateLabelMap[currentRoundState] || currentRoundState }}
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
      v-model:team-form="teamForm"
      :can-edit-team-config="canEditTeamConfig"
      :team-event-options="TEAM_EVENT_OPTIONS"
      :team-event-schedule-modes="TEAM_EVENT_SCHEDULE_MODES"
      :team-score-target-options="TEAM_SCORE_TARGET_OPTIONS"
      :team-min-players-per-group="teamMinPlayersPerGroup"
      :team-gender-requirement-per-group="teamGenderRequirementPerGroup"
      :team-roster-requirement="teamRosterRequirement"
      :saving-team-config="savingTeamConfig"
      @save-config="onSaveTeamConfig"
      @round-count-change="onTeamRoundCountChange"
      @schedule-mode-change="onTeamScheduleModeChange"
    />

    <TournamentTeamGroupsPanel
      v-if="showTeamGroupsPanel"
      :team-groups="teamGroups"
      :can-manage-team-groups="canManageTeamGroups"
      :get-assignable-participant-options="getAssignableParticipantOptions"
      :get-gender-label="getGenderLabel"
      :team-roster-requirement="teamRosterRequirement"
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
      :get-event-label="getEventDisplayLabel"
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
      <template v-if="showTeamLineupsPanel && canEditTeamLineups && !canOperateLifecycle">
        <el-button
          type="primary"
          size="large"
          :loading="savingTeamAssignments"
          class="action-btn action-btn--bottom-save"
          @click="onSaveTeamAssignments"
        >
          保存轮次排位
        </el-button>
        <div class="lineup-save-hint">保存后请联系管理员或赛事创建者开启比赛</div>
      </template>
      <template v-else>
        <div v-if="!canOperateLifecycle" class="meta">仅管理员或赛事创建者可操作阶段变更</div>
        <el-button
          v-for="item in lifecycleActionButtons"
          :key="item.key"
          :type="item.type || 'primary'"
          size="large"
          :loading="savingLifecycle || settlingStatistics"
          :disabled="!canOperateLifecycle || item.disabled"
          class="action-btn"
          :class="{
            'action-btn--back': item.key === 'back_to_team_configuring',
            'action-btn--main': item.key !== 'back_to_team_configuring',
            'action-btn--single': lifecycleActionButtons.length === 1,
          }"
          @click="onLifecycleAction(item.key)"
        >
          {{ item.label }}
        </el-button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.detail-page {
  display: grid;
  gap: 12px;
}

.title {
  min-width: 0;
  color: #252b3a;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.overview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.status-chip,
.info-chip,
.config-mode-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-chip {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 0 10px;
}

.status-chip.is-draft {
  color: #8a6508;
  background: #fff6d8;
}

.status-chip.is-running {
  color: #237852;
  background: #e9f8f0;
}

.status-chip.is-finished {
  color: #667085;
  background: #eef1f6;
}

.overview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.info-chip {
  min-height: 27px;
  padding: 0 11px;
  color: #4b63d6;
  background: #edf1ff;
}

.info-chip--stage {
  color: #7354ad;
  background: #f3edff;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.stat-item {
  display: flex;
  min-width: 0;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3px;
  border-radius: 14px;
  background: #f6f7fc;
}

.stat-item strong {
  color: #30384a;
  font-size: 22px;
  line-height: 1.1;
}

.stat-item span {
  color: #818a9d;
  font-size: 11px;
}

.stat-item--male {
  background: #eef6ff;
}

.stat-item--male strong {
  color: #3987da;
}

.stat-item--female {
  background: #fff1f6;
}

.stat-item--female strong {
  color: #e56d9b;
}

.meta {
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.summary-block {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(120, 134, 161, 0.13);
  border-radius: 16px;
  background: linear-gradient(145deg, #fafbfe, #f6f8fd);
}

.summary-title {
  margin-bottom: 10px;
  color: #30384a;
  font-size: 14px;
  font-weight: 700;
}

.summary-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary-title-row--section {
  align-items: flex-start;
  margin-bottom: 11px;
}

.summary-title-row--section .summary-title {
  margin-bottom: 0;
}

.config-mode-badge {
  min-height: 24px;
  padding: 0 9px;
  color: #5c6fd7;
  background: #eaf0ff;
}

.config-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.config-stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding: 9px 10px;
  border-radius: 11px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(120, 134, 161, 0.1);
}

.config-stat span {
  color: #929aab;
  font-size: 10px;
}

.config-stat strong {
  color: #394155;
  font-size: 13px;
}

.round-config-list {
  display: grid;
  gap: 9px;
  margin-top: 12px;
}

.round-config-row {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: flex-start;
  gap: 9px;
}

.round-label {
  padding-top: 4px;
  color: #687187;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.event-tags,
.member-tags {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px;
}

.event-tag,
.member-tag {
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  padding: 3px 9px;
  border-radius: 8px;
  color: #536078;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(120, 134, 161, 0.13);
  font-size: 11px;
  line-height: 1.35;
}

.event-tag {
  color: #5067d8;
  background: #f1f4ff;
  box-shadow: inset 0 0 0 1px rgba(79, 109, 245, 0.12);
}

.event-tag--empty,
.empty-members {
  color: #a0a7b6;
}

.group-summary-list {
  display: grid;
  gap: 9px;
}

.group-summary-card {
  padding: 11px;
  border-radius: 12px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(120, 134, 161, 0.11);
}

.group-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.group-summary-header strong {
  color: #3e4659;
  font-size: 13px;
}

.group-summary-header span {
  color: #9299a9;
  font-size: 10px;
  white-space: nowrap;
}

.member-tag--male {
  color: #337fce;
  background: #eef6ff;
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.16);
}

.member-tag--female {
  color: #d95d8c;
  background: #fff1f6;
  box-shadow: inset 0 0 0 1px rgba(245, 108, 157, 0.16);
}

.empty-members {
  font-size: 11px;
}

.round-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 13px 14px;
  border-radius: 15px;
  background: linear-gradient(135deg, #eef2ff, #f5f1ff);
}

.round-progress-index {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.round-progress-index span {
  color: #7d869b;
  font-size: 10px;
}

.round-progress-index strong {
  color: #4359c8;
  font-size: 15px;
}

.round-progress-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #5f6880;
  font-size: 12px;
  font-weight: 600;
}

.progress-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5b75ee;
  box-shadow: 0 0 0 4px rgba(91, 117, 238, 0.12);
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lineup-summary-round + .lineup-summary-round {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(120, 134, 161, 0.12);
}

.lineup-summary-round-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 8px 0 10px;
}

.lineup-summary-round-title {
  color: #343c4f;
  font-size: 14px;
  font-weight: 700;
}

.round-scored-count {
  padding: 4px 8px;
  border-radius: 999px;
  color: #66708a;
  background: #edf0f7;
  font-size: 10px;
  font-weight: 600;
}

.lineup-summary-group-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.lineup-summary-group {
  overflow: hidden;
  border: 1px solid rgba(120, 134, 161, 0.13);
  border-radius: 14px;
  background: #fff;
}

.lineup-summary-group-header {
  display: flex;
  min-height: 62px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #f5f7ff, #faf9ff);
}

.lineup-summary-group-title {
  color: #343c4f;
  font-size: 14px;
  font-weight: 700;
}

.group-score-overview {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.group-score-overview > div {
  display: flex;
  min-width: 54px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px 8px;
  border-radius: 10px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(79, 109, 245, 0.1);
}

.group-score-overview strong {
  color: #4f65d6;
  font-size: 17px;
  line-height: 1.05;
}

.group-score-overview span {
  margin-top: 2px;
  color: #8a93a6;
  font-size: 9px;
}

.group-score-overview .group-net-score {
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(120, 134, 161, 0.09);
}

.group-score-overview .group-net-score strong {
  color: #778196;
  font-size: 14px;
}

.lineup-event-list {
  display: grid;
  padding: 0 12px;
}

.lineup-event-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(120, 134, 161, 0.1);
}

.lineup-event-row:last-child {
  border-bottom: 0;
}

.lineup-event-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.lineup-event-name {
  color: #44516c;
  font-size: 12px;
  font-weight: 700;
}

.lineup-event-members {
  overflow: hidden;
  color: #7b8498;
  font-size: 11px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lineup-event-score {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 4px;
  min-width: 74px;
  text-align: right;
}

.lineup-event-score strong {
  color: #5066d6;
  font-size: 17px;
  line-height: 1;
}

.lineup-event-score > span {
  color: #7f889b;
  font-size: 10px;
}

.lineup-event-score small {
  grid-column: 1 / -1;
  margin-top: 3px;
  color: #9aa1af;
  font-size: 9px;
}

.ranking-list {
  display: grid;
  gap: 9px;
}

.ranking-title-row {
  align-items: flex-start;
  margin-bottom: 10px;
}

.ranking-title-row .summary-title {
  margin-bottom: 0;
}

.ranking-tip {
  color: #9aa1b0;
  font-size: 9px;
}

.ranking-item {
  position: relative;
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  overflow: hidden;
  padding: 10px 12px;
  border: 1px solid rgba(120, 134, 161, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
}

.ranking-item--champion {
  min-height: 80px;
  padding: 12px 14px;
  border-color: rgba(224, 170, 60, 0.3);
  background:
    radial-gradient(circle at 92% 12%, rgba(255, 222, 132, 0.42), transparent 32%),
    linear-gradient(135deg, #fffaf0, #fff6d9);
  box-shadow: 0 10px 24px rgba(190, 137, 33, 0.12);
}

.ranking-item--champion::after {
  position: absolute;
  top: -28px;
  right: -24px;
  width: 82px;
  height: 82px;
  content: '';
  border: 18px solid rgba(255, 194, 68, 0.1);
  border-radius: 50%;
}

.ranking-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ranking-index {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #7186ef, #4f6df5);
  box-shadow: 0 5px 12px rgba(79, 109, 245, 0.2);
}

.ranking-item--champion .ranking-index {
  width: 38px;
  height: 38px;
  color: #fff;
  font-size: 19px;
  background: linear-gradient(145deg, #f6c75d, #e9a72c);
  box-shadow: 0 7px 16px rgba(211, 151, 33, 0.28);
}

.ranking-team {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.champion-label {
  color: #ba7a0c;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.ranking-name {
  overflow: hidden;
  color: #30384a;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-item--champion .ranking-name {
  color: #69470e;
  font-size: 15px;
}

.ranking-right {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.ranking-points {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.ranking-points strong {
  color: #4d63d8;
  font-size: 24px;
  line-height: 1;
}

.ranking-points span {
  color: #798296;
  font-size: 9px;
}

.ranking-item--champion .ranking-points strong {
  color: #c48412;
  font-size: 29px;
}

.ranking-net-score {
  min-width: 58px;
  color: #969dab;
  font-size: 10px;
  text-align: right;
}

.action-row {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.action-row > .meta {
  width: 100%;
  text-align: center;
}

.action-btn {
  min-width: 0;
  height: 44px;
  margin-left: 0 !important;
  border-radius: 8px;
}

.action-btn--back {
  flex: 0 0 32%;
  max-width: 120px;
  padding-right: 10px;
  padding-left: 10px;
  font-size: 13px;
}

.action-btn--main {
  flex: 1;
  font-weight: 600;
}

.action-btn--single {
  flex: 0 1 240px;
  width: min(100%, 240px);
}

.action-btn--bottom-save {
  flex: 0 1 370px;
  width: min(100%, 370px);
  min-height: 48px;
  font-size: 15px;
}

.lineup-save-hint {
  width: 100%;
  color: #7b8496;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
</style>
