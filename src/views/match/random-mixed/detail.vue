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

const isParticipantUser = computed(() => participantUserIdSet.value.has(currentUserId.value))
const canManageParticipants = computed(() => hasManagerPermission.value)
const canOperateLifecycle = computed(() => hasManagerPermission.value)
const canRecordScore = computed(() => hasManagerPermission.value || isParticipantUser.value)

const getUserLabel = (userId) =>
  participantOptions.value.find((item) => String(item.value) === String(userId))?.label || String(userId || '-')

const getParticipantValidationError = () => {
  if (unknownGenderCount.value > 0) return '存在未标注性别的参赛人员，请先完善为男/女。'
  if (maleCount.value < 2 || femaleCount.value < 2) return '随机混双至少需要 2 男 2 女。'
  if (maleCount.value !== femaleCount.value) return '随机混双要求男女人数必须 1:1。'
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

const pairNoOf = (maleIndex, femaleIndex, size) => maleIndex * size + femaleIndex + 1

const buildDisjointPairNoMatches = (size) => {
  const matches = []
  const coreSize = size % 2 === 0 ? size : size - 1

  for (let maleIndex = 0; maleIndex < coreSize; maleIndex += 2) {
    for (let femaleIndex = 0; femaleIndex < coreSize; femaleIndex += 2) {
      const p1 = pairNoOf(maleIndex, femaleIndex, size)
      const p2 = pairNoOf(maleIndex + 1, femaleIndex + 1, size)
      const p3 = pairNoOf(maleIndex, femaleIndex + 1, size)
      const p4 = pairNoOf(maleIndex + 1, femaleIndex, size)
      matches.push([p1, p2], [p3, p4])
    }
  }

  if (size % 2 === 1) {
    const last = size - 1
    for (let index = 0; index < size - 1; index += 1) {
      const pRow = pairNoOf(last, index, size)
      const pCol = pairNoOf(index, last, size)
      matches.push([pRow, pCol])
    }
  }

  return matches
}

const byePairs = computed(() => {
  const size = Number(maleCount.value || 0)
  if (!pairList.value.length || size < 1 || size % 2 === 0) return []
  const byePairNo = pairNoOf(size - 1, size - 1, size)
  return pairList.value.filter((item) => Number(item.pairNo) === byePairNo)
})

const fullMatchups = computed(() => {
  const size = Number(maleCount.value || 0)
  if (!pairList.value.length || size < 1 || femaleCount.value !== size) return []

  const byPairNo = new Map(pairList.value.map((item) => [Number(item.pairNo), item]))
  const pairNoMatches = buildDisjointPairNoMatches(size)
  const matches = []
  pairNoMatches.forEach(([homePairNo, awayPairNo]) => {
    const home = byPairNo.get(Number(homePairNo))
    const away = byPairNo.get(Number(awayPairNo))
    if (!home || !away) return

    const homeUsers = new Set([home.mixed_male, home.mixed_female].map((item) => String(item || '')))
    const awayUsers = [away.mixed_male, away.mixed_female].map((item) => String(item || ''))
    if (awayUsers.some((id) => homeUsers.has(id))) return

    matches.push({
      key: `${singleRoundNo}-mixed_double-${homePairNo}-${awayPairNo}`,
      homeLabel: `组合 ${homePairNo}`,
      awayLabel: `组合 ${awayPairNo}`,
      homeValue: `${home.maleLabel}\n${home.femaleLabel}`,
      awayValue: `${away.maleLabel}\n${away.femaleLabel}`,
    })
  })

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

const buildSingleRoundAssignments = () => {
  const validationMessage = getParticipantValidationError()
  if (validationMessage) throw new Error(validationMessage)

  const maleIds = shuffle(maleParticipants.value.map((item) => String(item.user_id || '')))
  const femaleIds = shuffle(femaleParticipants.value.map((item) => String(item.user_id || '')))
  const size = maleIds.length

  const rows = []
  let pairNo = 1
  for (let maleIndex = 0; maleIndex < size; maleIndex += 1) {
    for (let femaleIndex = 0; femaleIndex < size; femaleIndex += 1) {
      rows.push({
        round_no: singleRoundNo,
        group_no: pairNo,
        event_code: 'mixed_double',
        slot_code: 'mixed_male',
        user_id: maleIds[maleIndex],
      })
      rows.push({
        round_no: singleRoundNo,
        group_no: pairNo,
        event_code: 'mixed_double',
        slot_code: 'mixed_female',
        user_id: femaleIds[femaleIndex],
      })
      pairNo += 1
    }
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
  <section class="detail-page" v-loading="loading">
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
          {{ getParticipantValidationError() || `通过：将生成 ${maleCount * femaleCount} 个男女搭档组合，每人出战 ${maleCount} 局。` }}
        </div>
      </div>

      <div v-if="currentStage !== 'participant_adjusting'" class="summary-block">
        <div class="summary-title">对局信息</div>
        <div class="meta">总组合数：{{ pairList.length }}</div>
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
