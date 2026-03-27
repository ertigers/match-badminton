<template>
  <el-card shadow="never">
    <template #header>
      <div class="header-row">
        <div class="title">参赛人员</div>
        <el-button
          v-if="canManageParticipants"
          size="small"
          type="primary"
          plain
          @click="$emit('toggle-editor')"
        >
          {{ participantEditorVisible ? '关闭修改' : '开启修改' }}
        </el-button>
      </div>
    </template>

    <div v-if="enrichedParticipants.length" class="participants">
      <el-tag
        v-for="item in enrichedParticipants"
        :key="item.id || item.user_id"
        effect="plain"
        :class="{
          'participant-tag--male': Number(item.gender) === 1,
          'participant-tag--female': Number(item.gender) === 2,
        }"
      >
        {{ item.nickname || item.user_id }}
      </el-tag>
    </div>
    <el-empty v-else description="暂无参赛人员" />
  </el-card>

  <el-card v-if="canManageParticipants && participantEditorVisible" shadow="never">
    <template #header>
      <div class="header-row">
        <div class="title">修改参赛人员</div>
        <el-button
          type="primary"
          size="small"
          :loading="savingParticipants"
          @click="$emit('save-participants')"
        >
          保存参赛人员
        </el-button>
      </div>
    </template>
    <div class="editor-grid">
      <div
        v-for="item in users"
        :key="item.user_id || item.id"
        class="editor-item"
        :class="{
          'editor-item--active': selectedParticipantIds.includes(String(item.user_id || item.id)),
          'editor-item--male': Number(item.gender) === 1,
          'editor-item--female': Number(item.gender) === 2,
        }"
        @click="$emit('toggle-participant', item.user_id || item.id)"
      >
        <el-icon
          v-if="selectedParticipantIds.includes(String(item.user_id || item.id))"
          class="selected-icon"
        >
          <Check />
        </el-icon>
        <span class="editor-name">{{ item.nickname || item.user_id || item.id }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { Check } from '@element-plus/icons-vue'

defineProps({
  canManageParticipants: { type: Boolean, default: false },
  participantEditorVisible: { type: Boolean, default: false },
  enrichedParticipants: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  selectedParticipantIds: { type: Array, default: () => [] },
  savingParticipants: { type: Boolean, default: false },
})

defineEmits(['toggle-editor', 'toggle-participant', 'save-participants'])
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

.participants {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.participant-tag--male {
  background: #eff6ff;
  border-color: #bfdcff;
  color: #3a84e8;
}

.participant-tag--female {
  background: #fff0f6;
  border-color: #f7c7d8;
  color: #d84b82;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.editor-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 6px 4px;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
}

.editor-item--active {
  border-color: #67c23a;
  background: #f0f9eb;
}

.editor-item--male {
  background: #eff6ff;
}

.editor-item--female {
  background: #fff0f6;
}

.editor-name {
  font-size: 11px;
  line-height: 1.2;
  word-break: break-all;
}

.selected-icon {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #67c23a;
  color: #fff;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

</style>
