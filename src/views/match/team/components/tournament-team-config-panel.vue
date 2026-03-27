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
        <el-input-number v-model="teamForm.groupCount" :min="2" :step="1" :disabled="!canEditTeamConfig" />
      </div>
      <div class="config-item">
        <span class="config-label">团体项目</span>
        <el-select
          v-model="teamForm.eventCodes"
          multiple
          collapse-tags
          collapse-tags-tooltip
          placeholder="请选择项目"
          :disabled="!canEditTeamConfig"
        >
          <el-option v-for="item in teamEventOptions" :key="item.code" :label="item.label" :value="item.code" />
        </el-select>
      </div>
      <div class="config-item">
        <span class="config-label">轮数</span>
        <el-input-number v-model="teamForm.roundCount" :min="1" :step="1" :disabled="!canEditTeamConfig" />
      </div>
      <div class="config-item">
        <span class="config-label">对局分值</span>
        <el-select v-model="teamForm.scoreTarget" :disabled="!canEditTeamConfig">
          <el-option v-for="score in teamScoreTargetOptions" :key="score" :label="`${score} 分制`" :value="score" />
        </el-select>
      </div>
    </div>

    <div class="team-tip">
      每组最少人数：{{ teamMinPlayersPerGroup }}（男 {{ teamGenderRequirementPerGroup.male }} / 女 {{ teamGenderRequirementPerGroup.female }}）
    </div>

  </el-card>
</template>

<script setup>
defineProps({
  canEditTeamConfig: { type: Boolean, default: false },
  teamForm: { type: Object, required: true },
  teamEventOptions: { type: Array, default: () => [] },
  teamScoreTargetOptions: { type: Array, default: () => [] },
  teamMinPlayersPerGroup: { type: Number, default: 0 },
  teamGenderRequirementPerGroup: { type: Object, default: () => ({ male: 0, female: 0 }) },
  savingTeamConfig: { type: Boolean, default: false },
})

defineEmits(['save-config'])
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

.team-tip {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}

</style>
