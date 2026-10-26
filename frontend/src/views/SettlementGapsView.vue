<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Download, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

import {
  createUnitFromGap,
  ignoreGap,
  listGaps,
  resolveGap,
} from '@/api/settlement'
import type { KnowledgeGap } from '@/types/settlement'

const gaps = ref<KnowledgeGap[]>([])
const isLoading = ref(false)

const createVisible = ref(false)
const currentGap = ref<KnowledgeGap | null>(null)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({
  title: '',
  category: '',
  content: '',
})
const rules: FormRules = {
  title: [{ required: true, message: '请输入知识单元标题', trigger: 'blur' }],
}

const stats = computed(() => {
  const unresolved = gaps.value.filter((gap) => gap.status === 'unresolved')
  const resolved = gaps.value.filter((gap) => gap.status === 'resolved').length
  const avg =
    unresolved.length > 0
      ? unresolved.reduce((sum, gap) => sum + gap.ask_count, 0) / unresolved.length
      : 0
  return {
    unresolved: unresolved.length,
    newThisWeek: unresolved.filter((gap) => gap.ask_count >= 4).length,
    resolved,
    avgAsk: Math.round(avg * 10) / 10,
  }
})

function formatTime(iso: string): string {
  return dayjs(iso).format('MM-DD HH:mm')
}

function statusText(gap: KnowledgeGap): string {
  if (gap.status === 'resolved') {
    return '已解决'
  }
  if (gap.status === 'ignored') {
    return '已忽略'
  }
  return '待处理'
}

async function load(): Promise<void> {
  isLoading.value = true
  try {
    gaps.value = await listGaps('all')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识缺口加载失败')
  } finally {
    isLoading.value = false
  }
}

async function handleResolve(gap: KnowledgeGap): Promise<void> {
  try {
    await resolveGap(gap.id, gap.resolved_unit_id)
    ElMessage.success('已标记为已解决')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}

async function handleIgnore(gap: KnowledgeGap): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定忽略「${gap.question_pattern}」？`, '忽略知识缺口', {
      type: 'warning',
      confirmButtonText: '忽略',
      cancelButtonText: '取消',
    })
    await ignoreGap(gap.id)
    ElMessage.success('已忽略该知识缺口')
    await load()
  } catch {
    // 取消忽略
  }
}

function showSamples(gap: KnowledgeGap): void {
  if (gap.sample_questions.length === 0) {
    ElMessage.info('暂无样例问题')
    return
  }
  void ElMessageBox.alert(gap.sample_questions.map((item) => `· ${item}`).join('\n'), '样例问题', {
    confirmButtonText: '关闭',
  })
}

function openCreate(gap: KnowledgeGap): void {
  currentGap.value = gap
  form.title = gap.question_pattern
  form.category = ''
  form.content = ''
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!formRef.value || !currentGap.value) {
    return
  }
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) {
    return
  }
  submitting.value = true
  try {
    const result = await createUnitFromGap(currentGap.value.id, {
      title: form.title.trim(),
      category: form.category,
      content: form.content,
    })
    ElMessage.success(`已创建知识单元 ${result.unit_code}，请继续完善并配置权限`)
    createVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    submitting.value = false
  }
}

function handleRecluster(): void {
  void load()
  ElMessage.success('已触发缺口重新聚类（演示环境返回既有数据）')
}

function handleExport(): void {
  ElMessage.info('导出清单将在后续模块接入异步导出与预签名下载')
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="gaps-page" v-loading="isLoading">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">知识缺口</h1>
        <p class="kb-page-subtitle">
          AI 未命中或低置信度的问题，按语义聚类统计频次；权限不足不计入缺口
        </p>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" @click="handleRecluster">重新聚类</el-button>
        <el-button :icon="Download" @click="handleExport">导出清单</el-button>
      </div>
    </header>

    <div class="stats">
      <div class="stat kb-card">
        <span>待处理</span>
        <strong class="warning">{{ stats.unresolved }}</strong>
        <em>需要补充知识</em>
      </div>
      <div class="stat kb-card">
        <span>高频缺口</span>
        <strong class="danger">{{ stats.newThisWeek }}</strong>
        <em>提问频次 ≥ 4</em>
      </div>
      <div class="stat kb-card">
        <span>已解决</span>
        <strong class="success">{{ stats.resolved }}</strong>
        <em>关联单元已发布</em>
      </div>
      <div class="stat kb-card">
        <span>平均提问频次</span>
        <strong>{{ stats.avgAsk }}</strong>
        <em>每缺口次数</em>
      </div>
    </div>

    <div class="filter-bar">
      <span class="filter-hint">按提问频次排序 · 展示全部状态</span>
      <span class="filter-spacer" />
      <span class="count-hint">共 {{ gaps.length }} 条</span>
    </div>

    <section class="table-card kb-card">
      <div class="table-header">
        <span>问题模式</span>
        <span>提问频次</span>
        <span>最近提问</span>
        <span>样例问题</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <div v-for="gap in gaps" :key="gap.id" class="table-row">
        <div class="question-cell">
          <span class="question-text">{{ gap.question_pattern }}</span>
          <span class="question-sub">
            {{ gap.sample_questions[0] || '无样例' }}
          </span>
        </div>
        <span class="frequency" :class="{ high: gap.ask_count >= 4 }">
          {{ gap.ask_count }} 次
        </span>
        <span class="num">{{ formatTime(gap.last_asked_at) }}</span>
        <button type="button" class="sample-link" @click="showSamples(gap)">
          {{ gap.sample_questions.length }} 条样例 · 查看
        </button>
        <span class="status" :class="gap.status">{{ statusText(gap) }}</span>
        <div class="row-actions">
          <el-button link type="primary" @click="openCreate(gap)">创建知识单元</el-button>
          <template v-if="gap.status === 'unresolved'">
            <el-button link type="success" @click="handleResolve(gap)">标记解决</el-button>
            <el-button link @click="handleIgnore(gap)">忽略</el-button>
          </template>
          <span v-else class="resolved-hint">
            {{ gap.resolved_unit_title || '—' }}
          </span>
        </div>
      </div>
      <div v-if="gaps.length === 0" class="empty">暂无知识缺口</div>
    </section>

    <p class="api-hint">
      GET /api/settlement/knowledge-gaps · POST /api/settlement/knowledge-gaps/{id}/create-unit|resolve|ignore
    </p>

    <el-dialog v-model="createVisible" title="由知识缺口创建知识单元" width="560px">
      <p class="dialog-hint">
        将预填标题与样例问题；创建后单元默认无数据权限，需要到详情页配置后 AI 才能召回。
      </p>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" maxlength="120" show-word-limit />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="例如：行政管理" />
        </el-form-item>
        <el-form-item label="正文（Markdown）">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="7"
            placeholder="留空将生成包含样例问题的模板正文"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">创建并标记解决</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.gaps-page {
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

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
}

.stat span {
  color: var(--kb-text-3);
  font-size: 10px;
}

.stat strong {
  color: var(--kb-text);
  font-family: var(--kb-font-num);
  font-size: 21px;
  font-weight: 600;
}

.stat strong.warning {
  color: var(--kb-warning);
}

.stat strong.danger {
  color: var(--kb-danger);
}

.stat strong.success {
  color: var(--kb-success);
}

.stat em {
  color: var(--kb-text-3);
  font-size: 9px;
  font-style: normal;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-hint,
.count-hint {
  color: var(--kb-text-3);
  font-size: 10.5px;
}

.filter-spacer {
  flex: 1;
}

.table-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 84px 100px 150px 76px 250px;
  gap: 10px;
  align-items: center;
  padding: 0 16px;
}

.table-header {
  height: 40px;
  background: #f9fafb;
  border-bottom: 1px solid var(--kb-border);
  color: var(--kb-text-3);
  font-size: 10.5px;
  font-weight: 500;
}

.table-row {
  min-height: 54px;
  border-bottom: 1px solid var(--kb-border);
}

.question-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.question-text {
  overflow: hidden;
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-sub {
  overflow: hidden;
  color: var(--kb-text-3);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.frequency {
  width: 62px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--kb-warning-soft);
  color: #b54708;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
  text-align: center;
}

.frequency.high {
  background: var(--kb-danger-soft);
  color: var(--kb-danger);
}

.num {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.sample-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kb-text-2);
  font-size: 10px;
  cursor: pointer;
  text-align: left;
}

.sample-link:hover {
  color: var(--kb-primary);
}

.status {
  width: 64px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9.5px;
  text-align: center;
}

.status.unresolved {
  background: var(--kb-warning-soft);
  color: #b54708;
}

.status.resolved {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.status.ignored {
  background: #f2f4f7;
  color: var(--kb-text-3);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.resolved-hint {
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.empty {
  padding: 36px;
  color: var(--kb-text-3);
  font-size: 11px;
  text-align: center;
}

.api-hint {
  margin: 0;
  color: #b8c2d3;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.dialog-hint {
  margin: 0 0 12px;
  color: var(--kb-text-2);
  font-size: 11px;
  line-height: 1.65;
}
</style>
