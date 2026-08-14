<template>
  <el-card shadow="never">
    <template #header>
      <div class="header-row">
        <div class="title">团体赛参数</div>
        <el-button
          v-if="canEditTeamConfig"
          type="primary"
          size="small"
          :loading="savingTeamConfig"
          @click="$emit('save-config')"
        >
          保存团体参数
        </el-button>
      </div>
    </template>

    <div class="team-config-grid">
      <div class="config-item">
        <span class="config-label">分队组数</span>
        <el-input-number
          v-model="teamForm.groupCount"
          :min="2"
          :step="1"
          :disabled="!canEditTeamConfig"
        />
      </div>
      <div class="config-item">
        <span class="config-label">轮数</span>
        <el-input-number
          v-model="teamForm.roundCount"
          :min="1"
          :step="1"
          :disabled="!canEditTeamConfig"
          @change="$emit('round-count-change')"
        />
      </div>
      <div class="config-item">
        <span class="config-label">对局分值</span>
        <el-select v-model="teamForm.scoreTarget" :disabled="!canEditTeamConfig">
          <el-option
            v-for="score in teamScoreTargetOptions"
            :key="score"
            :label="`${score} 分制`"
            :value="score"
          />
        </el-select>
      </div>
    </div>

    <div class="schedule-mode-block">
      <div class="config-label">项目配置方式</div>
      <el-radio-group
        v-model="teamForm.scheduleMode"
        :disabled="!canEditTeamConfig"
        class="schedule-mode-options"
        @change="$emit('schedule-mode-change')"
      >
        <el-radio-button
          v-for="item in teamEventScheduleModes"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="teamForm.scheduleMode === 'uniform'" class="event-config-card">
      <div class="event-config-title">每轮项目</div>
      <div class="event-count-grid">
        <div v-for="item in teamEventOptions" :key="item.code" class="event-count-item">
          <span>{{ item.label }}</span>
          <el-input-number
            :model-value="getEventCount(teamForm.eventCodes, item.code)"
            :min="0"
            :max="10"
            :step="1"
            :disabled="!canEditTeamConfig"
            size="small"
            @change="setEventCount(teamForm.eventCodes, item.code, $event)"
          />
        </div>
      </div>
    </div>

    <div v-else class="round-event-list">
      <div v-for="roundNo in teamForm.roundCount" :key="roundNo" class="event-config-card">
        <div class="event-config-title">第 {{ roundNo }} 轮项目</div>
        <div class="event-count-grid">
          <div
            v-for="item in teamEventOptions"
            :key="`${roundNo}-${item.code}`"
            class="event-count-item"
          >
            <span>{{ item.label }}</span>
            <el-input-number
              :model-value="getEventCount(getRoundEventCodes(roundNo), item.code)"
              :min="0"
              :max="10"
              :step="1"
              :disabled="!canEditTeamConfig"
              size="small"
              @change="setEventCount(getRoundEventCodes(roundNo), item.code, $event)"
            />
          </div>
        </div>
        <div
          v-if="teamRosterRequirement.roundRequirements?.[roundNo - 1]"
          class="round-requirement"
        >
          本轮上场：{{ teamRosterRequirement.roundRequirements[roundNo - 1].total }} 人 （男
          {{ teamRosterRequirement.roundRequirements[roundNo - 1].male }} / 女
          {{ teamRosterRequirement.roundRequirements[roundNo - 1].female }}）
        </div>
      </div>
    </div>

    <div class="team-tip">
      每组名单需要：{{ teamMinPlayersPerGroup }} 人（男 {{ teamGenderRequirementPerGroup.male }} /
      女
      {{
        teamGenderRequirementPerGroup.female
      }}）。名单按所有轮次的最大男女需求计算，未上场成员可在对应轮次轮休。
    </div>
  </el-card>
</template>

<script setup>
const teamForm = defineModel('teamForm', { type: Object, required: true })

const props = defineProps({
  canEditTeamConfig: { type: Boolean, default: false },
  teamEventOptions: { type: Array, default: () => [] },
  teamEventScheduleModes: { type: Array, default: () => [] },
  teamScoreTargetOptions: { type: Array, default: () => [] },
  teamMinPlayersPerGroup: { type: Number, default: 0 },
  teamGenderRequirementPerGroup: { type: Object, default: () => ({ male: 0, female: 0 }) },
  teamRosterRequirement: { type: Object, default: () => ({ roundRequirements: [] }) },
  savingTeamConfig: { type: Boolean, default: false },
})

defineEmits(['save-config', 'round-count-change', 'schedule-mode-change'])

const getEventCount = (eventCodes, eventCode) =>
  (Array.isArray(eventCodes) ? eventCodes : []).filter((code) => String(code) === String(eventCode))
    .length

const setEventCount = (eventCodes, eventCode, count) => {
  if (!Array.isArray(eventCodes)) return
  const nextCount = Math.max(0, Number(count || 0))
  const countMap = new Map(
    props.teamEventOptions.map((item) => [
      item.code,
      String(item.code) === String(eventCode) ? nextCount : getEventCount(eventCodes, item.code),
    ])
  )
  const nextEventCodes = props.teamEventOptions.flatMap((item) =>
    Array.from({ length: Number(countMap.get(item.code) || 0) }, () => item.code)
  )
  eventCodes.splice(0, eventCodes.length, ...nextEventCodes)
}

const getRoundEventCodes = (roundNo) => {
  if (!Array.isArray(teamForm.value.roundEventCodes)) teamForm.value.roundEventCodes = []
  while (teamForm.value.roundEventCodes.length < Number(roundNo))
    teamForm.value.roundEventCodes.push([])
  return teamForm.value.roundEventCodes[Number(roundNo) - 1]
}
</script>

<style scoped>
.title {
  font-size: 15px;
  font-weight: 600;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.team-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.config-item {
  display: grid;
  gap: 6px;
}

.config-label {
  color: #606266;
  font-size: 12px;
}

.schedule-mode-block,
.round-event-list {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.schedule-mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.schedule-mode-options :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 9px 6px;
  font-size: 12px;
}

.event-config-card {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  display: grid;
  gap: 10px;
}

.round-event-list .event-config-card {
  margin-top: 0;
}

.event-config-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.event-count-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.event-count-item {
  min-width: 0;
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}

.event-count-item :deep(.el-input-number) {
  width: 88px;
}

.round-requirement {
  color: #909399;
  font-size: 12px;
}

.team-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
</style>
