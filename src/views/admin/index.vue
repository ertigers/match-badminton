<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DataLine, Medal, Trophy } from '@element-plus/icons-vue'
import { importDraftUsers, listAllUsers } from '../../api/admin'
import { showErrorMessage } from '../../utils/error'

const loading = ref(false)
const importing = ref(false)
const list = ref([])

const genderMap = {
  0: '未知',
  1: '男',
  2: '女',
}

const formatGender = (value) => {
  const gender = Number(value)
  return genderMap[gender] || genderMap[0]
}

const formatWinRate = (value) => `${Number(value || 0)}%`

const totalCount = computed(() => list.value.length)
const maleCount = computed(() => list.value.filter((item) => Number(item.gender) === 1).length)
const femaleCount = computed(() => list.value.filter((item) => Number(item.gender) === 2).length)

const loadData = async () => {
  try {
    loading.value = true
    list.value = await listAllUsers()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const handleImportUsers = async () => {
  try {
    await ElMessageBox.confirm('将 user-base-draft.json 中的数据批量导入用户表，是否继续？', '导入用户', {
      type: 'warning',
      confirmButtonText: '开始导入',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    importing.value = true
    const { inserted, total, failed = [] } = await importDraftUsers()
    if (failed.length) {
      ElMessage.warning(`导入完成：成功 ${inserted}/${total}，失败 ${failed.length}`)
      console.warn('用户导入失败明细：', failed)
    } else {
      ElMessage.success(`导入成功：${inserted}/${total}`)
    }
    await loadData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <section class="user-page" v-loading="loading">
    <!-- <div class="action-bar">
      <el-button class="action-btn" :loading="importing" type="primary" @click="handleImportUsers">
        导入用户
      </el-button>
      <el-button class="action-btn action-btn--refresh" plain @click="loadData">刷新</el-button>
    </div> -->

    <el-card shadow="never" class="stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <div class="stat-label">总人数</div>
          <div class="stat-value">{{ totalCount }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">男生</div>
          <div class="stat-value stat-value--male">{{ maleCount }}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">女生</div>
          <div class="stat-value stat-value--female">{{ femaleCount }}</div>
        </div>
      </div>
    </el-card>

    <div v-if="!list.length" class="empty-wrap">
      <el-empty description="暂无用户数据" />
    </div>

    <div v-else class="user-list">
      <el-card v-for="item in list" :key="item.id || item.user_id" class="user-card" shadow="hover">
        <div class="user-card__top">
          <div class="name">{{ item.nickname || '未命名用户' }}</div>
          <div class="badge-group">
            <el-tag
              size="small"
              :type="Number(item.gender) === 2 ? 'danger' : Number(item.gender) === 1 ? 'info' : 'warning'"
              :effect="Number(item.gender) === 2 ? 'light' : 'plain'"
              :class="{
                'gender-tag--female': Number(item.gender) === 2,
                'gender-tag--male': Number(item.gender) === 1,
              }"
            >
              {{ formatGender(item.gender) }}
            </el-tag>
            <el-tag size="small" type="success" effect="plain">Lv.{{ item.level || '-' }}</el-tag>
          </div>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">
              <el-icon><Trophy /></el-icon>
              参赛次数
            </span>
            <span class="meta-value">{{ Number(item.tournament_count || 0) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">
              <el-icon><Medal /></el-icon>
              对局次数
            </span>
            <span class="meta-value">{{ Number(item.match_count || 0) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">
              <el-icon><DataLine /></el-icon>
              胜率
            </span>
            <span class="meta-value">{{ formatWinRate(item.win_rate) }}</span>
          </div>
        </div>
      </el-card>
    </div>
  </section>
</template>

<style scoped>
.user-page {
  display: grid;
  gap: 12px;
}

.action-bar {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #ebeef5;
}

.action-btn {
  flex: 1;
  height: 36px;
  border-radius: 10px;
  font-weight: 600;
}

.action-btn--refresh {
  background: #f5f7fa;
  border-color: #dcdfe6;
  color: #606266;
}

.stats-card {
  border-radius: 12px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.stat-item {
  border-radius: 10px;
  padding: 10px;
  background: #f7f8fa;
  text-align: center;
}

.stat-label {
  color: #909399;
  font-size: 12px;
  text-align: center;
}

.stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.stat-value--male {
  color: #5f9cf8;
}

.stat-value--female {
  color: #f56c9a;
}

.empty-wrap {
  margin-top: 24px;
}

.user-list {
  display: grid;
  gap: 10px;
}

.user-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.name {
  font-size: 18px;
  font-weight: 600;
}

.badge-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.meta-item {
  background: #f7f8fa;
  border-radius: 8px;
  padding: 6px;
  min-width: 0;
}

.meta-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.meta-value {
  display: block;
  margin-top: 2px;
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
}

.gender-tag--female {
  background: #fdf0f6;
  border-color: #f8c2d7;
  color: #d84b82;
}

.gender-tag--male {
  background: #ecf5ff;
  border-color: #b3d8ff;
  color: #3a84e8;
}
</style>
