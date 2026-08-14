<script setup>
import { ArrowRight, UserFilled } from '@element-plus/icons-vue'

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  emptyText: { type: String, default: '暂无比赛' },
  list: { type: Array, default: () => [] },
  modeMap: { type: Object, default: () => ({}) },
})

defineEmits(['select'])

const statusMeta = {
  draft: { label: '筹备中', className: 'status--draft' },
  running: { label: '进行中', className: 'status--running' },
  finished: { label: '已完成', className: 'status--finished' },
}

const getStatusMeta = (status) =>
  statusMeta[String(status || '')] || { label: status || '未知', className: 'status--draft' }
</script>

<template>
  <section class="tournament-list-panel">
    <div class="list-hero">
      <div>
        <span class="hero-kicker">MATCH CENTER</span>
        <h2>{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <div class="hero-count">
        <strong>{{ list.length }}</strong>
        <span>场比赛</span>
      </div>
    </div>

    <div v-if="list.length" class="list-wrap">
      <button
        v-for="item in list"
        :key="item.id"
        type="button"
        class="tournament-card"
        @click="$emit('select', item.id)"
      >
        <div class="card-top">
          <span class="mode-chip">{{ modeMap[item.match_mode] || item.match_mode || '未设置赛制' }}</span>
          <span class="status-chip" :class="getStatusMeta(item.status).className">
            {{ getStatusMeta(item.status).label }}
          </span>
        </div>
        <div class="card-name">{{ item.name || '未命名比赛' }}</div>
        <div class="card-bottom">
          <span class="participant-count">
            <el-icon><UserFilled /></el-icon>
            {{ Number(item.participant_count || 0) }} 人参赛
          </span>
          <span class="detail-link">查看详情 <el-icon><ArrowRight /></el-icon></span>
        </div>
      </button>
    </div>

    <div v-else class="empty-card">
      <el-empty :description="emptyText" />
    </div>
  </section>
</template>

<style scoped>
.tournament-list-panel {
  display: grid;
  gap: 14px;
}

.list-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  overflow: hidden;
  border-radius: 20px;
  color: #fff;
  background:
    radial-gradient(circle at 88% 10%, rgba(255, 255, 255, 0.25), transparent 26%),
    linear-gradient(135deg, #627cf4 0%, #4d63df 58%, #6f56c9 100%);
  box-shadow: 0 16px 32px rgba(72, 91, 190, 0.22);
}

.hero-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  opacity: 0.72;
}

h2 {
  margin: 5px 0 4px;
  font-size: 22px;
  line-height: 1.25;
}

p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.78;
}

.hero-count {
  flex: 0 0 auto;
  min-width: 66px;
  padding: 10px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 15px;
  text-align: center;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
}

.hero-count strong,
.hero-count span {
  display: block;
}

.hero-count strong {
  font-size: 23px;
}

.hero-count span {
  margin-top: 2px;
  font-size: 10px;
  opacity: 0.78;
}

.list-wrap {
  display: grid;
  gap: 10px;
}

.tournament-card {
  width: 100%;
  padding: 15px;
  border: 1px solid rgba(121, 135, 163, 0.14);
  border-radius: 17px;
  color: #1f2937;
  text-align: left;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 9px 24px rgba(46, 64, 104, 0.07);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.tournament-card:active {
  transform: scale(0.985);
  box-shadow: 0 5px 14px rgba(46, 64, 104, 0.08);
}

.card-top,
.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mode-chip,
.status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.mode-chip {
  color: #5168d9;
  background: #eef1ff;
}

.status--draft {
  color: #9a6b18;
  background: #fff6df;
}

.status--running {
  color: #16825b;
  background: #e8f8f1;
}

.status--finished {
  color: #697386;
  background: #eef0f4;
}

.card-name {
  margin: 13px 0 14px;
  overflow: hidden;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.participant-count,
.detail-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.participant-count {
  color: #7b8496;
}

.detail-link {
  color: #4f6df5;
  font-weight: 600;
}

.empty-card {
  border: 1px solid rgba(121, 135, 163, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 10px 26px rgba(46, 64, 104, 0.06);
}
</style>
