<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { listAllUsers } from '@/api/admin'
import {
  getTournamentDetail,
  listTournamentTeamAssignments,
  listTournamentTeamMatchScores,
  saveTournamentTeamAssignments,
  saveTournamentTeamMatchScore,
  updateTournamentLifecycle,
  updateTournamentParticipants,
} from '@/api/tournament'
import { useAuthStore } from '@/stores/auth'
import { showErrorMessage } from '@/utils/error'
import TournamentParticipantsPanel from '@/views/match/team/components/tournament-participants-panel.vue'
import TournamentTeamMatchupsPanel from '@/views/match/team/components/tournament-team-matchups-panel.vue'

const route = useRoute()
const authStore = useAuthStore()

const loading = ref(false)
const detail = ref(null)
const users = ref([])

const participantEditorVisible = ref(false)
const selectedParticipantIds = ref([])
const savingParticipants = ref(false)
const savingLifecycle = ref(false)
const savingMatchScore = ref(false)
const refreshingMatchups = ref(false)
const pageLoading = computed(
  () =>
    loading.value ||
    savingParticipants.value ||
    savingLifecycle.value ||
    savingMatchScore.value ||
    refreshingMatchups.value
)

const assignmentDraft = ref([])
const matchupScoreDraft = ref({})

const scoreTarget = 21
const singleRoundNo = 1

const genderMap = { 0: '未知', 1: '男', 2: '女' }

const stageLabelMap = {
  participant_adjusting: '参赛人员调整',
  rounds_in_progress: '比赛进行中',
  finished: '全部完成',
}

const currentUserId = computed(() => String(authStore.user?.id || ''))
const isTournamentCreator = computed(
  () =>
    String(detail.value?.created_by_user_id || '') &&
    String(detail.value?.created_by_user_id || '') === currentUserId.value
)
const hasAdminPermission = computed(() => authStore.isAdmin || authStore.hasPermission('admin'))
const hasManagerPermission = computed(() => hasAdminPermission.value || isTournamentCreator.value)

const currentStage = computed(() => {
  const stage = String(detail.value?.stage || '')
  if (stage === 'finished') return 'finished'
  if (stage === 'rounds_in_progress') return 'rounds_in_progress'
  return 'participant_adjusting'
})

const userMap = computed(() => {
  const map = new Map()
  users.value.forEach((item) => {
    map.set(String(item.user_id || item.id), item)
  })
  return map
})

const enrichedParticipants = computed(() =>
  (detail.value?.participants || []).map((item) => {
    const user = userMap.value.get(String(item.user_id || ''))
    const gender = Number(user?.gender)
    const normalizedGender = Number.isFinite(gender) ? gender : 0
    return {
      ...item,
      gender: normalizedGender,
      gender_text: genderMap[normalizedGender] || '未知',
    }
  })
)

const participantOptions = computed(() =>
  enrichedParticipants.value.map((item) => ({
    value: String(item.user_id || ''),
    label: item.nickname || item.user_id,
    gender: Number(item.gender || 0),
  }))
)

const participantUserIdSet = computed(
  () => new Set((detail.value?.participants || []).map((item) => String(item.user_id || '')))
)

const maleParticipants = computed(() =>
  enrichedParticipants.value.filter((item) => Number(item.gender) === 1)
)
const femaleParticipants = computed(() =>
  enrichedParticipants.value.filter((item) => Number(item.gender) === 2)
)

const maleCount = computed(() => maleParticipants.value.length)
const femaleCount = computed(() => femaleParticipants.value.length)
const unknownGenderCount = computed(
  () => enrichedParticipants.value.filter((item) => ![1, 2].includes(Number(item.gender))).length
)
const totalParticipantCount = computed(() => maleCount.value + femaleCount.value)
const FAIR_PLAN_GAMES = {
  6: [6, 12],
  8: [4, 8],
  10: [10],
  12: [6, 12],
  16: [8],
  20: [10],
}
const RANDOM_PLAN_TOTAL_SET = new Set([6, 8, 10, 12, 14, 16, 18, 20, 22, 24])
const planCode = ref('fair')
const gamesPerPlayer = ref(0)

const isParticipantUser = computed(() => participantUserIdSet.value.has(currentUserId.value))
const canManageParticipants = computed(() => hasManagerPermission.value)
const canOperateLifecycle = computed(() => hasManagerPermission.value)
const canRecordScore = computed(() => hasManagerPermission.value || isParticipantUser.value)

const getUserLabel = (userId) =>
  participantOptions.value.find((item) => String(item.value) === String(userId))?.label || String(userId || '-')
const getLevelScore = (userId) => {
  const user = userMap.value.get(String(userId || ''))
  const level = Number(user?.level)
  return Number.isFinite(level) ? level : 0
}
const getPairStrength = (edge) => getLevelScore(edge?.male) + getLevelScore(edge?.female)
const MAX_PAIR_STRENGTH_GAP = 1
const getMatchBalanceScore = (edgeA, edgeB) => {
  const pairDiff = Math.abs(getPairStrength(edgeA) - getPairStrength(edgeB))
  const maleDiff = Math.abs(getLevelScore(edgeA?.male) - getLevelScore(edgeB?.male))
  const femaleDiff = Math.abs(getLevelScore(edgeA?.female) - getLevelScore(edgeB?.female))
  return pairDiff * 10 + maleDiff + femaleDiff
}

const gcd = (a, b) => {
  let x = Math.abs(Number(a || 0))
  let y = Math.abs(Number(b || 0))
  while (y) {
    const temp = x % y
    x = y
    y = temp
  }
  return x || 1
}

const minGamesPerPlayer = computed(() => {
  const total = Number(totalParticipantCount.value || 0)
  if (total <= 4 || total % 2 !== 0) return 0
  return Math.max(1, 4 / gcd(total, 4))
})

const expectedMatchCount = computed(() => {
  const total = Number(totalParticipantCount.value || 0)
  const games = Number(gamesPerPlayer.value || 0)
  if (total < 1 || games < 1) return 0
  return (total * games) / 4
})

const availablePlans = computed(() => {
  const total = Number(totalParticipantCount.value || 0)
  if (!RANDOM_PLAN_TOTAL_SET.has(total)) return []
  const plans = [{ value: 'random', label: '方案二：随机混搭' }]
  if (Object.prototype.hasOwnProperty.call(FAIR_PLAN_GAMES, total)) {
    plans.unshift({ value: 'fair', label: '方案一：公平混搭' })
  }
  return plans
})

const availableGamesPerPlayer = computed(() => {
  const total = Number(totalParticipantCount.value || 0)
  if (planCode.value === 'fair') return FAIR_PLAN_GAMES[total] || []
  if (!RANDOM_PLAN_TOTAL_SET.has(total)) return []
  if (total % 4 === 0) return [4, 5, 6, 7, 8, 9, 10]
  return [4, 6, 8, 10]
})

const syncPlanSelection = () => {
  const planValues = availablePlans.value.map((item) => item.value)
  if (!planValues.length) {
    planCode.value = 'fair'
    gamesPerPlayer.value = 0
    return
  }
  if (!planValues.includes(planCode.value)) {
    planCode.value = planValues[0]
  }
  const gameOptions = availableGamesPerPlayer.value
  if (!gameOptions.includes(Number(gamesPerPlayer.value || 0))) {
    gamesPerPlayer.value = Number(gameOptions[0] || 0)
  }
}

const getParticipantValidationError = (strictSelection = false) => {
  if (unknownGenderCount.value > 0) return '存在未标注性别的参赛人员，请先完善为男/女。'
  if (totalParticipantCount.value <= 4) return '参赛总人数必须大于 4。'
  if (totalParticipantCount.value % 2 !== 0) return '参赛总人数必须是偶数。'
  if (maleCount.value !== femaleCount.value) return '随机混双要求男女人数必须 1:1。'
  if (maleCount.value < 2 || femaleCount.value < 2) return '随机混双至少需要 2 男 2 女。'
  if (!availablePlans.value.length) return '当前人数仅支持 6/8/10/12/14/16/18/20/22/24。'
  if (strictSelection) {
    if (!availablePlans.value.some((item) => item.value === planCode.value)) return '请先选择赛程方案。'
    if (!availableGamesPerPlayer.value.includes(Number(gamesPerPlayer.value || 0))) return '请先选择每人局数。'
  }
  return ''
}

const normalizeAssignments = (rows = []) =>
  rows
    .filter((item) => String(item.event_code || '') === 'mixed_double')
    .filter(
      (item) =>
        Number(item.round_no) === singleRoundNo &&
        Number(item.group_no) > 0 &&
        ['mixed_male', 'mixed_female'].includes(String(item.slot_code || ''))
    )

const pairList = computed(() => {
  const pairMap = new Map()
  normalizeAssignments(assignmentDraft.value).forEach((item) => {
    const pairNo = Number(item.group_no)
    const current = pairMap.get(pairNo) || {
      pairNo,
      mixed_male: '',
      mixed_female: '',
    }
    current[String(item.slot_code)] = String(item.user_id || '')
    pairMap.set(pairNo, current)
  })

  return [...pairMap.values()].sort((a, b) => a.pairNo - b.pairNo).map((item) => ({
    ...item,
    maleLabel: getUserLabel(item.mixed_male),
    femaleLabel: getUserLabel(item.mixed_female),
  }))
})

const byePairs = computed(() => [])

const fullMatchups = computed(() => {
  if (!pairList.value.length) return []

  const matches = []
  for (let index = 0; index + 1 < pairList.value.length; index += 2) {
    const home = pairList.value[index]
    const away = pairList.value[index + 1]
    if (!home || !away) continue

    const homeUsers = new Set([home.mixed_male, home.mixed_female].map((item) => String(item || '')))
    const awayUsers = [away.mixed_male, away.mixed_female].map((item) => String(item || ''))
    if (awayUsers.some((id) => homeUsers.has(id))) continue

    matches.push({
      key: `${singleRoundNo}-mixed_double-${home.pairNo}-${away.pairNo}`,
      homeLabel: `组合 ${home.pairNo}`,
      awayLabel: `组合 ${away.pairNo}`,
      homeValue: `${home.maleLabel}\n${home.femaleLabel}`,
      awayValue: `${away.maleLabel}\n${away.femaleLabel}`,
    })
  }

  return [
    {
      key: 'random-mixed-all-matches',
      eventLabel: '随机混双全量对局',
      matches,
    },
  ]
})

const totalMatchCount = computed(() => fullMatchups.value[0]?.matches?.length || 0)

const getUnscoredMatchKeys = () => {
  const matchKeys = (fullMatchups.value[0]?.matches || []).map((item) => String(item.key))
  return matchKeys.filter((key) => {
    const score = matchupScoreDraft.value?.[key]
    return !(Number.isInteger(Number(score?.homeScore)) && Number.isInteger(Number(score?.awayScore)))
  })
}

const buildScoreDraft = (scores = []) => {
  const next = {}
  ;(Array.isArray(scores) ? scores : [])
    .filter((item) => String(item.event_code || '') === 'mixed_double')
    .filter((item) => Number(item.round_no) === singleRoundNo)
    .forEach((item) => {
      const key = [singleRoundNo, 'mixed_double', Number(item.home_group_no || 0), Number(item.away_group_no || 0)].join('-')
      next[key] = {
        homeScore: Number(item.home_score),
        awayScore: Number(item.away_score),
      }
    })
  matchupScoreDraft.value = next
}

const shuffle = (list = []) => {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}

const buildMatchesByEdges = (edgeList = [], maxPairStrengthGap = MAX_PAIR_STRENGTH_GAP) => {
  if (!Array.isArray(edgeList) || !edgeList.length || edgeList.length % 2 !== 0) return null

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const pool = shuffle(edgeList)
    const result = []

    while (pool.length) {
      const first = pool.pop()
      let bestIndex = -1
      let bestScore = Number.POSITIVE_INFINITY

      for (let index = 0; index < pool.length; index += 1) {
        const candidate = pool[index]
        if (!candidate) continue
        if (candidate.male === first.male || candidate.female === first.female) continue
        const pairStrengthGap = Math.abs(getPairStrength(first) - getPairStrength(candidate))
        if (pairStrengthGap > maxPairStrengthGap) continue
        const score = getMatchBalanceScore(first, candidate) + Math.random() * 0.001
        if (score < bestScore) {
          bestScore = score
          bestIndex = index
        }
      }

      if (bestIndex < 0) {
        result.length = 0
        break
      }

      const [second] = pool.splice(bestIndex, 1)
      result.push({ a: first, b: second })
    }

    if (result.length * 2 === edgeList.length) return result
  }

  return null
}

// 对局分配核心函数：基于参赛人员、方案和每人局数，生成随机混双分配 rows
const buildSingleRoundAssignments = () => {
  const validationMessage = getParticipantValidationError(true)
  if (validationMessage) throw new Error(validationMessage)

  const maleIds = shuffle(maleParticipants.value.map((item) => String(item.user_id || '')))
  const femaleIds = shuffle(femaleParticipants.value.map((item) => String(item.user_id || '')))
  const size = maleIds.length
  const games = Number(gamesPerPlayer.value || 0)
  const edges = []

  if (planCode.value === 'fair') {
    const repeat = games / size
    if (!Number.isInteger(repeat) || repeat < 1) {
      throw new Error('公平混搭方案的局数配置不合法。')
    }
    for (let round = 0; round < repeat; round += 1) {
      const roundMales = shuffle(maleIds)
      const roundFemales = shuffle(femaleIds)
      roundMales.forEach((maleId) => {
        roundFemales.forEach((femaleId) => {
          edges.push({ male: maleId, female: femaleId })
        })
      })
    }
  } else {
    const maleStubs = []
    const femaleStubs = []
    maleIds.forEach((id) => {
      for (let index = 0; index < games; index += 1) maleStubs.push(id)
    })
    femaleIds.forEach((id) => {
      for (let index = 0; index < games; index += 1) femaleStubs.push(id)
    })
    const sortedMaleStubs = [...maleStubs].sort(
      (a, b) => getLevelScore(b) - getLevelScore(a) || Math.random() - 0.5
    )
    const femalePool = [...femaleStubs]
    sortedMaleStubs.forEach((maleId) => {
      let bestIndex = 0
      let bestScore = Number.POSITIVE_INFINITY
      for (let index = 0; index < femalePool.length; index += 1) {
        const candidateFemale = femalePool[index]
        const score = Math.abs(getLevelScore(maleId) - getLevelScore(candidateFemale))
        if (score < bestScore) {
          bestScore = score
          bestIndex = index
        }
      }
      const [femaleId] = femalePool.splice(bestIndex, 1)
      edges.push({
        male: maleId,
        female: femaleId,
      })
    })
  }

  let matchList = null
  matchList = buildMatchesByEdges(edges)
  if (!matchList?.length) {
    throw new Error(`赛程生成失败：无法将每组等级差控制在 ${MAX_PAIR_STRENGTH_GAP} 以内，请调整人数或每人局数后重试。`)
  }

  const rows = []
  let pairNoCursor = 1
  matchList.forEach((match) => {
    rows.push({
      round_no: singleRoundNo,
      group_no: pairNoCursor,
      event_code: 'mixed_double',
      slot_code: 'mixed_male',
      user_id: match.a.male,
    })
    rows.push({
      round_no: singleRoundNo,
      group_no: pairNoCursor,
      event_code: 'mixed_double',
      slot_code: 'mixed_female',
      user_id: match.a.female,
    })
    rows.push({
      round_no: singleRoundNo,
      group_no: pairNoCursor + 1,
      event_code: 'mixed_double',
      slot_code: 'mixed_male',
      user_id: match.b.male,
    })
    rows.push({
      round_no: singleRoundNo,
      group_no: pairNoCursor + 1,
      event_code: 'mixed_double',
      slot_code: 'mixed_female',
      user_id: match.b.female,
    })
    pairNoCursor += 2
  })

  if (rows.length / 4 !== expectedMatchCount.value) {
    throw new Error('生成赛程异常：对局数量与预期不一致。')
  }

  return rows
}

const loadUsers = async () => {
  users.value = await listAllUsers()
}

const loadDetail = async () => {
  detail.value = await getTournamentDetail(route.params.id)
  selectedParticipantIds.value = (detail.value?.participants || []).map((item) => String(item.user_id || ''))
}

const loadBusinessData = async () => {
  const [assignments, scores] = await Promise.all([
    listTournamentTeamAssignments(detail.value?.id),
    listTournamentTeamMatchScores(detail.value?.id),
  ])
  assignmentDraft.value = normalizeAssignments(assignments)
  buildScoreDraft(scores)
}

const reloadAll = async () => {
  try {
    loading.value = true
    await Promise.all([loadUsers(), loadDetail()])
    await loadBusinessData()
    syncPlanSelection()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const toggleParticipant = (userId) => {
  const id = String(userId || '')
  const index = selectedParticipantIds.value.indexOf(id)
  if (index >= 0) selectedParticipantIds.value.splice(index, 1)
  else selectedParticipantIds.value.push(id)
}

const getSelectedUsers = () => {
  const selectedSet = new Set(selectedParticipantIds.value)
  return users.value
    .filter((item) => selectedSet.has(String(item.user_id || item.id)))
    .map((item) => ({
      user_id: String(item.user_id || item.id),
      nickname: item.nickname || item.user_id || item.id,
    }))
}

const persistParticipants = async () => {
  const selectedUsers = getSelectedUsers()
  await updateTournamentParticipants({
    tournamentId: detail.value?.id,
    participants: selectedUsers,
  })
}

const onSaveParticipants = async () => {
  try {
    if (!canManageParticipants.value) throw new Error('仅管理员或创建者可修改参赛人员。')
    savingParticipants.value = true
    await persistParticipants()
    ElMessage.success('参赛人员已更新')
    await reloadAll()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingParticipants.value = false
  }
}

const setLifecycle = async ({ stage, currentRoundNo: roundNo, currentRoundState }) => {
  await updateTournamentLifecycle({
    tournamentId: detail.value?.id,
    stage,
    currentRoundNo: roundNo,
    currentRoundState,
  })
  await loadDetail()
}

const onStartRandomMixed = async () => {
  try {


    if (!canOperateLifecycle.value) throw new Error('仅管理员或创建者可开始赛事。')
    savingLifecycle.value = true

    await persistParticipants()
    await reloadAll()

    const rows = buildSingleRoundAssignments()
    await saveTournamentTeamAssignments({
      tournamentId: detail.value?.id,
      assignments: rows,
    })

    await setLifecycle({
      stage: 'rounds_in_progress',
      currentRoundNo: singleRoundNo,
      currentRoundState: 'playing',
    })

    await loadBusinessData()
    ElMessage.success('随机混双赛程已生成')
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingLifecycle.value = false
  }
}

const onFinishTournament = async () => {
  try {
    if (!canOperateLifecycle.value) throw new Error('仅管理员或创建者可完赛。')
    savingLifecycle.value = true

    const unscoredKeys = getUnscoredMatchKeys()
    if (unscoredKeys.length > 0) {
      throw new Error(`还有 ${unscoredKeys.length} 场未录分，不能完赛。`)
    }

    await ElMessageBox.confirm('确认结束随机混双比赛吗？', '完成赛事', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })

    await setLifecycle({
      stage: 'finished',
      currentRoundNo: singleRoundNo,
      currentRoundState: 'round_finished',
    })
    ElMessage.success('赛事已完成')
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingLifecycle.value = false
  }
}

const onMatchScoreSubmit = async ({ matchKey, homeScore, awayScore }) => {
  try {
    if (!canRecordScore.value) throw new Error('仅参赛人员、管理员或创建者可录入比分。')
    const key = String(matchKey || '')
    const [roundNoText, eventCode, homePairText, awayPairText] = key.split('-')
    const roundNo = Number(roundNoText)
    const homePairNo = Number(homePairText)
    const awayPairNo = Number(awayPairText)
    const nextHome = Number(homeScore)
    const nextAway = Number(awayScore)

    if (
      roundNo !== singleRoundNo ||
      eventCode !== 'mixed_double' ||
      !Number.isInteger(homePairNo) ||
      !Number.isInteger(awayPairNo) ||
      !Number.isInteger(nextHome) ||
      !Number.isInteger(nextAway) ||
      nextHome < 0 ||
      nextAway < 0
    ) {
      throw new Error('比分参数无效，请重试。')
    }

    savingMatchScore.value = true
    await saveTournamentTeamMatchScore({
      tournamentId: detail.value?.id,
      score: {
        round_no: singleRoundNo,
        event_code: eventCode,
        home_group_no: homePairNo,
        away_group_no: awayPairNo,
        home_score: nextHome,
        away_score: nextAway,
      },
    })

    matchupScoreDraft.value[key] = {
      homeScore: nextHome,
      awayScore: nextAway,
    }

    ElMessage.success('比分已保存')
  } catch (error) {
    showErrorMessage(error)
  } finally {
    savingMatchScore.value = false
  }
}

const onRefreshMatchups = async () => {
  try {
    refreshingMatchups.value = true
    await loadBusinessData()
    ElMessage.success('对局与比分已刷新')
  } catch (error) {
    showErrorMessage(error)
  } finally {
    refreshingMatchups.value = false
  }
}

const lifecycleActionButtons = computed(() => {
  if (currentStage.value === 'participant_adjusting') {
    return [{ key: 'start_random_mixed', label: '生成赛程并开始比赛', type: 'primary' }]
  }
  if (currentStage.value === 'rounds_in_progress') {
    return [{ key: 'finish_tournament', label: '完成赛事', type: 'primary' }]
  }
  return []
})

const onLifecycleAction = async (action) => {
  if (action === 'start_random_mixed') {
    await onStartRandomMixed()
    return
  }
  if (action === 'finish_tournament') {
    await onFinishTournament()
  }
}

onMounted(async () => {
  await authStore.loadPermissions()
  await reloadAll()
})
</script>

<template>
  <section class="detail-page" v-loading.fullscreen.lock="pageLoading">
    <el-card shadow="never">
      <template #header>
        <div class="title">{{ detail?.name || '随机混双轮转' }}</div>
      </template>

      <div class="meta">对局模式：随机混双轮转</div>
      <div class="meta">赛事状态：{{ detail?.status || 'draft' }}</div>
      <div class="meta">赛事阶段：{{ stageLabelMap[currentStage] || currentStage }}</div>
      <div class="meta">参赛人数：{{ detail?.participant_count || 0 }}（男 {{ maleCount }} / 女 {{ femaleCount }}）</div>

      <div class="summary-block">
        <div class="summary-title">规则校验</div>
        <div class="meta" :class="{ 'meta--danger': !!getParticipantValidationError() }">
          {{
            getParticipantValidationError() ||
            `通过：总人数 ${totalParticipantCount}，当前方案为${planCode === 'fair' ? '公平混搭' : '随机混搭'}，每人出战 ${gamesPerPlayer} 局，并按 level 优先匹配实力接近对手。`
          }}
        </div>
      </div>

      <div v-if="currentStage === 'participant_adjusting'" class="summary-block">
        <div class="summary-title">赛程配置</div>
        <div class="config-row">
          <span class="config-label">方案选择</span>
          <el-radio-group v-model="planCode" @change="syncPlanSelection">
            <el-radio-button v-for="item in availablePlans" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="config-row">
          <span class="config-label">每人局数</span>
          <el-radio-group v-model="gamesPerPlayer">
            <el-radio-button v-for="item in availableGamesPerPlayer" :key="item" :value="item">
              {{ item }} 局
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div v-if="currentStage !== 'participant_adjusting'" class="summary-block">
        <div class="summary-title">对局信息</div>
        <div class="meta">方案：{{ planCode === 'fair' ? '公平混搭' : '随机混搭' }}</div>
        <div class="meta">每人局数：{{ gamesPerPlayer }}</div>
        <div class="meta">总对局数：{{ totalMatchCount }}</div>
      </div>

      <div v-if="byePairs.length" class="summary-block">
        <div class="summary-title">轮空组合</div>
        <div v-for="item in byePairs" :key="`bye-${item.pairNo}`" class="meta">
          组合 {{ item.pairNo }}：{{ item.maleLabel }} + {{ item.femaleLabel }}
        </div>
      </div>
    </el-card>

    <TournamentParticipantsPanel
      v-if="currentStage === 'participant_adjusting'"
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

    <TournamentTeamMatchupsPanel
      v-if="currentStage === 'rounds_in_progress' || currentStage === 'finished'"
      :round-no="singleRoundNo"
      :matchups="fullMatchups"
      :score-target="scoreTarget"
      :score-draft="matchupScoreDraft"
      :saving-score="savingMatchScore"
      :refreshing="refreshingMatchups"
      @score-submit="onMatchScoreSubmit"
      @refresh="onRefreshMatchups"
    />

    <div v-if="lifecycleActionButtons.length" class="action-row">
      <div class="meta" v-if="!canOperateLifecycle">仅管理员或创建者可推进赛事</div>
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

.meta--danger {
  color: #f56c6c;
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

.config-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.config-label {
  width: 100px;
  font-size: 13px;
  color: #606266;
  line-height: 32px;
}

:deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.action-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.action-btn {
  min-width: 220px;
}
</style>
