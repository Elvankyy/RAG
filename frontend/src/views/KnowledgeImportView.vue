<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderOpened, Refresh, Upload, UploadFilled } from '@element-plus/icons-vue'

import { getImportBatch, importFiles, retryImportTask } from '@/api/knowledge'
import type { ImportBatch, ImportTask } from '@/types/knowledge'

const ACCEPT = '.pdf,.md,.markdown,.docx,.txt'
const MAX_FILE_SIZE = 50 * 1024 * 1024
const MAX_FILES = 50

const files = ref<File[]>([])
const fileInput = ref<HTMLInputElement>()
const folderInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const isUploading = ref(false)
const category = ref('')
const tags = ref('')
const batch = ref<ImportBatch | null>(null)
let timer: number | undefined

const totalBytes = computed(() => files.value.reduce((sum, file) => sum + file.size, 0))
const batchProgress = computed(() => {
  if (!batch.value || batch.value.total === 0) {
    return 0
  }
  const sum = batch.value.tasks.reduce((acc, task) => acc + task.progress, 0)
  return Math.round(sum / batch.value.total)
})
const hasFailed = computed(() =>
  Boolean(batch.value?.tasks.some((task) => task.status === 'failed')),
)
const batchStatusText = computed(() => {
  if (!batch.value) {
    return ''
  }
  if (batch.value.status === 'processing') {
    return '处理中'
  }
  if (batch.value.status === 'success') {
    return '全部成功'
  }
  if (batch.value.status === 'partial') {
    return '部分成功'
  }
  return '失败'
})

function triggerFile(): void {
  fileInput.value?.click()
}

function triggerFolder(): void {
  folderInput.value?.click()
}

function addFiles(input: FileList | File[]): void {
  const incoming = Array.from(input)
  for (const file of incoming) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ACCEPT.split(',').includes(extension)) {
      ElMessage.warning(`${file.name} 格式不支持，仅接受 PDF / DOCX / MD / TXT`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      ElMessage.warning(`${file.name} 超过 50MB 限制`)
      continue
    }
    if (files.value.some((item) => item.name === file.name && item.size === file.size)) {
      continue
    }
    files.value.push(file)
  }
  if (files.value.length > MAX_FILES) {
    files.value = files.value.slice(0, MAX_FILES)
    ElMessage.warning(`单批最多 ${MAX_FILES} 个文件`)
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  if (input.files) {
    addFiles(input.files)
  }
  input.value = ''
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  if (event.dataTransfer?.files) {
    addFiles(event.dataTransfer.files)
  }
}

function removeFile(index: number): void {
  files.value.splice(index, 1)
}

async function startImport(): Promise<void> {
  if (files.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }
  isUploading.value = true
  try {
    const result = await importFiles(files.value, category.value, tags.value)
    batch.value = result
    files.value = []
    ElMessage.success(`已提交 ${result.total} 个文件的导入任务`)
    startPolling()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入提交失败')
  } finally {
    isUploading.value = false
  }
}

function startPolling(): void {
  stopPolling()
  void poll()
  timer = window.setInterval(() => {
    void poll()
  }, 1500)
}

function stopPolling(): void {
  if (timer) {
    window.clearInterval(timer)
    timer = undefined
  }
}

async function poll(): Promise<void> {
  if (!batch.value) {
    stopPolling()
    return
  }
  try {
    batch.value = await getImportBatch(batch.value.id)
    if (batch.value.status !== 'processing') {
      stopPolling()
    }
  } catch {
    stopPolling()
  }
}

async function retry(task: ImportTask): Promise<void> {
  try {
    await retryImportTask(task.id)
    ElMessage.info('已重新排队')
    startPolling()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重试失败')
  }
}

function statusText(status: ImportTask['status']): string {
  const map: Record<ImportTask['status'], string> = {
    pending: '排队中',
    parsing: '解析中',
    splitting: '切分中',
    embedding: '向量化',
    indexing: '索引中',
    success: '已完成',
    failed: '失败',
  }
  return map[status]
}

function statusType(status: ImportTask['status']): 'info' | 'primary' | 'success' | 'danger' {
  if (status === 'success') {
    return 'success'
  }
  if (status === 'failed') {
    return 'danger'
  }
  if (status === 'pending') {
    return 'info'
  }
  return 'primary'
}

function formatSize(size: number): string {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

function fileTypeOf(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'TXT'
}

onUnmounted(stopPolling)
</script>

<template>
  <div class="import-page">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">知识导入</h1>
        <p class="kb-page-subtitle">
          支持单文件、批量与目录导入；解析完成后自动切片、向量化并进入检索
        </p>
      </div>
      <div class="head-actions">
        <el-button @click="ElMessage.info('导入记录将在后续模块接入分页查询')">导入记录</el-button>
        <el-button
          type="primary"
          :icon="Upload"
          :loading="isUploading"
          :disabled="files.length === 0"
          @click="startImport"
        >
          开始导入
        </el-button>
      </div>
    </header>

    <div class="stats">
      <div v-if="batch" class="stat-card kb-card">
        <span>本批文件</span>
        <strong>{{ batch.total }}</strong>
        <em>批次 {{ batch.id }}</em>
      </div>
      <div v-if="batch" class="stat-card kb-card">
        <span>解析成功</span>
        <strong class="success">{{ batch.success_count }}</strong>
        <em>已入库并完成索引</em>
      </div>
      <div v-if="batch" class="stat-card kb-card">
        <span>解析失败</span>
        <strong class="danger">{{ batch.failed_count }}</strong>
        <em>可单文件重试</em>
      </div>
      <div v-if="batch" class="stat-card kb-card">
        <span>批次进度</span>
        <strong>{{ batchProgress }}%</strong>
        <em>{{ batchStatusText }}</em>
      </div>

      <template v-else>
        <div class="stat-card kb-card">
          <span>支持格式</span>
          <strong>4</strong>
          <em>PDF / DOCX / MD / TXT</em>
        </div>
        <div class="stat-card kb-card">
          <span>单文件上限</span>
          <strong>50MB</strong>
          <em>扩展名与魔数双重校验</em>
        </div>
        <div class="stat-card kb-card">
          <span>单批上限</span>
          <strong>50</strong>
          <em>支持目录上传与部分成功</em>
        </div>
        <div class="stat-card kb-card">
          <span>OCR</span>
          <strong>默认关闭</strong>
          <em>需管理员显式开启 MinerU</em>
        </div>
      </template>
    </div>

    <div class="main-row">
      <section
        class="dropzone kb-card"
        :class="{ 'is-dragging': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop="onDrop"
      >
        <input
          ref="fileInput"
          type="file"
          class="hidden-input"
          :accept="ACCEPT"
          multiple
          @change="onFileChange"
        />
        <input
          ref="folderInput"
          type="file"
          class="hidden-input"
          :accept="ACCEPT"
          multiple
          webkitdirectory
          @change="onFileChange"
        />

        <div class="drop-icon">
          <el-icon :size="26"><UploadFilled /></el-icon>
        </div>
        <h2>拖拽文件到此处，或点击选择</h2>
        <p>支持 PDF / DOCX / MD / TXT · 单文件 ≤ 50MB · 单批 ≤ 50 个</p>
        <div class="drop-actions">
          <el-button type="primary" @click="triggerFile">选择文件</el-button>
          <el-button :icon="FolderOpened" @click="triggerFolder">选择文件夹</el-button>
        </div>

        <div class="import-settings">
          <el-input v-model="category" placeholder="分类（选填，如：技术规范）" class="setting-input" />
          <el-input v-model="tags" placeholder="标签（选填，逗号分隔）" class="setting-input" />
        </div>

        <div v-if="files.length > 0" class="selected-files">
          <div class="selected-head">
            <span>已选 {{ files.length }} 个文件 · {{ formatSize(totalBytes) }}</span>
            <el-button link type="danger" @click="files = []">清空</el-button>
          </div>
          <div v-for="(file, index) in files" :key="`${file.name}-${file.size}`" class="selected-row">
            <span class="selected-name">{{ file.name }}</span>
            <span class="selected-type">{{ fileTypeOf(file.name) }}</span>
            <span class="selected-size">{{ formatSize(file.size) }}</span>
            <el-button link type="danger" @click="removeFile(index)">移除</el-button>
          </div>
        </div>

        <p class="drop-hint">导入后可在「知识单元」中配置数据权限；默认无权限，需显式授权</p>
      </section>

      <aside class="format-panel kb-card">
        <h3>支持格式</h3>
        <div class="format-row">
          <span class="format-name">PDF</span>
          <span class="format-desc">PyMuPDF 解析文本；扫描件需开启 OCR</span>
        </div>
        <div class="format-row">
          <span class="format-name">Word (.docx)</span>
          <span class="format-desc">python-docx 提取段落与表格；.doc 需转存</span>
        </div>
        <div class="format-row">
          <span class="format-name">Markdown</span>
          <span class="format-desc">保留标题层级、代码块与表格</span>
        </div>
        <div class="format-row">
          <span class="format-name">TXT</span>
          <span class="format-desc">UTF-8 / GBK 自动检测并统一编码</span>
        </div>

        <div class="ocr-notice">
          <strong>OCR 默认关闭</strong>
          <p>开启 MinerU 会把文档发送至云端，请确认数据合规后再启用。</p>
        </div>

        <div class="format-hint">
          <strong>导入后会发生什么？</strong>
          <p>解析 → 标题感知切片 → 远程 embedding → 写入 Milvus → 写入 unit_chunks → 更新版本与索引状态。</p>
        </div>
      </aside>
    </div>

    <section v-if="batch" class="task-card kb-card">
      <div class="task-head">
        <div>
          <strong>导入任务</strong>
          <span class="task-meta">
            批次 {{ batch.id }} · {{ batchStatusText }} ·
            {{ batch.success_count }}/{{ batch.total }} 成功
          </span>
        </div>
        <el-button :icon="Refresh" size="small" @click="poll">刷新</el-button>
      </div>

      <div class="task-table">
        <div class="task-header">
          <span>文件名</span>
          <span>格式</span>
          <span>大小</span>
          <span>状态</span>
          <span>进度</span>
          <span>操作</span>
        </div>
        <div v-for="task in batch.tasks" :key="task.id" class="task-row">
          <span class="task-name">
            {{ task.file_name }}
            <em v-if="task.message">{{ task.message }}</em>
          </span>
          <span class="task-type">{{ task.file_type.toUpperCase() }}</span>
          <span class="task-size">{{ formatSize(task.file_size) }}</span>
          <span>
            <el-tag size="small" :type="statusType(task.status)" effect="light">
              {{ statusText(task.status) }}
            </el-tag>
          </span>
          <span class="task-progress">
            <span class="track">
              <span
                class="fill"
                :class="{ failed: task.status === 'failed' }"
                :style="{ width: `${task.progress}%` }"
              />
            </span>
            <span class="progress-text">{{ task.progress }}%</span>
          </span>
          <span>
            <el-button
              v-if="task.status === 'failed'"
              link
              type="primary"
              @click="retry(task)"
            >
              重试
            </el-button>
            <span v-else class="task-muted">{{ task.unit_code || '—' }}</span>
          </span>
        </div>
      </div>
    </section>

    <p v-if="hasFailed" class="failed-hint">
      存在解析失败的文件：扫描件需开启 OCR，或检查 PDF 是否损坏。
    </p>

    <p class="api-hint">
      POST /api/knowledge/import · GET /api/knowledge/import/batches/{batch_id} · POST /api/knowledge/import/tasks/{task_id}/retry
    </p>
  </div>
</template>

<style scoped>
.import-page {
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

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 13px;
}

.stat-card span {
  color: var(--kb-text-3);
  font-size: 10px;
}

.stat-card strong {
  color: var(--kb-text);
  font-family: var(--kb-font-num);
  font-size: 22px;
  font-weight: 600;
}

.stat-card strong.success {
  color: var(--kb-success);
}

.stat-card strong.danger {
  color: var(--kb-danger);
}

.stat-card em {
  color: var(--kb-text-3);
  font-size: 9px;
  font-style: normal;
}

.main-row {
  display: flex;
  gap: 14px;
  align-items: stretch;
}

.dropzone {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  border: 1px dashed var(--kb-border-strong);
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dropzone.is-dragging {
  border-color: var(--kb-primary);
  background: var(--kb-primary-soft);
}

.hidden-input {
  display: none;
}

.drop-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
}

.dropzone h2 {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 500;
}

.dropzone > p {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 11px;
}

.drop-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.import-settings {
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 520px;
  margin-top: 8px;
}

.setting-input {
  flex: 1;
}

.selected-files {
  display: flex;
  width: 100%;
  max-width: 640px;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: #f9fafb;
  text-align: left;
}

.selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--kb-text-2);
  font-size: 10.5px;
}

.selected-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 60px 70px 46px;
  gap: 8px;
  align-items: center;
  color: var(--kb-text-2);
  font-size: 10px;
}

.selected-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-type,
.selected-size {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
}

.drop-hint {
  margin-top: 6px;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.format-panel {
  display: flex;
  width: 300px;
  flex: 0 0 300px;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.format-panel h3 {
  margin: 0 0 2px;
  font-size: 12.5px;
  font-weight: 600;
}

.format-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--kb-border);
}

.format-name {
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
}

.format-desc {
  color: var(--kb-text-3);
  font-size: 9.5px;
  line-height: 1.5;
}

.ocr-notice {
  padding: 9px;
  border: 1px solid #fde9c4;
  border-radius: 8px;
  background: var(--kb-warning-soft);
}

.ocr-notice strong {
  color: #b54708;
  font-size: 10px;
  font-weight: 600;
}

.ocr-notice p,
.format-hint p {
  margin: 2px 0 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
  line-height: 1.55;
}

.format-hint {
  padding: 9px;
  border-radius: 8px;
  background: #f9fafb;
}

.format-hint strong {
  color: var(--kb-text-2);
  font-size: 10px;
  font-weight: 600;
}

.task-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--kb-border);
}

.task-head strong {
  font-size: 12.5px;
  font-weight: 600;
}

.task-meta {
  margin-left: 8px;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.task-header,
.task-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px 76px 82px 170px 70px;
  gap: 10px;
  align-items: center;
  padding: 0 16px;
}

.task-header {
  height: 36px;
  background: #f9fafb;
  border-bottom: 1px solid var(--kb-border);
  color: var(--kb-text-3);
  font-size: 10px;
  font-weight: 500;
}

.task-row {
  min-height: 48px;
  border-bottom: 1px solid var(--kb-border);
}

.task-name {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  gap: 1px;
  color: var(--kb-text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-name em {
  color: var(--kb-text-3);
  font-size: 9px;
  font-style: normal;
}

.task-type,
.task-size {
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.track {
  width: 120px;
  height: 5px;
  overflow: hidden;
  border-radius: 3px;
  background: #eef2f7;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--kb-primary);
  transition: width 0.4s ease;
}

.fill.failed {
  background: var(--kb-danger);
}

.progress-text {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.task-muted {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.failed-hint {
  margin: 0;
  color: var(--kb-danger);
  font-size: 10.5px;
}

.api-hint {
  margin: 0;
  color: #b8c2d3;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}
</style>
