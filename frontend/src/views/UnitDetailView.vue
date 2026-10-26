<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Check, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

import PermissionChips from '@/components/knowledge/PermissionChips.vue'
import {
  getUnit,
  listCategories,
  listVersions,
  reindexUnit,
  rollbackUnit,
  setUnitPermissions,
  updateUnit,
} from '@/api/knowledge'
import { listDepartments, listRoles, listUsers } from '@/api/org'
import type { CategoryItem, KnowledgeUnit, UnitVersion } from '@/types/knowledge'
import type { OrgDepartment, OrgRole, OrgUser } from '@/types/org'

const route = useRoute()
const router = useRouter()

const unitId = computed(() => Number(route.params.id))
const unit = ref<KnowledgeUnit | null>(null)
const versions = ref<UnitVersion[]>([])
const categories = ref<CategoryItem[]>([])
const departments = ref<OrgDepartment[]>([])
const roles = ref<OrgRole[]>([])
const users = ref<OrgUser[]>([])
const tabs = [
  { key: 'content', label: '正文' },
  { key: 'permissions', label: '数据权限' },
  { key: 'versions', label: '版本历史' },
  { key: 'attachments', label: '附件' },
] as const

type TabKey = (typeof tabs)[number]['key']

const activeTab = ref<TabKey>('content')

function setTab(key: TabKey): void {
  activeTab.value = key
}
const isLoading = ref(false)
const isSaving = ref(false)
const isReindexing = ref(false)

const contentForm = reactive({
  title: '',
  category: '',
  tags: '',
  content: '',
  status: 'active' as 'active' | 'disabled',
})

const permissionForm = reactive({
  global: false,
  departmentIds: [] as number[],
  roleIds: [] as number[],
  userIds: [] as number[],
})

const currentPermissions = ref<KnowledgeUnit['permissions']>([])

const currentVersion = computed(() => versions.value.find((version) => version.is_current))

function formatTime(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}

function syncForms(data: KnowledgeUnit): void {
  contentForm.title = data.title
  contentForm.category = data.category
  contentForm.tags = data.tags
  contentForm.content = data.content
  contentForm.status = data.status
  currentPermissions.value = data.permissions

  permissionForm.global = data.permissions.some(
    (permission) => permission.target_type === 'global',
  )
  permissionForm.departmentIds = data.permissions
    .filter((permission) => permission.target_type === 'department')
    .map((permission) => Number(permission.target_id))
  permissionForm.roleIds = data.permissions
    .filter((permission) => permission.target_type === 'role')
    .map((permission) => Number(permission.target_id))
  permissionForm.userIds = data.permissions
    .filter((permission) => permission.target_type === 'user')
    .map((permission) => Number(permission.target_id))
}

async function load(): Promise<void> {
  if (!Number.isFinite(unitId.value)) {
    return
  }
  isLoading.value = true
  try {
    const [data, categoryList, departmentList, roleList, userList, versionList] =
      await Promise.all([
        getUnit(unitId.value),
        listCategories(),
        listDepartments(),
        listRoles(),
        listUsers(),
        listVersions(unitId.value),
      ])
    unit.value = data
    categories.value = categoryList
    departments.value = departmentList
    roles.value = roleList
    users.value = userList
    versions.value = versionList
    syncForms(data)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '知识单元加载失败')
  } finally {
    isLoading.value = false
  }
}

async function saveContent(): Promise<void> {
  if (!unit.value) {
    return
  }
  if (!contentForm.title.trim() || !contentForm.content.trim()) {
    ElMessage.warning('标题与正文不能为空')
    return
  }
  isSaving.value = true
  try {
    await updateUnit(unit.value.id, {
      title: contentForm.title.trim(),
      category: contentForm.category || '未分类',
      tags: contentForm.tags,
      content: contentForm.content,
      status: contentForm.status,
    })
    ElMessage.success('已保存并发布新版本，索引已更新')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    isSaving.value = false
  }
}

async function savePermissions(): Promise<void> {
  if (!unit.value) {
    return
  }
  const permissions: Array<{
    target_type: 'global' | 'department' | 'role' | 'user'
    target_id: number | null
  }> = []
  if (permissionForm.global) {
    permissions.push({ target_type: 'global', target_id: null })
  }
  for (const id of permissionForm.departmentIds) {
    permissions.push({ target_type: 'department', target_id: id })
  }
  for (const id of permissionForm.roleIds) {
    permissions.push({ target_type: 'role', target_id: id })
  }
  for (const id of permissionForm.userIds) {
    permissions.push({ target_type: 'user', target_id: id })
  }
  isSaving.value = true
  try {
    const items = await setUnitPermissions(unit.value.id, permissions)
    currentPermissions.value = items
    unit.value.permissions = items
    unit.value.permission_summary =
      items.length === 0 ? '未配置（无访问权限）' : items.map((item) => item.target_name).join('、')
    ElMessage.success('数据权限已保存，立即生效并异步同步至检索索引')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '权限保存失败')
  } finally {
    isSaving.value = false
  }
}

async function handleSave(): Promise<void> {
  if (activeTab.value === 'permissions') {
    await savePermissions()
    return
  }
  await saveContent()
}

async function handleReindex(): Promise<void> {
  if (!unit.value) {
    return
  }
  isReindexing.value = true
  try {
    await reindexUnit(unit.value.id)
    ElMessage.success('已触发重建索引')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重建索引失败')
  } finally {
    isReindexing.value = false
  }
}

async function handleRollback(version: number): Promise<void> {
  if (!unit.value) {
    return
  }
  try {
    await ElMessageBox.confirm(`确定回滚到 v${version}？当前版本会保留在历史中。`, '版本回滚', {
      type: 'warning',
      confirmButtonText: '回滚',
      cancelButtonText: '取消',
    })
    await rollbackUnit(unit.value.id, version)
    ElMessage.success(`已回滚到 v${version}`)
    await load()
  } catch {
    // 取消回滚
  }
}

function goBack(): void {
  void router.push('/knowledge/units')
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="detail-page" v-loading="isLoading">
    <button type="button" class="back" @click="goBack">
      <el-icon :size="14"><ArrowLeft /></el-icon>
      返回知识单元
    </button>

    <template v-if="unit">
      <header class="detail-head">
        <div class="title-block">
          <h1 class="kb-page-title">{{ unit.title }}</h1>
          <div class="meta">
            <span class="chip code">{{ unit.unit_code }}</span>
            <span class="chip category">{{ unit.category }}</span>
            <span class="chip type">{{ unit.file_type.toUpperCase() }}</span>
            <span class="chip version">v{{ unit.version }} · {{ unit.status === 'active' ? '已发布' : '已停用' }}</span>
          </div>
        </div>
        <div class="head-actions">
          <el-button :icon="Refresh" :loading="isReindexing" @click="handleReindex">重建索引</el-button>
          <el-button
            v-if="activeTab === 'content' || activeTab === 'permissions'"
            type="primary"
            :icon="Check"
            :loading="isSaving"
            @click="handleSave"
          >
            {{ activeTab === 'permissions' ? '保存权限' : '保存并发布' }}
          </el-button>
        </div>
      </header>

      <div class="detail-body">
        <section class="main-card kb-card">
          <div class="tabs">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="tab"
              :class="{ 'is-active': activeTab === tab.key }"
              @click="setTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>

          <div v-if="activeTab === 'content'" class="content-form">
            <el-form label-position="top">
              <el-form-item label="标题">
                <el-input v-model="contentForm.title" maxlength="120" show-word-limit />
              </el-form-item>
              <div class="form-grid">
                <el-form-item label="分类">
                  <el-select v-model="contentForm.category" class="full" filterable allow-create>
                    <el-option
                      v-for="category in categories"
                      :key="category.name"
                      :label="category.name"
                      :value="category.name"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="标签">
                  <el-input v-model="contentForm.tags" placeholder="多个标签用逗号分隔" />
                </el-form-item>
                <el-form-item label="状态">
                  <el-select v-model="contentForm.status" class="full">
                    <el-option label="启用（参与 AI 召回）" value="active" />
                    <el-option label="停用（管理面保留）" value="disabled" />
                  </el-select>
                </el-form-item>
              </div>
              <el-form-item label="正文（Markdown）">
                <el-input
                  v-model="contentForm.content"
                  type="textarea"
                  :rows="18"
                  placeholder="编辑知识正文；保存后生成新版本并重建索引"
                />
              </el-form-item>
              <p class="form-hint">
                编辑即发布：保存后递增版本并重建索引，历史版本可回滚；只有启用的单元参与 AI 召回。
              </p>
            </el-form>
          </div>

          <div v-else-if="activeTab === 'permissions'" class="permission-form">
            <div class="permission-intro">
              <strong>四维数据权限</strong>
              <p>
                支持全局、部门、角色、个人四类实体混合配置，满足任意一种即可访问；未配置任何实体时该单元对 AI 不可见。
                部门权限默认覆盖子部门。
              </p>
            </div>

            <label class="global-row">
              <el-checkbox v-model="permissionForm.global" />
              <span class="global-text">
                <strong>全局公开</strong>
                <span>所有已登录用户均可访问</span>
              </span>
              <span class="global-hint">当前 {{ currentPermissions.length }} 个实体</span>
            </label>

            <div class="permission-row">
              <div class="row-label">
                <strong>部门</strong>
                <span>按组织树继承子部门</span>
              </div>
              <el-select
                v-model="permissionForm.departmentIds"
                class="row-select"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择部门"
              >
                <el-option
                  v-for="department in departments"
                  :key="department.id"
                  :label="department.name"
                  :value="department.id"
                />
              </el-select>
            </div>

            <div class="permission-row">
              <div class="row-label">
                <strong>角色</strong>
                <span>任一角色命中即放行</span>
              </div>
              <el-select
                v-model="permissionForm.roleIds"
                class="row-select"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择角色"
              >
                <el-option
                  v-for="role in roles"
                  :key="role.id"
                  :label="role.role_name"
                  :value="role.id"
                />
              </el-select>
            </div>

            <div class="permission-row">
              <div class="row-label">
                <strong>个人</strong>
                <span>指定用户单独授权</span>
              </div>
              <el-select
                v-model="permissionForm.userIds"
                class="row-select"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择人员"
              >
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="`${user.display_name}（${user.department_name}）`"
                  :value="user.id"
                />
              </el-select>
            </div>

            <div class="permission-current">
              <span>当前权限摘要</span>
              <PermissionChips :permissions="currentPermissions" :max="8" />
            </div>

            <div class="permission-footer">
              <span>保存后立即生效，并异步同步至 Milvus 检索索引。</span>
              <el-button type="primary" :loading="isSaving" @click="savePermissions">
                保存权限
              </el-button>
            </div>
          </div>

          <div v-else-if="activeTab === 'versions'" class="versions">
            <div v-for="version in versions" :key="version.version" class="version-row">
              <span class="version-badge" :class="{ current: version.is_current }">
                v{{ version.version }}{{ version.is_current ? ' · 当前' : '' }}
              </span>
              <div class="version-main">
                <span class="version-summary">{{ version.summary }}</span>
                <span class="version-meta">
                  {{ formatTime(version.created_at) }} · {{ version.editor_name }}
                </span>
              </div>
              <el-button
                v-if="!version.is_current"
                link
                type="primary"
                @click="handleRollback(version.version)"
              >
                回滚
              </el-button>
            </div>
          </div>

          <div v-else class="attachments">
            <div class="empty-icon">◈</div>
            <h3>暂无附件</h3>
            <p>附件上传与预签名下载将在后续模块接入 MinIO；当前版本以正文与来源文件为主。</p>
          </div>
        </section>

        <aside class="side">
          <section class="side-card kb-card">
            <h3>单元信息</h3>
            <dl>
              <div><dt>单元编号</dt><dd>{{ unit.unit_code }}</dd></div>
              <div><dt>分类</dt><dd>{{ unit.category }}</dd></div>
              <div><dt>来源文件</dt><dd>{{ unit.source_file_name || '手工创建' }}</dd></div>
              <div><dt>文件大小</dt><dd>{{ Math.max(1, Math.round(unit.file_size / 1024)) }} KB</dd></div>
              <div><dt>创建人</dt><dd>{{ unit.creator_name }}</dd></div>
              <div><dt>最后更新</dt><dd>{{ formatTime(unit.updated_at) }}</dd></div>
            </dl>
          </section>

          <section class="side-card kb-card">
            <h3>索引状态</h3>
            <div class="index-row">
              <span class="dot" :class="unit.index_status" />
              <span>
                {{
                  unit.index_status === 'synced'
                    ? '已同步'
                    : unit.index_status === 'syncing'
                      ? '同步中'
                      : '同步失败'
                }}
                · {{ unit.chunk_count }} 个切片
              </span>
            </div>
            <dl>
              <div><dt>向量维度</dt><dd>1024</dd></div>
              <div><dt>稀疏检索</dt><dd>BM25 中文</dd></div>
              <div><dt>检索可见</dt><dd>{{ unit.status === 'active' ? '是' : '否' }}</dd></div>
            </dl>
          </section>

          <section class="side-card kb-card">
            <h3>版本历史</h3>
            <div v-for="version in versions.slice(0, 3)" :key="version.version" class="mini-version">
              <span class="version-badge" :class="{ current: version.is_current }">
                v{{ version.version }}
              </span>
              <span class="mini-time">{{ formatTime(version.created_at) }}</span>
            </div>
            <p class="side-hint" v-if="currentVersion">
              当前版本 v{{ currentVersion.version }} · {{ currentVersion.editor_name }}
            </p>
          </section>
        </aside>
      </div>

      <p class="api-hint">
        GET /api/knowledge/units/{{ unit.id }} · PUT /api/knowledge/units/{{ unit.id }} · POST /api/knowledge/units/{{ unit.id }}/permissions · POST /api/knowledge/units/{{ unit.id }}/reindex
      </p>
    </template>

    <el-empty v-else-if="!isLoading" description="知识单元不存在或无权访问" />
  </div>
</template>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kb-text-3);
  font-size: 11px;
  cursor: pointer;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.title-block {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.chip {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 9.5px;
}

.chip.code {
  background: #f2f4f7;
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
}

.chip.category {
  background: var(--kb-purple-soft);
  color: var(--kb-purple);
}

.chip.type {
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
  font-family: var(--kb-font-num);
}

.chip.version {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.head-actions {
  display: flex;
  gap: 8px;
}

.detail-body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.main-card {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
}

.tabs {
  display: flex;
  gap: 26px;
  padding: 0 18px;
  border-bottom: 1px solid var(--kb-border);
}

.tab {
  position: relative;
  padding: 12px 0 10px;
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

.content-form,
.permission-form,
.versions {
  padding: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.full {
  width: 100%;
}

.form-hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 10px;
}

.permission-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.permission-intro strong {
  font-size: 13px;
  font-weight: 600;
}

.permission-intro p {
  margin: 4px 0 0;
  color: var(--kb-text-2);
  font-size: 11px;
  line-height: 1.65;
}

.global-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 9px;
  background: #f9fafb;
  cursor: pointer;
}

.global-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.global-text strong {
  font-size: 11.5px;
  font-weight: 500;
}

.global-text span {
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.global-hint {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.permission-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--kb-border);
  border-radius: 9px;
}

.row-label {
  display: flex;
  width: 108px;
  flex: 0 0 108px;
  flex-direction: column;
  gap: 1px;
}

.row-label strong {
  font-size: 11.5px;
  font-weight: 500;
}

.row-label span {
  color: var(--kb-text-3);
  font-size: 9px;
}

.row-select {
  flex: 1;
}

.permission-current {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 9px;
  background: #f9fafb;
  color: var(--kb-text-3);
  font-size: 10px;
}

.permission-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.versions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--kb-border);
  border-radius: 9px;
}

.version-badge {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f2f4f7;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.version-badge.current {
  background: var(--kb-success-soft);
  color: var(--kb-success);
}

.version-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.version-summary {
  overflow: hidden;
  color: var(--kb-text-2);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-meta {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.attachments {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
  font-size: 24px;
}

.attachments h3 {
  margin: 4px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.attachments p {
  max-width: 420px;
  margin: 0;
  color: var(--kb-text-3);
  font-size: 11px;
  line-height: 1.7;
}

.side {
  display: flex;
  width: 306px;
  flex: 0 0 306px;
  flex-direction: column;
  gap: 12px;
}

.side-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.side-card h3 {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
}

.side-card dl {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.side-card dl div {
  display: flex;
  gap: 8px;
}

.side-card dt {
  width: 72px;
  flex: 0 0 72px;
  color: var(--kb-text-3);
  font-size: 10px;
}

.side-card dd {
  overflow: hidden;
  margin: 0;
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.index-row {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--kb-text-2);
  font-size: 10.5px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot.synced {
  background: var(--kb-success);
}

.dot.syncing {
  background: var(--kb-warning);
}

.dot.failed {
  background: var(--kb-danger);
}

.mini-version {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-time {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.side-hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.api-hint {
  margin: 0;
  color: #b8c2d3;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}
</style>
