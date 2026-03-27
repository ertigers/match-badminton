<template>
  <el-card shadow="never">
    <template #header>
      <div class="header-row">
        <div>
          <div class="title">分组成员</div>
          <div class="subtitle">仅管理员或赛事创建者可编辑</div>
        </div>
        <el-button
          v-if="canManageTeamGroups"
          type="primary"
          size="small"
          :loading="savingTeamGroups"
          @click="$emit('save-groups')"
        >
          保存分组
        </el-button>
      </div>
    </template>

    <div class="team-groups">
      <div v-for="group in teamGroups" :key="group.group_no" class="group-card">
        <div class="group-title-row">
          <span class="group-index">第 {{ group.group_no }} 组</span>
        </div>

        <div class="selected-block">
          <div class="selected-title">已选成员（{{ (group.member_user_ids || []).length }}）</div>
          <div v-if="(group.member_user_ids || []).length" class="selected-tags">
            <el-tag
              v-for="userId in group.member_user_ids"
              :key="`${group.group_no}-${userId}`"
              size="small"
              effect="plain"
              :class="getGenderClass(getOptionByUserId(group.group_no, userId)?.gender)"
            >
              {{ getOptionByUserId(group.group_no, userId)?.label || userId }}
              （{{ getGenderLabel(getOptionByUserId(group.group_no, userId)?.gender) }}）
            </el-tag>
          </div>
          <div v-else class="empty-tip">暂未选择成员</div>
        </div>

        <el-checkbox-group
          v-model="group.member_user_ids"
          class="member-grid"
          :disabled="!canManageTeamGroups"
          @change="$emit('group-members-change', group.group_no)"
        >
          <el-checkbox
            v-for="item in getAssignableParticipantOptions(group.group_no)"
            :key="item.value"
            :value="item.value"
            :disabled="item.disabled"
            border
            class="member-check"
          >
            <div class="member-option">
              <span class="member-option__name">{{ item.label }}</span>
              <el-tag size="small" effect="plain" :class="getGenderClass(item.gender)">
                {{ getGenderLabel(item.gender) }}
              </el-tag>
            </div>
          </el-checkbox>
        </el-checkbox-group>

        <div class="group-count">当前人数：{{ (group.member_user_ids || []).length }}</div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
const props = defineProps({
  teamGroups: { type: Array, default: () => [] },
  canManageTeamGroups: { type: Boolean, default: false },
  getAssignableParticipantOptions: { type: Function, required: true },
  getGenderLabel: { type: Function, required: true },
  savingTeamGroups: { type: Boolean, default: false },
})

const getOptionByUserId = (groupNo, userId) =>
  (props.getAssignableParticipantOptions(groupNo) || []).find(
    (item) => String(item.value) === String(userId)
  )

const getGenderClass = (gender) => {
  if (Number(gender) === 1) return 'member-option__gender--male'
  if (Number(gender) === 2) return 'member-option__gender--female'
  return 'member-option__gender--unknown'
}

defineEmits(['group-members-change', 'save-groups'])
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

.team-groups {
  display: grid;
  gap: 10px;
}

.group-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.group-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-index {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.selected-block {
  display: grid;
  gap: 6px;
}

.selected-title {
  font-size: 12px;
  color: #606266;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-tip {
  font-size: 12px;
  color: #909399;
}

.member-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.member-check {
  margin-right: 0;
}

.member-check :deep(.el-checkbox__label) {
  width: 100%;
}

.member-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.member-option__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  font-size: 12px;
  color: #909399;
}

.member-option__gender--male {
  color: #3a84e8;
  border-color: #bfdcff;
  background: #eff6ff;
}

.member-option__gender--female {
  color: #d84b82;
  border-color: #f7c7d8;
  background: #fff0f6;
}

.member-option__gender--unknown {
  color: #7a869a;
  border-color: #d8dde6;
  background: #f5f7fa;
}
</style>
