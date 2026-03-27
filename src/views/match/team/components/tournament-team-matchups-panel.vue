<template>
  <el-card shadow="never">
    <template #header>
      <div class="header-row">
        <div class="title">当前对局匹配</div>
        <div class="header-actions">
          <div class="subtitle">第 {{ roundNo }} 轮</div>
          <el-button plain :loading="refreshing" @click="emit('refresh')">刷新</el-button>
        </div>
      </div>
    </template>

    <div v-if="matchups.length" class="matchup-list">
      <div v-for="item in matchups" :key="item.key" class="matchup-card">
        <div class="matchup-title">{{ item.eventLabel }}</div>
        <div class="event-list">
          <div v-for="match in item.matches || []" :key="match.key" class="event-item">
            <div class="event-row" :class="{
              'event-row--home-winner': getWinnerSide(match.key) === 'home',
              'event-row--away-winner': getWinnerSide(match.key) === 'away',
            }">
              <div class="event-group" :class="{ 'event-group--winner': getWinnerSide(match.key) === 'home' }">
                {{ match.homeLabel }}
                <el-tag v-if="getWinnerSide(match.key) === 'home'" size="small" type="success" effect="plain">胜</el-tag>
              </div>
              <div class="event-side" :class="{ 'event-side--winner': getWinnerSide(match.key) === 'home' }">
                {{ match.homeValue }}
              </div>
              <div class="event-score">
                <span class="score-num" :class="{ 'score-num--winner': getWinnerSide(match.key) === 'home' }">
                  {{ getScoreValue(match.key, 'homeScore') ?? '-' }}
                </span>
                <span class="event-vs">VS</span>
                <span class="score-num" :class="{ 'score-num--winner': getWinnerSide(match.key) === 'away' }">
                  {{ getScoreValue(match.key, 'awayScore') ?? '-' }}
                </span>
              </div>
              <div class="event-side event-side-end"
                :class="{ 'event-side--winner': getWinnerSide(match.key) === 'away' }">
                {{ match.awayValue }}</div>
              <div class="event-group" :class="{ 'event-group--winner': getWinnerSide(match.key) === 'away' }">
                {{ match.awayLabel }}
                <el-tag v-if="getWinnerSide(match.key) === 'away'" size="small" type="success" effect="plain">胜</el-tag>
              </div>
            </div>
            <div class="event-action">
              <el-icon class="action-icon" @click="openScoreDialog(match, item.eventLabel)">
                <Edit v-if="hasScore(match.key)" />
                <CirclePlus v-else />
              </el-icon>
            </div>
          </div>
          <div v-if="!(item.matches || []).length" class="empty-row">该项目暂无可匹配分组</div>
        </div>
      </div>
    </div>
    <el-empty v-else description="当前轮次暂无可展示的匹配数据" />

    <el-dialog v-model="scoreDialogVisible" title="录入比分" width="92%" :close-on-click-modal="false" destroy-on-close>
      <div class="dialog-meta">
        <div>{{ dialogEventLabel }}</div>
        <div>{{ dialogHomeLabel }} VS {{ dialogAwayLabel }}</div>
      </div>
      <div class="dialog-players">
        <div class="players-block">
          <div class="players-title">{{ dialogHomeLabel }} 出场</div>
          <div class="players-list">
            <el-tag v-for="name in dialogHomePlayers" :key="`h-${name}`" size="small" effect="plain">
              {{ name }}
            </el-tag>
          </div>
          <div class="dialog-score-inline">
            <el-input-number v-model="dialogHomeScore" :min="0" :max="scoreTarget" />
          </div>
        </div>
        <div class="players-block">
          <div class="players-title">{{ dialogAwayLabel }} 出场</div>
          <div class="players-list">
            <el-tag v-for="name in dialogAwayPlayers" :key="`a-${name}`" size="small" effect="plain">
              {{ name }}
            </el-tag>
          </div>
          <div class="dialog-score-inline">
            <el-input-number v-model="dialogAwayScore" :min="0" :max="scoreTarget" />
          </div>
        </div>
      </div>
      <div class="quick-row">
        <el-button v-for="item in quickScoreOptions" :key="item.label" size="small"
          @click="applyQuickScore(item.home, item.away)">
          {{ item.label }}
        </el-button>
        <el-button size="small" type="success" plain @click="applyQuickWinner('home')">主队胜</el-button>
        <el-button size="small" plain @click="reverseScore">比分反转</el-button>
        <el-button size="small" type="success" plain @click="applyQuickWinner('away')">客队胜</el-button>
      </div>
      <template #footer>
        <el-button @click="scoreDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingScore" @click="submitScore">确认</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { CirclePlus, Edit } from '@element-plus/icons-vue'

const emit = defineEmits(['score-submit', 'refresh'])
const props = defineProps({
  roundNo: { type: Number, default: 0 },
  matchups: { type: Array, default: () => [] },
  scoreTarget: { type: Number, default: 21 },
  scoreDraft: { type: Object, default: () => ({}) },
  savingScore: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },
})
const getScoreValue = (matchKey, side) => {
  const score = props.scoreDraft?.[String(matchKey)]?.[side]
  return Number.isFinite(Number(score)) ? Number(score) : undefined
}
const hasScore = (matchKey) => {
  const home = getScoreValue(matchKey, 'homeScore')
  const away = getScoreValue(matchKey, 'awayScore')
  return Number.isFinite(Number(home)) && Number.isFinite(Number(away))
}
const getWinnerSide = (matchKey) => {
  const home = Number(getScoreValue(matchKey, 'homeScore'))
  const away = Number(getScoreValue(matchKey, 'awayScore'))
  if (!Number.isFinite(home) || !Number.isFinite(away) || home === away) return ''
  return home > away ? 'home' : 'away'
}

const scoreDialogVisible = ref(false)
const dialogMatchKey = ref('')
const dialogEventLabel = ref('')
const dialogHomeLabel = ref('')
const dialogAwayLabel = ref('')
const dialogHomeScore = ref(0)
const dialogAwayScore = ref(0)
const dialogHomePlayers = ref([])
const dialogAwayPlayers = ref([])
const quickScoreOptions = computed(() => {
  return [
    { label: '21:11', home: 21, away: 11 },
    { label: '21:15', home: 21, away: 15 },
    { label: '21:18', home: 21, away: 18 },
    { label: '21:20', home: 21, away: 20 },
  ]
})
const openScoreDialog = (match, eventLabel) => {
  dialogMatchKey.value = String(match?.key || '')
  dialogEventLabel.value = String(eventLabel || '')
  dialogHomeLabel.value = String(match?.homeLabel || '')
  dialogAwayLabel.value = String(match?.awayLabel || '')
  dialogHomeScore.value = getScoreValue(dialogMatchKey.value, 'homeScore') ?? 0
  dialogAwayScore.value = getScoreValue(dialogMatchKey.value, 'awayScore') ?? 0
  dialogHomePlayers.value = String(match?.homeValue || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  dialogAwayPlayers.value = String(match?.awayValue || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  scoreDialogVisible.value = true
}

const applyQuickScore = (home, away) => {
  dialogHomeScore.value = Number(home)
  dialogAwayScore.value = Number(away)
}
const applyQuickWinner = (side) => {
  const target = Math.max(1, Number(props.scoreTarget || 21))
  const loser = Math.floor(target / 2)
  if (side === 'home') applyQuickScore(target, loser)
  else applyQuickScore(loser, target)
}
const reverseScore = () => {
  const home = Number(dialogHomeScore.value || 0)
  const away = Number(dialogAwayScore.value || 0)
  dialogHomeScore.value = away
  dialogAwayScore.value = home
}
const submitScore = () => {
  if (!dialogMatchKey.value) return
  emit('score-submit', {
    matchKey: dialogMatchKey.value,
    homeScore: dialogHomeScore.value,
    awayScore: dialogAwayScore.value,
  })
  scoreDialogVisible.value = false
}
</script>

<style lang="scss" scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 80px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.subtitle {
  color: #909399;
  font-size: 12px;
}

.matchup-list {
  display: grid;
  gap: 30px;
}

.matchup-card {
  border-radius: 8px;
  display: grid;
  gap: 8px;
}

.matchup-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.event-list {
  display: grid;
  gap: 26px;
}

.event-item {
  position: relative;
}

.event-row {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) 60px minmax(0, 1fr) 50px;
  gap: 6px;
  align-items: center;
  border-radius: 8px;
  padding: 6px 8px;
  margin-right: 14px;
}

.event-row--home-winner {
  background: linear-gradient(90deg, #e8f8ec 0%, #f6fcf8 42%, rgba(255, 255, 255, 0) 100%);
}

.event-row--away-winner {
  background: linear-gradient(270deg, #e8f8ec 0%, #f6fcf8 42%, rgba(255, 255, 255, 0) 100%);
}

.event-group {
  color: #606266;
  font-size: 12px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.event-group--winner {
  color: #67c23a;
  font-weight: 600;
}

.event-side {
  font-size: 13px;
  color: #303133;
  word-break: break-all;
  white-space: pre-line;
}

.event-side--winner {
  color: #67c23a;
  font-weight: 600;
}

.event-side-end {
  text-align: end;
}

.event-score {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.score-num {
  min-width: 24px;
  text-align: center;
  font-size: 13px;
  color: #606266;
}

.score-num--winner {
  color: #67c23a;
  font-weight: 700;
}

.event-vs {
  font-size: 12px;
  text-align: center;
  color: #909399;
}

.event-action {
  position: absolute;
  right: -10px;
  bottom: 14px;
}

.action-icon {
  font-size: 18px;
  color: #409eff;
}

.dialog-meta {
  margin-bottom: 10px;
  font-size: 13px;
  color: #606266;
  display: grid;
  gap: 4px;
}

.dialog-players {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}

.players-block {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 8px;
  position: relative;

  .dialog-score-inline {
    position: absolute;
    right: 16px;
    top: 14px;
  }
}

.players-title {
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
}

.players-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dialog-score-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.score-side {
  font-size: 12px;
  color: #606266;
}

.score-vs {
  font-size: 12px;
  color: #909399;
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
  margin-bottom: 10px;
}

.empty-row {
  font-size: 12px;
  color: #909399;
}
</style>
