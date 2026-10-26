<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  listUsers,
  updateDepartment,
} from '@/api/org'
import type { OrgDepartment, OrgUser } from '@/types/org'

interface FlatNode {
  department: OrgDepartment
  level: number
  hasChildren: boolean
}

const departments = ref<OrgDepartment[]>([])
const users = ref<OrgUser[]>([])
const selectedId = ref<number | null>(null)
const isLoading = ref(false)

const dialogVisible = ref(false)
const editingDepartment = ref<OrgDepartment | null>(null)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({
  name: '',
  parent_id: null as number | null,
  leader_id: null as number | null,
  sort_order: 0,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入部门名称', trigger: 'blur' }],
}

const flatTree = computed<FlatNode[]>(() => {
  const byParent = new Map<number | null, OrgDepartment[]>()
  for (const department of [...departments.value].sort(
    (a, b) => a.sort_order - b.sort_order || a.id - b.id,
  )) {
    const list = byParent.get(department.parent_id) ?? []
    list.push(department)
    byParent.set(department.parent_id, list)
  }
  const result: FlatNode[] = []
  const walk = (parentId: number | null, level: number): void => {
    for (const department of byParent.get(parentId) ?? []) {
      result.push({ department, level, hasChildren: (byParent.get(department.id)?.length ?? 0) > 0 })
      walk(department.id, level + 1)
    }
  }
  walk(null, 0)
  return result
})

const selected = computed(
  () => departments.value.find((department) => department.id === selectedId.value) ?? null,
)
const members = computed(() =>
  users.value.filter((user) => user.department_id === selectedId.value),
)
const children = computed(() =>
  departments.value.filter((department) => department.parent_id === selectedId.value),
)
const parentName = computed(() =>
  selected.value?.parent_id
    ? departments.value.find((department) => department.id === selected.value?.parent_id)?.name ??
      '—'
    : '—',
)

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const [departmentList, userList] = await Promise.all([listDepartments(), listUsers()])
    departments.value = departmentList
    users.value = userList
    if (!selectedId.value || !departmentList.some((item) => item.id === selectedId.value)) {
      selectedId.value = departmentList[0]?.id ?? null
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '部门加载失败')
  } finally {
    isLoading.value = false
  }
}

function openCreate(parentId: number | null = null): void {
  editingDepartment.value = null
  form.name = ''
  form.parent_id = parentId
  form.leader_id = null
  form.sort_order = 0
  dialogVisible.value = true
}

function openEdit(department: OrgDepartment): void {
  editingDepartment.value = department
  form.name = department.name
  form.parent_id = department.parent_id
  form.leader_id = department.leader_id
  form.sort_order = department.sort_order
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  if (!formRef.value) {
    return
  }
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) {
    return
  }
  submitting.value = true
  try {
    if (editingDepartment.value) {
      await updateDepartment(editingDepartment.value.id, {
        name: form.name.trim(),
        parent_id: form.parent_id,
        leader_id: form.leader_id,
        sort_order: form.sort_order,
      })
      ElMessage.success('部门已更新')
    } else {
      const department = await createDepartment({
        name: form.name.trim(),
        parent_id: form.parent_id,
        leader_id: form.leader_id,
        sort_order: form.sort_order,
      })
      selectedId.value = department.id
      ElMessage.success('部门已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function remove(department: OrgDepartment): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除部门「${department.name}」？`, '删除部门', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteDepartment(department.id)
    ElMessage.success('部门已删除')
    selectedId.value = null
    await load()
  } catch (error) {
    if (error instanceof Error && error.message) {
      ElMessage.error(error.message)
    }
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="departments-page">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">部门管理</h1>
        <p class="kb-page-subtitle">维护树形组织、负责人与成员；部门权限默认覆盖子部门</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate()">新增部门</el-button>
    </header>

    <div class="departments-body" v-loading="isLoading">
      <aside class="tree-card kb-card">
        <h3>组织架构</h3>
        <div class="tree">
          <button
            v-for="node in flatTree"
            :key="node.department.id"
            type="button"
            class="tree-node"
            :class="{ 'is-active': node.department.id === selectedId }"
            :style="{ paddingLeft: `${8 + node.level * 20}px` }"
            @click="selectedId = node.department.id"
          >
            <span class="expand">{{ node.hasChildren ? '▾' : '' }}</span>
            <span class="node-name">{{ node.department.name }}</span>
            <span class="node-count">{{ node.department.member_count }}</span>
          </button>
        </div>
        <p class="tree-hint">
          成员数来自 users.department_id；删除前需先移除子部门与成员。
        </p>
      </aside>

      <section v-if="selected" class="detail-card kb-card">
        <header class="detail-head">
          <div class="detail-title">
            <h2>{{ selected.name }}</h2>
            <span class="dept-chip">DEPT-{{ selected.id }}</span>
            <p>上级部门：{{ parentName }}</p>
          </div>
          <div class="detail-actions">
            <el-button size="small" @click="openCreate(selected.id)">新增子部门</el-button>
            <el-button size="small" @click="openEdit(selected)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="remove(selected)">删除</el-button>
          </div>
        </header>

        <div class="info-grid">
          <div class="info-cell">
            <span>上级部门</span>
            <strong>{{ parentName }}</strong>
          </div>
          <div class="info-cell">
            <span>负责人</span>
            <strong>{{ selected.leader_name || '未设置' }}</strong>
          </div>
          <div class="info-cell">
            <span>成员数</span>
            <strong>{{ selected.member_count }} 人</strong>
          </div>
          <div class="info-cell">
            <span>排序</span>
            <strong>{{ selected.sort_order }}</strong>
          </div>
        </div>

        <h3 class="section-title">部门成员</h3>
        <div class="member-table">
          <div class="member-header">
            <span>姓名</span>
            <span>用户名</span>
            <span>角色</span>
            <span>状态</span>
          </div>
          <div v-for="member in members" :key="member.id" class="member-row">
            <div class="member-name">
              <span class="avatar">{{ member.display_name.slice(0, 1) }}</span>
              {{ member.display_name }}
            </div>
            <span class="num">{{ member.username }}</span>
            <div class="role-chips">
              <span v-for="role in member.role_names" :key="role" class="role-chip">{{ role }}</span>
            </div>
            <span class="status" :class="member.status">
              {{ member.status === 'active' ? '启用' : '停用' }}
            </span>
          </div>
          <p v-if="members.length === 0" class="empty-row">该部门暂无成员</p>
        </div>

        <h3 class="section-title">子部门</h3>
        <div v-if="children.length > 0" class="children">
          <button
            v-for="child in children"
            :key="child.id"
            type="button"
            class="child-row"
            @click="selectedId = child.id"
          >
            <span class="child-name">{{ child.name }}</span>
            <span class="child-meta">负责人 {{ child.leader_name || '—' }} · {{ child.member_count }} 人</span>
            <span class="child-link">进入</span>
          </button>
        </div>
        <p v-else class="empty-row">暂无子部门</p>
      </section>

      <el-empty v-else class="detail-empty" description="请选择一个部门" />
    </div>

    <p class="api-hint">
      GET /api/org/departments · POST/PUT/DELETE /api/org/departments[/{id}]
    </p>

    <el-dialog
      v-model="dialogVisible"
      :title="editingDepartment ? '编辑部门' : '新增部门'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：平台研发组" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="form.parent_id" class="full" clearable placeholder="选择上级部门">
            <el-option
              v-for="department in departments.filter((item) => item.id !== editingDepartment?.id)"
              :key="department.id"
              :label="department.name"
              :value="department.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="form.leader_id" class="full" clearable filterable placeholder="选择负责人">
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="`${user.display_name}（${user.department_name}）`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.departments-page {
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

.departments-body {
  display: flex;
  gap: 14px;
  align-items: stretch;
  min-height: calc(100vh - 62px - 56px - 100px);
}

.tree-card {
  display: flex;
  width: 340px;
  flex: 0 0 340px;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
}

.tree-card h3 {
  margin: 0;
  font-size: 12.5px;
  font-weight: 600;
}

.tree {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding-right: 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--kb-text);
  cursor: pointer;
  text-align: left;
}

.tree-node:hover {
  background: #f5f7fb;
}

.tree-node.is-active {
  background: var(--kb-primary-soft);
}

.expand {
  width: 10px;
  color: var(--kb-text-3);
  font-size: 12px;
}

.node-name {
  flex: 1;
  overflow: hidden;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-node.is-active .node-name {
  color: var(--kb-primary);
  font-weight: 600;
}

.node-count {
  padding: 1px 6px;
  border-radius: 9px;
  background: #f2f4f7;
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 8.5px;
}

.tree-node.is-active .node-count {
  background: var(--kb-primary);
  color: #fff;
}

.tree-hint {
  margin: auto 0 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
  line-height: 1.5;
}

.detail-card {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  overflow: hidden;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.dept-chip {
  align-self: flex-start;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f2f4f7;
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.detail-title p {
  margin: 2px 0 0;
  color: var(--kb-text-3);
  font-size: 10px;
}

.detail-actions {
  display: flex;
  gap: 6px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.info-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px;
  border-radius: 8px;
  background: #f9fafb;
}

.info-cell span {
  color: var(--kb-text-3);
  font-size: 9px;
}

.info-cell strong {
  color: var(--kb-text);
  font-size: 11px;
  font-weight: 500;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
}

.member-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  overflow: hidden;
}

.member-header,
.member-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px 180px 70px;
  gap: 8px;
  align-items: center;
  padding: 0 12px;
}

.member-header {
  height: 34px;
  background: #f9fafb;
  border-bottom: 1px solid var(--kb-border);
  color: var(--kb-text-3);
  font-size: 10px;
}

.member-row {
  min-height: 42px;
  border-bottom: 1px solid var(--kb-border);
}

.member-name {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--kb-text);
  font-size: 10.5px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e9eef6;
  color: var(--kb-text-2);
  font-size: 9.5px;
}

.num {
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 10px;
}

.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.role-chip {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--kb-primary-soft);
  color: var(--kb-primary);
  font-size: 9px;
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

.children {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.child-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.child-row:hover {
  border-color: var(--kb-primary);
}

.child-name {
  flex: 1;
  color: var(--kb-text);
  font-size: 11px;
}

.child-meta {
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.child-link {
  color: var(--kb-primary);
  font-size: 9.5px;
}

.empty-row {
  margin: 0;
  padding: 16px;
  color: var(--kb-text-3);
  font-size: 10.5px;
  text-align: center;
}

.detail-empty {
  flex: 1;
  background: var(--kb-surface);
  border: 1px solid var(--kb-border);
  border-radius: var(--kb-radius-lg);
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
