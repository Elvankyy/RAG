<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

import {
  createFaq,
  deleteFaq,
  getRecommendations,
  getSummary,
  listFaqs,
  offlineFaq,
  reviewFaq,
} from '@/api/settlement'
import { listUnits } from '@/api/knowledge'
import type { Faq, SettlementSummary } from '@/types/settlement'
import type { KnowledgeUnit } from '@/types/knowledge'

const activeTab = ref<'recommendations' | 'published'>('recommendations')
const recommendations = ref<Faq[]>([])
const published = ref<Faq[]>([])
const summary = ref<SettlementSummary | null>(null)
const selectedId = ref<number | null>(null)
const editedAnswer = ref('')
const isLoading = ref(false)
const isReviewing = ref(false)
const units = ref<KnowledgeUnit[]>([])

const createVisible = ref(false)
const createFormRef = ref<FormInstance>()
const creating = ref(false)
const createForm = reactive({
  question: '',
  answer: '',
  category: '通用',
  related_unit_id: null as number | null,
})
const createRules: FormRules = {
  question: [{ required: true, message: '请输入问题', trigger: 'blur' }],
  answer: [{ required: true, message: '请输入标准答案', trigger: 'blur' }],
}

const selectedFaq = computed(
  () => recommendations.value.find((faq) => faq.id === selectedId.value) ?? null,
)

const tabs = computed(() => [
  { key: 'recommendations' as const, label: '推荐审核', count: recommendations.value.length },
  { key: 'published' as const, label: '已发布 FAQ', count: published.value.length },
])

watch(selectedFaq, (faq) => {
  editedAnswer.value = faq?.answer ?? ''
})

function formatTime(iso: string | null): string {
  return iso ? dayjs(iso).format('YYYY-MM-DD HH:mm') : '—'
}

function cacheText(faq: Faq): string {
  if (faq.status !== 'published') {
    return '未发布'
  }
  if (faq.cache_status === 'synced') {
    return '缓存生效'
  }
  if (faq.cache_status === 'failed') {
    return '缓存失败'
  }
  return '待同步'
}

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const [recommendationResult, publishedList, summaryData] = await Promise.all([
      getRecommendations(),
      listFaqs('published'),
      getSummary(),
    ])
    recommendations.value = recommendationResult.items
    published.value = publishedList
    summary.value = summaryData
    if (
      !selectedId.value ||
      !recommendations.value.some((faq) => faq.id === selectedId.value)
    ) {
      selectedId.value = recommendations.value[0]?.id ?? null
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识沉淀数据加载失败')
  } finally {
    isLoading.value = false
  }
}

async function loadUnits(): Promise<void> {
  try {
    const result = await listUnits({ page: 1, page_size: 100 })
    units.value = result.items
  } catch {
    units.value = []
  }
}

async function handleReview(action: 'approve' | 'reject'): Promise<void> {
  if (!selectedFaq.value) {
    return
  }
  isReviewing.value = true
  try {
    await reviewFaq(selectedFaq.value.id, {
      action,
      edited_answer: editedAnswer.value,
    })
    ElMessage.success(action === 'approve' ? '已通过并写入缓存' : '已驳回该推荐')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '审核失败')
  } finally {
    isReviewing.value = false
  }
}

async function handleOffline(faq: Faq): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定下线「${faq.question}」？缓存将立即失效。`, '下线 FAQ', {
      type: 'warning',
      confirmButtonText: '下线',
      cancelButtonText: '取消',
    })
    await offlineFaq(faq.id)
    ElMessage.success('FAQ 已下线')
    await load()
  } catch {
    // 取消下线
  }
}

async function handleDelete(faq: Faq): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${faq.question}」？`, '删除 FAQ', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteFaq(faq.id)
    ElMessage.success('FAQ 已删除')
    await load()
  } catch {
    // 取消删除
  }
}

function openCreate(): void {
  createForm.question = ''
  createForm.answer = ''
  createForm.category = '通用'
  createForm.related_unit_id = null
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!createFormRef.value) {
    return
  }
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) {
    return
  }
  creating.value = true
  try {
    await createFaq({
      question: createForm.question.trim(),
      answer: createForm.answer.trim(),
      category: createForm.category,
      related_unit_id: createForm.related_unit_id,
    })
    ElMessage.success('FAQ 已创建并发布')
    createVisible.value = false
    activeTab.value = 'published'
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    creating.value = false
  }
}

function handleRemine(): void {
  void load()
  ElMessage.success('已触发一次 FAQ 挖掘（演示环境返回既有推荐）')
}

onMounted(() => {
  void load()
  void loadUnits()
})
</script>

<template>
  <div class="faq-page" v-loading="isLoading">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">知识沉淀</h1>
        <p class="kb-page-subtitle">
          从历史问答挖掘高频问题；审核通过后写入问答缓存并加速应答
        </p>
      </div>
      <div class="head-actions">
        <el-button :icon="Refresh" @click="handleRemine">重新挖掘</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">手动新建 FAQ</el-button>
      </div>
    </header>

    <div class="summary-row">
      <div class="summary-item kb-card">
        <span>待审核</span>
        <strong>{{ summary?.pending_faqs ?? 0 }}</strong>
      </div>
      <div class="summary-item kb-card">
        <span>已发布</span>
        <strong class="success">{{ summary?.published_faqs ?? 0 }}</strong>
      </div>
      <div class="summary-item kb-card">
        <span>未解决缺口</span>
        <strong class="warning">{{ summary?.unresolved_gaps ?? 0 }}</strong>
      </div>
      <div class="summary-item kb-card">
        <span>FAQ 命中</span>
        <strong>{{ summary?.faq_hits ?? 0 }}</strong>
      </div>
    </div>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="tab"
        :class="{ 'is-active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span class="tab-count" :class="{ active: activeTab === tab.key }">{{ tab.count }}</span>
      </button>
    </div>

    <div v-if="activeTab === 'recommendations'" class="review-body">
      <aside class="rec-list kb-card">
        <h3>待审核推荐 · {{ recommendations.length }}</h3>
        <button
          v-for="faq in recommendations"
          :key="faq.id"
          type="button"
          class="rec-item"
          :class="{ 'is-active': faq.id === selectedId }"
          @click="selectedId = faq.id"
        >
          <span class="rec-question">{{ faq.question }}</span>
          <span class="rec-meta">
            推荐 {{ faq.recommend_count }} 次 · {{ faq.related_unit_title || '未关联单元' }}
          </span>
        </button>
        <p v-if="recommendations.length === 0" class="rec-empty">
          暂无待审核推荐；可点击「重新挖掘」扫描近 30 天问答。
        </p>
        <p class="rec-hint">
          推荐基于近 30 天 answered 问答聚类；频次阈值可配置。
        </p>
      </aside>

      <section v-if="selectedFaq" class="review-panel kb-card">
        <header class="panel-head">
          <h2>{{ selectedFaq.question }}</h2>
          <div class="chips">
            <span class="chip purple">
              {{ selectedFaq.source_type === 'auto_mined' ? '自动挖掘' : '人工创建' }}
            </span>
            <span class="chip primary">推荐 {{ selectedFaq.recommend_count }} 次</span>
            <span class="chip neutral">
              {{ selectedFaq.related_unit_title ? '关联 1 个单元' : '未关联单元' }}
            </span>
          </div>
        </header>

        <label class="field-label">标准答案（可编辑）</label>
        <el-input
          v-model="editedAnswer"
          type="textarea"
          :rows="8"
          placeholder="补充或修改标准答案，发布后写入缓存"
        />
        <p class="field-hint">建议答案来自该簇最新的授权回答；可手工修改。</p>

        <div class="related-row">
          <span class="related-label">
            <strong>关联知识单元</strong>
            <span>影响答案来源</span>
          </span>
          <span class="related-value">{{ selectedFaq.related_unit_title || '未关联' }}</span>
          <span class="related-link">审核时可重新绑定</span>
        </div>

        <div class="acl-row">
          <span class="acl-icon">ACL</span>
          <div class="acl-text">
            <strong>FAQ ACL · 继承关联单元（多单元取交集）</strong>
            <span>命中缓存时仍会校验当前用户权限；无权则跳过缓存走正常检索。</span>
          </div>
          <span class="acl-link">手工配置</span>
        </div>

        <p class="panel-hint">
          通过后：status=published，写入 Redis 精确缓存与 faq_vectors；编辑或下线时自动失效。
        </p>

        <footer class="panel-footer">
          <el-button :loading="isReviewing" @click="handleReview('reject')">驳回</el-button>
          <el-button type="primary" :loading="isReviewing" @click="handleReview('approve')">
            通过并发布
          </el-button>
        </footer>
      </section>

      <el-empty v-else class="review-empty" description="暂无可审核的推荐" />
    </div>

    <section v-else class="published-card kb-card">
      <div class="table-header">
        <span>问题</span>
        <span>分类</span>
        <span>关联知识单元</span>
        <span>命中次数</span>
        <span>缓存状态</span>
        <span>审核时间</span>
        <span>操作</span>
      </div>
      <div v-for="faq in published" :key="faq.id" class="table-row">
        <div class="question-cell">
          <span class="question-text">{{ faq.question }}</span>
          <span class="question-sub">{{ faq.answer.slice(0, 60) }}</span>
        </div>
        <span class="muted">{{ faq.category }}</span>
        <span class="muted">{{ faq.related_unit_title || '—' }}</span>
        <span class="num">{{ faq.hit_count }}</span>
        <span class="cache" :class="faq.cache_status">{{ cacheText(faq) }}</span>
        <span class="muted num">{{ formatTime(faq.reviewed_at) }}</span>
        <div class="row-actions">
          <el-button link type="warning" @click="handleOffline(faq)">下线</el-button>
          <el-button link type="danger" @click="handleDelete(faq)">删除</el-button>
        </div>
      </div>
      <div v-if="published.length === 0" class="empty">暂无已发布 FAQ</div>
    </section>

    <p class="api-hint">
      GET /api/settlement/faqs/recommendations · POST /api/settlement/faqs/{id}/review · POST /api/settlement/faqs/{id}/offline
    </p>

    <el-dialog v-model="createVisible" title="手动新建 FAQ" width="560px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="问题" prop="question">
          <el-input v-model="createForm.question" maxlength="200" show-word-limit placeholder="用户常见问题" />
        </el-form-item>
        <el-form-item label="标准答案" prop="answer">
          <el-input v-model="createForm.answer" type="textarea" :rows="6" placeholder="发布后写入缓存" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="createForm.category" placeholder="例如：财务制度" />
        </el-form-item>
        <el-form-item label="关联知识单元">
          <el-select v-model="createForm.related_unit_id" class="full" clearable filterable placeholder="选择知识单元">
            <el-option
              v-for="unit in units"
              :key="unit.id"
              :label="unit.title"
              :value="unit.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建并发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.faq-page {
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

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.summary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
}

.summary-item span {
  color: var(--kb-text-3);
  font-size: 10px;
}

.summary-item strong {
  color: var(--kb-text);
  font-family: var(--kb-font-num);
  font-size: 18px;
  font-weight: 600;
}

.summary-item strong.success {
  color: var(--kb-success);
}

.summary-item strong.warning {
  color: var(--kb-warning);
}

.tabs {
  display: flex;
  gap: 24px;
  padding: 0 4px;
  border-bottom: 1px solid var(--kb-border);
}

.tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 9px 0 10px;
  border: 0;
  background: transparent;
  color: var(--kb-text-2);
  font-size: 12px;
  cursor: pointer;
}

.tab.is-active {
  color: var(--kb-primary);
  font-weight: 600;
}

.tab.is-active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 1px;
  background: var(--kb-primary);
  content: '';
}

.tab-count {
  padding: 1px 5px;
  border-radius: 8px;
  background: #f2f4f7;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 8.5px;
}

.tab-count.active {
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.review-body {
  display: flex;
  gap: 14px;
  min-height: calc(100vh - 62px - 56px - 220px);
}

.rec-list {
  display: flex;
  width: 370px;
  flex: 0 0 370px;
  flex-direction: column;
  gap: 7px;
  padding: 12px;
}

.rec-list h3 {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
}

.rec-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 11px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.rec-item:hover {
  background: #f9fafb;
}

.rec-item.is-active {
  border-color: transparent;
  background: var(--kb-primary-soft);
}

.rec-question {
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
}

.rec-item.is-active .rec-question {
  color: var(--kb-primary);
  font-weight: 600;
}

.rec-meta {
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.rec-empty {
  margin: 10px 0;
  color: var(--kb-text-3);
  font-size: 10.5px;
  text-align: center;
}

.rec-hint {
  margin: auto 0 0;
  padding: 4px;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.review-panel {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
}

.panel-head h2 {
  margin: 0 0 5px;
  font-size: 15px;
  font-weight: 600;
}

.chips {
  display: flex;
  gap: 6px;
}

.chip {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9px;
}

.chip.purple {
  background: var(--kb-purple-soft);
  color: var(--kb-purple);
}

.chip.primary {
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.chip.neutral {
  background: #f2f4f7;
  color: var(--kb-text-3);
}

.field-label {
  color: var(--kb-text-2);
  font-size: 11.5px;
  font-weight: 500;
}

.field-hint,
.panel-hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.related-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
}

.related-label {
  display: flex;
  width: 100px;
  flex: 0 0 100px;
  flex-direction: column;
  gap: 1px;
}

.related-label strong {
  font-size: 10.5px;
  font-weight: 500;
}

.related-label span {
  color: var(--kb-text-3);
  font-size: 9px;
}

.related-value {
  flex: 1;
  color: var(--kb-text);
  font-size: 11px;
}

.related-link,
.acl-link {
  color: var(--kb-primary);
  font-size: 10px;
}

.acl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--kb-primary-soft);
}

.acl-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 22px;
  flex: 0 0 28px;
  border-radius: 5px;
  background: var(--kb-primary);
  color: #fff;
  font-family: var(--kb-font-num);
  font-size: 8.5px;
  font-weight: 600;
}

.acl-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.acl-text strong {
  color: var(--kb-primary);
  font-size: 10.5px;
  font-weight: 500;
}

.acl-text span {
  color: #1e40af;
  font-size: 9px;
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}

.review-empty {
  flex: 1;
  background: var(--kb-surface);
  border: 1px solid var(--kb-border);
  border-radius: var(--kb-radius-lg);
}

.published-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 100px 170px 70px 90px 110px 100px;
  gap: 8px;
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

.muted {
  color: var(--kb-text-2);
  font-size: 10.5px;
}

.num {
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.cache {
  width: 74px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  text-align: center;
}

.cache.synced {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.cache.pending {
  background: var(--kb-warning-soft);
  color: #b54708;
}

.cache.failed {
  background: var(--kb-danger-soft);
  color: var(--kb-danger);
}

.row-actions {
  display: flex;
  gap: 6px;
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

.full {
  width: 100%;
}
</style>
