<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import dayjs from 'dayjs'

import {
  getMetrics,
  getQuestionRanking,
  getTokenStats,
  getUnitRanking,
} from '@/api/dashboard'
import type {
  DashboardMetrics,
  QuestionRankItem,
  TokenStatsResponse,
  UnitRankItem,
} from '@/types/dashboard'

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const metrics = ref<DashboardMetrics | null>(null)
const questions = ref<QuestionRankItem[]>([])
const units = ref<UnitRankItem[]>([])
const stats = ref<TokenStatsResponse | null>(null)
const days = ref(14)
const isLoading = ref(false)

const visitsEl = ref<HTMLElement>()
const tokenEl = ref<HTMLElement>()
let visitsChart: ReturnType<typeof echarts.init> | null = null
let tokenChart: ReturnType<typeof echarts.init> | null = null

const metricCards = computed(() => {
  const data = metrics.value
  if (!data) {
    return []
  }
  return [
    {
      label: '访问次数',
      value: data.visits.toLocaleString('zh-CN'),
      delta: `${data.visits_growth >= 0 ? '+' : ''}${data.visits_growth}% 较上周`,
      tone: 'primary',
    },
    {
      label: '独立用户',
      value: data.uv.toLocaleString('zh-CN'),
      delta: `今日 ${data.today_uv} 人`,
      tone: 'purple',
    },
    {
      label: '知识单元',
      value: `${data.unit_count}`,
      delta: '启用中 · 参与召回',
      tone: 'success',
    },
    {
      label: '总 Token',
      value: formatTokens(data.total_tokens),
      delta: `${data.tokens_growth >= 0 ? '+' : ''}${data.tokens_growth}% 较上周`,
      tone: 'warning',
    },
    {
      label: '平均响应',
      value: `${(data.avg_response_ms / 1000).toFixed(2)}s`,
      delta: `今日 ${data.today_visits} 次访问`,
      tone: 'default',
    },
  ]
})

const distributionMax = computed(() =>
  Math.max(1, ...(stats.value?.response_distribution.map((item) => item.count) ?? [1])),
)
const questionMax = computed(() => Math.max(1, ...questions.value.map((item) => item.count)))
const peakTokens = computed(() =>
  Math.max(0, ...(stats.value?.items.map((item) => item.tokens) ?? [0])),
)
const unitMax = computed(() => Math.max(1, ...units.value.map((item) => item.count)))

function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`
  }
  return `${value}`
}

function formatDate(date: string): string {
  return dayjs(date).format('MM-DD')
}

function renderCharts(): void {
  const items = stats.value?.items ?? []
  const dates = items.map((item) => formatDate(item.date))

  if (visitsEl.value) {
    visitsChart ??= echarts.init(visitsEl.value)
    visitsChart.setOption({
      grid: { left: 6, right: 10, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#E4E8F0' } },
        axisTick: { show: false },
        axisLabel: { color: '#98A2B3', fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#EEF2F7' } },
        axisLabel: { color: '#98A2B3', fontSize: 9 },
      },
      series: [
        {
          type: 'bar',
          data: items.map((item) => item.visits),
          barWidth: 14,
          itemStyle: { color: '#2563EB', borderRadius: [3, 3, 0, 0] },
        },
      ],
    })
  }

  if (tokenEl.value) {
    tokenChart ??= echarts.init(tokenEl.value)
    tokenChart.setOption({
      grid: { left: 6, right: 10, top: 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#E4E8F0' } },
        axisTick: { show: false },
        axisLabel: { color: '#98A2B3', fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#EEF2F7' } },
        axisLabel: {
          color: '#98A2B3',
          fontSize: 9,
          formatter: (value: number) => `${Math.round(value / 1000)}k`,
        },
      },
      series: [
        {
          type: 'line',
          data: items.map((item) => item.tokens),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#7C5CFC', width: 2 },
          areaStyle: { color: 'rgba(124, 92, 252, 0.10)' },
        },
      ],
    })
  }
}

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const [metricData, questionData, unitData, tokenData] = await Promise.all([
      getMetrics(),
      getQuestionRanking(5),
      getUnitRanking(5),
      getTokenStats(days.value),
    ])
    metrics.value = metricData
    questions.value = questionData
    units.value = unitData
    stats.value = tokenData
    await nextTick()
    renderCharts()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '看板数据加载失败')
  } finally {
    isLoading.value = false
  }
}

function handleResize(): void {
  visitsChart?.resize()
  tokenChart?.resize()
}

onMounted(() => {
  void load()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  visitsChart?.dispose()
  tokenChart?.dispose()
  visitsChart = null
  tokenChart = null
})
</script>

<template>
  <div class="dashboard-page" v-loading="isLoading">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">数据看板</h1>
        <p class="kb-page-subtitle">近 {{ days }} 天 · 数据来自 qa_access_logs 与每日聚合</p>
      </div>
      <div class="head-actions">
        <el-select v-model="days" class="days-select" @change="load">
          <el-option label="近 7 天" :value="7" />
          <el-option label="近 14 天" :value="14" />
          <el-option label="近 30 天" :value="30" />
        </el-select>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </header>

    <div class="metrics">
      <div
        v-for="card in metricCards"
        :key="card.label"
        class="metric-card kb-card"
        :class="card.tone"
      >
        <span class="metric-label">{{ card.label }}</span>
        <strong class="metric-value">{{ card.value }}</strong>
        <span class="metric-delta">{{ card.delta }}</span>
      </div>
    </div>

    <div class="charts-row">
      <section class="chart-card kb-card">
        <header class="card-head">
          <h3>按日访问趋势</h3>
          <span class="legend"><i />访问次数</span>
        </header>
        <div ref="visitsEl" class="chart" />
      </section>

      <section class="distribution-card kb-card">
        <header class="card-head">
          <h3>响应时间分布</h3>
          <span class="card-sub">P95 2.4s · 平均 {{ metrics ? (metrics.avg_response_ms / 1000).toFixed(2) : '—' }}s</span>
        </header>
        <div class="distribution">
          <div
            v-for="bucket in stats?.response_distribution ?? []"
            :key="bucket.label"
            class="dist-row"
          >
            <div class="dist-label">
              <span>{{ bucket.label }}</span>
              <span class="dist-count">{{ bucket.count }} 次</span>
            </div>
            <div class="track">
              <span
                class="fill"
                :style="{ width: `${Math.round((bucket.count / distributionMax) * 100)}%` }"
                :class="{
                  success: bucket.label === '< 0.5s',
                  primary: bucket.label === '0.5–1s',
                  purple: bucket.label === '1–2s',
                  warning: bucket.label === '2–5s',
                  danger: bucket.label === '> 5s',
                }"
              />
            </div>
          </div>
        </div>
        <p class="card-foot">FAQ 命中平均 86ms，未计入模型生成耗时。</p>
      </section>
    </div>

    <section class="chart-card token-card kb-card">
      <header class="card-head">
        <h3>Token 消耗趋势</h3>
        <span class="card-sub">峰值 {{ formatTokens(peakTokens) }}</span>
      </header>
      <div ref="tokenEl" class="chart token-chart" />
    </section>

    <div class="rankings">
      <section class="ranking-card kb-card">
        <header class="card-head">
          <h3>常见问题 TOP 5</h3>
          <span class="card-sub">按提问聚类</span>
        </header>
        <div class="ranking-list">
          <div v-for="(item, index) in questions" :key="item.question" class="ranking-row">
            <span class="rank" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <span class="rank-text">{{ item.question }}</span>
            <span class="rank-bar">
              <span :style="{ width: `${Math.round((item.count / questionMax) * 100)}%` }" />
            </span>
            <span class="rank-count">{{ item.count }} 次</span>
          </div>
        </div>
      </section>

      <section class="ranking-card kb-card">
        <header class="card-head">
          <h3>知识单元热度 TOP 5</h3>
          <span class="card-sub">按授权引用统计</span>
        </header>
        <div class="ranking-list">
          <div v-for="(item, index) in units" :key="item.unit_id" class="ranking-row">
            <span class="rank purple" :class="{ top: index < 3 }">{{ index + 1 }}</span>
            <span class="rank-text">
              {{ item.title }}
              <em>{{ item.unit_code }}</em>
            </span>
            <span class="rank-bar purple">
              <span :style="{ width: `${Math.round((item.count / unitMax) * 100)}%` }" />
            </span>
            <span class="rank-count">{{ item.count }} 次</span>
          </div>
        </div>
      </section>
    </div>

    <p class="api-hint">
      GET /api/dashboard/metrics · /rankings/questions · /rankings/units · /stats/tokens?days={{ days }}
    </p>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.days-select {
  width: 120px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px;
}

.metric-label {
  color: var(--kb-text-3);
  font-size: 10px;
}

.metric-value {
  color: var(--kb-text);
  font-family: var(--kb-font-num);
  font-size: 23px;
  font-weight: 600;
}

.metric-card.primary .metric-value {
  color: var(--kb-primary);
}

.metric-card.purple .metric-value {
  color: var(--kb-purple);
}

.metric-card.success .metric-value {
  color: var(--kb-success);
}

.metric-card.warning .metric-value {
  color: var(--kb-warning);
}

.metric-delta {
  color: var(--kb-text-3);
  font-size: 9px;
}

.charts-row {
  display: flex;
  gap: 12px;
}

.chart-card {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-head h3 {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
}

.card-sub,
.legend {
  margin-left: auto;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--kb-primary);
}

.chart {
  width: 100%;
  height: 210px;
}

.token-chart {
  height: 180px;
}

.distribution-card {
  display: flex;
  width: 300px;
  flex: 0 0 300px;
  flex-direction: column;
  gap: 9px;
  padding: 16px;
}

.distribution {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dist-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dist-label {
  display: flex;
  justify-content: space-between;
  color: var(--kb-text-2);
  font-size: 9.5px;
}

.dist-count {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.track {
  height: 5px;
  overflow: hidden;
  border-radius: 3px;
  background: #eef2f7;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
}

.fill.success {
  background: var(--kb-success);
}

.fill.primary {
  background: var(--kb-primary);
}

.fill.purple {
  background: var(--kb-purple);
}

.fill.warning {
  background: var(--kb-warning);
}

.fill.danger {
  background: var(--kb-danger);
}

.card-foot {
  margin: auto 0 0;
  color: var(--kb-text-3);
  font-size: 9px;
}

.token-card {
  flex: none;
}

.rankings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ranking-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.ranking-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.rank {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 5px;
  background: #f2f4f7;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
  font-weight: 600;
}

.rank.top {
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.rank.purple.top {
  background: var(--kb-purple-soft);
  color: var(--kb-purple);
}

.rank-text {
  display: flex;
  overflow: hidden;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  color: var(--kb-text-2);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-text em {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 8.5px;
  font-style: normal;
}

.rank-bar {
  display: flex;
  width: 90px;
  height: 5px;
  flex: 0 0 90px;
  overflow: hidden;
  border-radius: 3px;
  background: #eef2f7;
}

.rank-bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--kb-primary);
}

.rank-bar.purple span {
  background: var(--kb-purple);
}

.rank-count {
  width: 40px;
  flex: 0 0 40px;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
  text-align: right;
}

.api-hint {
  margin: 0;
  color: #b8c2d3;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}
</style>
