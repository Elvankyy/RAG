<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'

import {
  createUser,
  deleteUser,
  listDepartments,
  listRoles,
  listUsers,
  resetUserPassword,
  setUserStatus,
  updateUser,
} from '@/api/org'
import type { OrgDepartment, OrgRole, OrgUser } from '@/types/org'

const users = ref<OrgUser[]>([])
const departments = ref<OrgDepartment[]>([])
const roles = ref<OrgRole[]>([])
const isLoading = ref(false)

const filters = reactive({
  keyword: '',
  departmentId: undefined as number | undefined,
  status: '',
})

const dialogVisible = ref(false)
const editingUser = ref<OrgUser | null>(null)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({
  username: '',
  password: '',
  display_name: '',
  department_id: null as number | null,
  role_ids: [] as number[],
  status: 'active' as 'active' | 'disabled',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  display_name: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入初始密码', trigger: 'blur' }],
}

const resetVisible = ref(false)
const resetTarget = ref<OrgUser | null>(null)
const newPassword = ref('')
const resetting = ref(false)

const avatarColors = ['#1d4ed8', '#7c5cfc', '#0f766e', '#b45309', '#be123c', '#0369a1']

function avatarColor(id: number): string {
  return avatarColors[id % avatarColors.length]
}

function formatTime(iso: string): string {
  return dayjs(iso).format('YYYY-MM-DD')
}

async function loadOptions(): Promise<void> {
  const [departmentList, roleList] = await Promise.all([listDepartments(), listRoles()])
  departments.value = departmentList
  roles.value = roleList
}

async function loadUsers(): Promise<void> {
  isLoading.value = true
  try {
    users.value = await listUsers({
      keyword: filters.keyword || undefined,
      department_id: filters.departmentId,
      status: filters.status || undefined,
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '用户加载失败')
  } finally {
    isLoading.value = false
  }
}

function handleQuery(): void {
  void loadUsers()
}

function handleReset(): void {
  filters.keyword = ''
  filters.departmentId = undefined
  filters.status = ''
  void loadUsers()
}

function openCreate(): void {
  editingUser.value = null
  form.username = ''
  form.password = ''
  form.display_name = ''
  form.department_id = departments.value[0]?.id ?? null
  form.role_ids = [roles.value.find((role) => role.role_code === 'normal_user')?.id ?? 3]
  form.status = 'active'
  dialogVisible.value = true
}

function openEdit(user: OrgUser): void {
  editingUser.value = user
  form.username = user.username
  form.password = ''
  form.display_name = user.display_name
  form.department_id = user.department_id
  form.role_ids = [...user.role_ids]
  form.status = user.status
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
    if (editingUser.value) {
      await updateUser(editingUser.value.id, {
        display_name: form.display_name,
        department_id: form.department_id,
        role_ids: form.role_ids,
        status: form.status,
      })
      ElMessage.success('用户信息已更新')
    } else {
      await createUser({
        username: form.username.trim(),
        password: form.password,
        display_name: form.display_name.trim(),
        department_id: form.department_id,
        role_ids: form.role_ids,
        status: form.status,
      })
      ElMessage.success('用户已创建')
    }
    dialogVisible.value = false
    await Promise.all([loadUsers(), loadOptions()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

function openReset(user: OrgUser): void {
  resetTarget.value = user
  newPassword.value = ''
  resetVisible.value = true
}

async function submitReset(): Promise<void> {
  if (!resetTarget.value) {
    return
  }
  if (newPassword.value.length < 6) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  resetting.value = true
  try {
    await resetUserPassword(resetTarget.value.id, newPassword.value)
    ElMessage.success('密码已重置，请通知用户重新登录')
    resetVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重置失败')
  } finally {
    resetting.value = false
  }
}

async function toggleStatus(user: OrgUser): Promise<void> {
  const next = user.status === 'active' ? 'disabled' : 'active'
  try {
    await setUserStatus(user.id, next)
    ElMessage.success(next === 'active' ? '已启用' : '已停用，账号将立即失去登录权限')
    await loadUsers()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '状态更新失败')
  }
}

async function remove(user: OrgUser): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除用户「${user.display_name}」？`, '删除用户', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteUser(user.id)
    ElMessage.success('用户已删除')
    await Promise.all([loadUsers(), loadOptions()])
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  void loadOptions()
  void loadUsers()
})
</script>

<template>
  <div class="users-page">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">用户管理</h1>
        <p class="kb-page-subtitle">
          维护账号、部门归属与角色；停用后立即失去登录与 AI 访问权限
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增用户</el-button>
    </header>

    <div class="filter-bar">
      <el-input
        v-model="filters.keyword"
        class="search"
        placeholder="搜索用户名或显示名"
        :prefix-icon="Search"
        clearable
        @keyup.enter="handleQuery"
      />
      <el-select v-model="filters.departmentId" class="select" placeholder="全部部门" clearable>
        <el-option
          v-for="department in departments"
          :key="department.id"
          :label="department.name"
          :value="department.id"
        />
      </el-select>
      <el-select v-model="filters.status" class="select" placeholder="全部状态" clearable>
        <el-option label="启用" value="active" />
        <el-option label="停用" value="disabled" />
      </el-select>
      <el-button type="primary" @click="handleQuery">查询</el-button>
      <el-button text @click="handleReset">重置</el-button>
      <span class="filter-spacer" />
      <span class="count-hint">共 {{ users.length }} 个账号</span>
    </div>

    <section class="table-card kb-card" v-loading="isLoading">
      <div class="table-header">
        <span>用户</span>
        <span>用户名</span>
        <span>部门</span>
        <span>角色</span>
        <span>状态</span>
        <span>创建时间</span>
        <span>操作</span>
      </div>

      <div v-for="user in users" :key="user.id" class="table-row">
        <div class="user-cell">
          <span class="avatar" :style="{ background: avatarColor(user.id) }">
            {{ user.display_name.slice(0, 1) }}
          </span>
          <div class="user-text">
            <span class="user-name">{{ user.display_name }}</span>
            <span class="user-email">{{ user.username }}@yunqi.com</span>
          </div>
        </div>
        <span class="muted num">{{ user.username }}</span>
        <span class="muted">{{ user.department_name }}</span>
        <div class="role-chips">
          <span v-for="role in user.role_names" :key="role" class="role-chip">{{ role }}</span>
        </div>
        <span class="status" :class="user.status">
          {{ user.status === 'active' ? '启用' : '停用' }}
        </span>
        <span class="muted num">{{ formatTime(user.created_at) }}</span>
        <div class="row-actions">
          <el-button link type="primary" @click="openEdit(user)">编辑</el-button>
          <el-button link @click="openReset(user)">重置密码</el-button>
          <el-button link :type="user.status === 'active' ? 'danger' : 'success'" @click="toggleStatus(user)">
            {{ user.status === 'active' ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" @click="remove(user)">删除</el-button>
        </div>
      </div>

      <div v-if="!isLoading && users.length === 0" class="empty">没有匹配的用户</div>
    </section>

    <p class="api-hint">
      GET/POST /api/org/users · PUT /api/org/users/{id} · POST /api/org/users/{id}/reset-password · POST /api/org/users/{id}/status
    </p>

    <el-dialog v-model="dialogVisible" :title="editingUser ? '编辑用户' : '新增用户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="Boolean(editingUser)" placeholder="登录账号" />
        </el-form-item>
        <el-form-item v-if="!editingUser" label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="显示名" prop="display_name">
          <el-input v-model="form.display_name" placeholder="例如：陈思远" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-select v-model="form.department_id" class="full" placeholder="选择部门">
            <el-option
              v-for="department in departments"
              :key="department.id"
              :label="department.name"
              :value="department.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role_ids" class="full" multiple placeholder="选择角色">
            <el-option
              v-for="role in roles"
              :key="role.id"
              :label="role.role_name"
              :value="role.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" class="full">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="resetVisible" title="重置密码" width="420px">
      <p class="reset-hint">
        将为 {{ resetTarget?.display_name }} 设置新密码；保存后该用户的登录状态会失效。
      </p>
      <el-input v-model="newPassword" type="password" show-password placeholder="新密码，至少 6 位" />
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="resetting" @click="submitReset">重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
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

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.search {
  width: 280px;
}

.select {
  width: 140px;
}

.filter-spacer {
  flex: 1;
}

.count-hint {
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
  grid-template-columns: minmax(0, 1.3fr) 100px 110px 190px 70px 100px 240px;
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

.table-row:hover {
  background: #fbfcfe;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.user-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
}

.user-email {
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

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.empty {
  padding: 40px;
  color: var(--kb-text-3);
  font-size: 12px;
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

.reset-hint {
  margin: 0 0 12px;
  color: var(--kb-text-2);
  font-size: 12px;
  line-height: 1.6;
}
</style>
