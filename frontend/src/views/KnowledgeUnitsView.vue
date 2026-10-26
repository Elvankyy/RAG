<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Search, Upload } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

import PermissionChips from '@/components/knowledge/PermissionChips.vue'
import {
  createUnit,
  deleteUnits,
  listCategories,
  listUnits,
} from '@/api/knowledge'
import type { CategoryItem, KnowledgeUnit } from '@/types/knowledge'

const router = useRouter()

const filters = reactive({
  keyword: '',
  category: '',
  status: '',
})
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const units = ref<KnowledgeUnit[]>([])
const categories = ref<CategoryItem[]>([])
const isLoading = ref(false)
const selectedIds = ref<number[]>([])

const createVisible = ref(false)
const createFormRef = ref<FormInstance>()
const creating = ref(false)
const createForm = reactive({
  title: '',
  category: '',
  content: '',
  tags: '',
})
const createRules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入正文', trigger: 'blur' }],
}

const allSelected = computed(
  () => units.value.length > 0 && selectedIds.value.length === units.value.length,
)

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const result = await listUnits({
      keyword: filters.keyword || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
      page: page.value,
      page_size: pageSize.value,
    })
    units.value = result.items
    total.value = result.total
    selectedIds.value = []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识单元加载失败')
  } finally {
    isLoading.value = false
  }
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await listCategories()
  } catch {
    categories.value = []
  }
}

function handleQuery(): void {
  page.value = 1
  void load()
}

function handleReset(): void {
  filters.keyword = ''
  filters.category = ''
  filters.status = ''
  page.value = 1
  void load()
}

function handlePageChange(next: number): void {
  page.value = next
  void load()
}

function toggleSelect(id: number): void {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) {
    selectedIds.value.splice(index, 1)
    return
  }
  selectedIds.value.push(id)
}

function toggleAll(): void {
  selectedIds.value = allSelected.value ? [] : units.value.map((unit) => unit.id)
}

async function handleDelete(ids: number[]): Promise<void> {
  if (ids.length === 0) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 个知识单元？删除后 AI 将不再召回。`,
      '删除知识单元',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    const deleted = await deleteUnits(ids)
    ElMessage.success(`已删除 ${deleted} 个知识单元`)
    await load()
    await loadCategories()
  } catch {
    // 取消删除
  }
}

function openCreate(): void {
  createForm.title = ''
  createForm.category = categories.value[0]?.name ?? ''
  createForm.content = ''
  createForm.tags = ''
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
    const unit = await createUnit({
      title: createForm.title.trim(),
      content: createForm.content,
      category: createForm.category || '未分类',
      tags: createForm.tags,
    })
    ElMessage.success(`已创建 ${unit.unit_code}`)
    createVisible.value = false
    await load()
    await loadCategories()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    creating.value = false
  }
}

function openDetail(id: number): void {
  void router.push(`/knowledge/units/${id}`)
}

function formatSize(size: number): string {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function formatTime(iso: string): string {
  return dayjs(iso).format('MM-DD HH:mm')
}

onMounted(() => {
  void load()
  void loadCategories()
})
</script>

<template>
  <div class="units-page">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">知识单元</h1>
        <p class="kb-page-subtitle">
          共 {{ total }} 个知识单元 · 默认无权限，配置数据权限后 AI 才能召回
        </p>
      </div>
      <div class="head-actions">
        <el-button :icon="Upload" @click="router.push('/knowledge/import')">导入</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建知识单元</el-button>
      </div>
    </header>

    <div class="filter-bar">
      <el-input
        v-model="filters.keyword"
        class="search"
        placeholder="搜索标题或正文"
        :prefix-icon="Search"
        clearable
        @keyup.enter="handleQuery"
      />
      <el-select v-model="filters.category" class="select" placeholder="全部分类" clearable>
        <el-option
          v-for="category in categories"
          :key="category.name"
          :label="`${category.name} (${category.count})`"
          :value="category.name"
        />
      </el-select>
      <el-select v-model="filters.status" class="select" placeholder="全部状态" clearable>
        <el-option label="启用" value="active" />
        <el-option label="停用" value="disabled" />
      </el-select>
      <el-button type="primary" @click="handleQuery">查询</el-button>
      <el-button text @click="handleReset">重置</el-button>
      <span class="filter-spacer" />
      <span v-if="selectedIds.length > 0" class="selected-hint">
        已选 {{ selectedIds.length }} 项
        <el-button link type="danger" @click="handleDelete(selectedIds)">批量删除</el-button>
      </span>
    </div>

    <section class="table-card kb-card" v-loading="isLoading">
      <div class="table-header">
        <input
          type="checkbox"
          class="checkbox"
          :checked="allSelected"
          aria-label="全选"
          @change="toggleAll"
        />
        <span>单元编号</span>
        <span>标题</span>
        <span>分类</span>
        <span>格式</span>
        <span>数据权限</span>
        <span>创建人</span>
        <span>更新时间</span>
        <span>状态</span>
        <span>操作</span>
      </div>

      <div v-if="!isLoading && units.length === 0" class="empty">没有匹配的知识单元</div>

      <div v-for="unit in units" :key="unit.id" class="table-row">
        <input
          type="checkbox"
          class="checkbox"
          :checked="selectedIds.includes(unit.id)"
          :aria-label="`选择 ${unit.title}`"
          @change="toggleSelect(unit.id)"
        />
        <span class="code">{{ unit.unit_code }}</span>
        <button type="button" class="title-cell" @click="openDetail(unit.id)">
          <span class="unit-title">{{ unit.title }}</span>
          <span class="unit-sub">v{{ unit.version }} · {{ unit.chunk_count }} 个切片 · {{ formatSize(unit.file_size) }}</span>
        </button>
        <span class="muted">{{ unit.category }}</span>
        <span class="type">{{ unit.file_type.toUpperCase() }}</span>
        <PermissionChips :permissions="unit.permissions" />
        <span class="muted">{{ unit.creator_name }}</span>
        <span class="muted num">{{ formatTime(unit.updated_at) }}</span>
        <span class="status" :class="unit.status">
          {{ unit.status === 'active' ? '启用' : '停用' }}
        </span>
        <span class="row-actions">
          <el-button link type="primary" @click="openDetail(unit.id)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete([unit.id])">删除</el-button>
        </span>
      </div>

      <div class="table-footer">
        <span>共 {{ total }} 条 · 第 {{ page }} / {{ Math.max(1, Math.ceil(total / pageSize)) }} 页</span>
        <span class="footer-spacer" />
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="handlePageChange"
        />
      </div>
    </section>

    <p class="api-hint">
      GET /api/knowledge/units · GET /api/knowledge/categories · POST /api/knowledge/units · DELETE /api/knowledge/units
    </p>

    <el-dialog v-model="createVisible" title="新建知识单元" width="560px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="标题" prop="title">
          <el-input v-model="createForm.title" maxlength="120" show-word-limit placeholder="例如：差旅与出差管理标准" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="createForm.category"
            class="full"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入分类"
          >
            <el-option
              v-for="category in categories"
              :key="category.name"
              :label="category.name"
              :value="category.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="createForm.tags" placeholder="多个标签用逗号分隔" />
        </el-form-item>
        <el-form-item label="正文（Markdown）" prop="content">
          <el-input v-model="createForm.content" type="textarea" :rows="8" placeholder="输入知识正文，保存后立即生成版本并重建索引" />
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
.units-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
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

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.search {
  width: 300px;
}

.select {
  width: 150px;
}

.filter-spacer {
  flex: 1;
}

.selected-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--kb-text-3);
  font-size: 11px;
}

.table-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: 34px 126px minmax(0, 1fr) 86px 54px 200px 76px 96px 62px 100px;
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
  min-height: 52px;
  border-bottom: 1px solid var(--kb-border);
}

.table-row:hover {
  background: #fbfcfe;
}

.checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--kb-primary);
}

.code {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.title-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.unit-title {
  overflow: hidden;
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-sub {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.muted {
  color: var(--kb-text-2);
  font-size: 10.5px;
}

.num {
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.type {
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.status {
  width: 54px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9.5px;
  text-align: center;
}

.status.active {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.status.disabled {
  background: #f2f4f7;
  color: var(--kb-text-3);
}

.row-actions {
  display: flex;
  gap: 6px;
}

.empty {
  padding: 40px;
  color: var(--kb-text-3);
  font-size: 12px;
  text-align: center;
}

.table-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 16px;
  color: var(--kb-text-3);
  font-size: 10.5px;
}

.footer-spacer {
  flex: 1;
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
