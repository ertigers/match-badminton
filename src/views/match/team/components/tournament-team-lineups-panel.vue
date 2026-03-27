<template>
  <el-card shadow="never">
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">轮次排位</div>
          <div class="subtitle">仅编辑当前轮次且属于自己分组的排位</div>
        </div>
        <el-button
          v-if="canEditTeamLineups"
          type="primary"
          size="small"
          :loading="savingTeamAssignments"
          @click="$emit('save-assignments')"
        >
          保存轮次排位
        </el-button>
      </div>
    </template>

    <div class="lineup-board">
      <div class="round-block">
        <div class="round-title">当前编辑：第 {{ currentRoundNo }} 轮</div>
        <template v-if="editableGroups.length">
          <div
            v-for="group in editableGroups"
            :key="`round-${currentRoundNo}-group-${group.group_no}`"
            class="lineup-group"
          >
            <div class="lineup-group-title">{{ group.group_name }}</div>
            <div class="lineup-rows">
              <div
                v-for="row in getRowsByRoundGroup(currentRoundNo, group.group_no)"
                :key="`${currentRoundNo}-${group.group_no}-${row.event_code}-${row.slot_code}`"
                class="lineup-row"
              >
                <div class="lineup-label">
                  {{ eventLabelMap[row.event_code] || row.event_code }} ·
                  {{ slotLabelMap[row.slot_code] || row.slot_code }}
                </div>
                <el-radio-group :model-value="row.user_id" :disabled="!canEditTeamLineups" class="lineup-user-grid">
                  <el-radio
                    v-for="item in getLineupMemberOptions(
                      currentRoundNo,
                      group.group_no,
                      row.event_code,
                      row.slot_code,
                      row.user_id
                    )"
                    :key="item.value"
                    :value="item.value"
                    border
                    class="lineup-user-radio"
                    @click.stop.prevent="onToggleSelect(row, item.value)"
                  >
                    <div class="lineup-user-option">
                      <span class="lineup-user-name">{{ item.label }}</span>
                      <el-tag size="small" effect="plain" :class="getGenderClass(item.gender)">
                        {{ getGenderLabel(item.gender) }}
                      </el-tag>
                    </div>
                  </el-radio>
                </el-radio-group>
              </div>
            </div>
          </div>
        </template>
        <el-empty v-else description="你当前没有可编辑的分组排位" />
      </div>
    </div>

  </el-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  canEditTeamLineups: { type: Boolean, default: false },
  teamForm: { type: Object, required: true },
  teamGroups: { type: Array, default: () => [] },
  currentRoundNo: { type: Number, default: 1 },
  editableGroupNos: { type: Array, default: () => [] },
  getRowsByRoundGroup: { type: Function, required: true },
  eventLabelMap: { type: Object, required: true },
  slotLabelMap: { type: Object, required: true },
  getLineupMemberOptions: { type: Function, required: true },
  savingTeamAssignments: { type: Boolean, default: false },
})

const editableGroupNoSet = computed(() => new Set((props.editableGroupNos || []).map((item) => Number(item))))

const editableGroups = computed(() =>
  (props.teamGroups || []).filter((group) => editableGroupNoSet.value.has(Number(group.group_no)))
)
const getGenderLabel = (gender) => (Number(gender) === 1 ? '男' : Number(gender) === 2 ? '女' : '未知')
const getGenderClass = (gender) => {
  if (Number(gender) === 1) return 'lineup-user-gender--male'
  if (Number(gender) === 2) return 'lineup-user-gender--female'
  return 'lineup-user-gender--unknown'
}
const onToggleSelect = (row, value) => {
  if (!props.canEditTeamLineups || !row) return
  const currentValue = String(row.user_id || '')
  const clickedValue = String(value || '')
  row.user_id = currentValue && currentValue === clickedValue ? '' : value
}

defineEmits(['save-assignments'])
</script>

<style scoped>
.title {
  font-size: 15px;
  font-weight: 600;
}

.subtitle {
  color: #909399;
  font-size: 12px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.lineup-board {
  display: grid;
  gap: 12px;
}

.round-block {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  display: grid;
  gap: 10px;
}

.round-title {
  font-size: 14px;
  font-weight: 600;
}

.lineup-group {
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 8px;
  display: grid;
  gap: 8px;
}

.lineup-group-title {
  font-size: 13px;
  color: #606266;
}

.lineup-rows {
  display: grid;
  gap: 6px;
}

.lineup-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.lineup-label {
  font-size: 12px;
  color: #606266;
}

.lineup-user-grid {
  display: grid;
  gap: 8px;
}

.lineup-user-radio {
  margin-right: 0;
}

.lineup-user-radio :deep(.el-radio__label) {
  width: 100%;
}

.lineup-user-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lineup-user-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lineup-user-gender--male {
  color: #3a84e8;
  border-color: #bfdcff;
  background: #eff6ff;
}

.lineup-user-gender--female {
  color: #d84b82;
  border-color: #f7c7d8;
  background: #fff0f6;
}

.lineup-user-gender--unknown {
  color: #7a869a;
  border-color: #d8dde6;
  background: #f5f7fa;
}
</style>
