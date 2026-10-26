<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

import {
  createRole,
  deleteRole,
  listPermissionCatalog,
  listRoles,
  setRolePermissions,
  updateRole,
} from '@/api/org'
import type { OrgRole, PermissionCatalogItem } from '@/types/org'

const roles = ref<OrgRole[]>([])
const catalog = ref<PermissionCatalogItem[]>([])
const selectedRoleId = ref<number | null>(null)
const selectedCodes = ref<string[]>([])
const isLoading = ref(false)
const isSaving = ref(false)

const dialogVisible = ref(false)
const editingRole = ref<OrgRole | null>(null)
const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive({
  role_name: '',
  role_code: '',
  description: '',
})

const rules: FormRules = {
  role_name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  role_code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: '仅小写字母、数字与下划线', trigger: 'blur' },
  ],
}

const selectedRole = computed(
  () => roles.value.find((role) => role.id === selectedRoleId.value) ?? null,
)

const groups = computed(() => {
  const order = ['工作台', '知识维护', 'AI 工作台', '知识沉淀', '组织权限']
  const map = new Map<string, PermissionCatalogItem[]>()
  for (const item of catalog.value) {
    const list = map.get(item.module) ?? []
    list.push(item)
    map.set(item.module, list)
  }
  return [...map.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([module, items]) => ({
      module,
      items,
      codes: items.map((item) => item.code),
    }))
})

function groupChecked(codes: string[]): boolean {
  return codes.every((code) => selectedCodes.value.includes(code))
}

function groupIndeterminate(codes: string[]): boolean {
  const selected = codes.filter((code) => selectedCodes.value.includes(code)).length
  return selected > 0 && selected < codes.length
}

function toggleCode(code: string, checked: boolean): void {
  if (checked) {
    if (!selectedCodes.value.includes(code)) {
      selectedCodes.value.push(code)
    }
    return
  }
  selectedCodes.value = selectedCodes.value.filter((item) => item !== code)
}

function toggleGroup(codes: string[], checked: boolean): void {
  for (const code of codes) {
    toggleCode(code, checked)
  }
}

function selectRole(role: OrgRole): void {
  selectedRoleId.value = role.id
  selectedCodes.value = [...role.permission_codes]
}

async function load(): Promise<void> {
  isLoading.value = true
  try {
    const [roleList, permissionList] = await Promise.all([
      listRoles(),
      listPermissionCatalog(),
    ])
    roles.value = roleList
    catalog.value = permissionList
    const current = roleList.find((role) => role.id === selectedRoleId.value) ?? roleList[0]
    if (current) {
      selectRole(current)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '角色加载失败')
  } finally {
    isLoading.value = false
  }
}

function openCreate(): void {
  editingRole.value = null
  form.role_name = ''
  form.role_code = ''
  form.description = ''
  dialogVisible.value = true
}

function openEdit(role: OrgRole): void {
  editingRole.value = role
  form.role_name = role.role_name
  form.role_code = role.role_code
  form.description = role.description
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
    if (editingRole.value) {
      await updateRole(editingRole.value.id, {
        role_name: form.role_name.trim(),
        description: form.description,
      })
      ElMessage.success('角色已更新')
    } else {
      const role = await createRole({
        role_name: form.role_name.trim(),
        role_code: form.role_code.trim(),
        description: form.description,
      })
      selectedRoleId.value = role.id
      ElMessage.success('角色已创建')
    }
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function savePermissions(): Promise<void> {
  if (!selectedRole.value) {
    return
  }
  isSaving.value = true
  try {
    const role = await setRolePermissions(selectedRole.value.id, selectedCodes.value)
    const index = roles.value.findIndex((item) => item.id === role.id)
    if (index >= 0) {
      roles.value[index] = role
    }
    ElMessage.success(`已保存 ${role.permission_codes.length} 项权限`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '权限保存失败')
  } finally {
    isSaving.value = false
  }
}

async function remove(role: OrgRole): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除角色「${role.role_name}」？`, '删除角色', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteRole(role.id)
    ElMessage.success('角色已删除')
    if (selectedRoleId.value === role.id) {
      selectedRoleId.value = null
    }
    await load()
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="roles-page">
    <header class="page-head">
      <div class="title-block">
        <h1 class="kb-page-title">角色管理</h1>
        <p class="kb-page-subtitle">配置菜单与操作权限；角色权限变更后立即生效</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建角色</el-button>
    </header>

    <div class="roles-body" v-loading="isLoading">
      <aside class="role-list kb-card">
        <h3>角色列表</h3>
        <button
          v-for="role in roles"
          :key="role.id"
          type="button"
          class="role-item"
          :class="{ 'is-active': role.id === selectedRoleId }"
          @click="selectRole(role)"
        >
          <span class="role-main">
            <span class="role-name">{{ role.role_name }}</span>
            <span class="role-code">{{ role.role_code }}</span>
          </span>
          <span class="role-count">{{ role.user_count }} 人</span>
        </button>
        <p class="role-hint">内置角色 system_admin 不可删除</p>
      </aside>

      <section class="permission-panel kb-card" v-if="selectedRole">
        <header class="panel-head">
          <div class="panel-title">
            <div class="title-row">
              <h2>{{ selectedRole.role_name }}</h2>
              <span class="code-chip">{{ selectedRole.role_code }}</span>
            </div>
            <p>{{ selectedRole.description || '暂无描述' }}</p>
          </div>
          <div class="panel-actions">
            <el-button size="small" @click="openEdit(selectedRole)">编辑</el-button>
            <el-button
              size="small"
              type="danger"
              plain
              :disabled="selectedRole.is_builtin"
              @click="remove(selectedRole)"
            >
              删除
            </el-button>
            <el-button size="small" type="primary" :loading="isSaving" @click="savePermissions">
              保存权限
            </el-button>
          </div>
        </header>

        <p class="panel-hint">
          菜单权限控制导航可见性；操作权限控制按钮与接口。勾选后写入 <code>role_permissions</code>。
        </p>

        <div class="permission-groups">
          <section v-for="group in groups" :key="group.module" class="permission-group">
            <div class="group-head">
              <strong>{{ group.module }}</strong>
              <el-checkbox
                :model-value="groupChecked(group.codes)"
                :indeterminate="groupIndeterminate(group.codes)"
                @change="(checked: boolean | string | number) => toggleGroup(group.codes, Boolean(checked))"
              >
                全选
              </el-checkbox>
            </div>
            <div class="group-items">
              <label v-for="item in group.items" :key="item.code" class="permission-item">
                <el-checkbox
                  :model-value="selectedCodes.includes(item.code)"
                  @change="(checked: boolean | string | number) => toggleCode(item.code, Boolean(checked))"
                />
                <span class="item-name">{{ item.name }}</span>
                <span class="item-code">{{ item.code }}</span>
                <span class="item-type" :class="item.type">
                  {{ item.type === 'menu' ? '菜单' : '操作' }}
                </span>
              </label>
            </div>
          </section>
        </div>

        <footer class="panel-footer">
          <span>已选 {{ selectedCodes.length }} / {{ catalog.length }} 项</span>
          <el-button type="primary" size="small" :loading="isSaving" @click="savePermissions">
            保存权限
          </el-button>
        </footer>
      </section>

      <el-empty v-else class="role-empty" description="请选择一个角色" />
    </div>

    <p class="api-hint">
      GET /api/org/roles · GET /api/org/permissions · POST /api/org/roles/{id}/permissions
    </p>

    <el-dialog
      v-model="dialogVisible"
      :title="editingRole ? '编辑角色' : '新建角色'"
      width="480px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="角色名称" prop="role_name">
          <el-input v-model="form.role_name" placeholder="例如：审计员" />
        </el-form-item>
        <el-form-item label="角色编码" prop="role_code">
          <el-input v-model="form.role_code" :disabled="Boolean(editingRole)" placeholder="例如：auditor" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="角色职责说明" />
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
.roles-page {
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

.roles-body {
  display: flex;
  gap: 14px;
  align-items: stretch;
  min-height: calc(100vh - 62px - 56px - 100px);
}

.role-list {
  display: flex;
  width: 292px;
  flex: 0 0 292px;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.role-list h3 {
  margin: 0 0 2px;
  padding: 0 4px;
  font-size: 12.5px;
  font-weight: 600;
}

.role-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.role-item:hover {
  background: #f5f7fb;
}

.role-item.is-active {
  background: var(--kb-primary-soft);
}

.role-main {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.role-name {
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
}

.role-item.is-active .role-name {
  color: var(--kb-primary);
  font-weight: 600;
}

.role-code {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.role-count {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.role-hint {
  margin: auto 0 0;
  padding: 4px;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.permission-panel {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.title-row h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.code-chip {
  padding: 2px 6px;
  border-radius: 4px;
  background: #f2f4f7;
  color: var(--kb-text-2);
  font-family: var(--kb-font-num);
  font-size: 9px;
}

.panel-title p {
  margin: 3px 0 0;
  color: var(--kb-text-3);
  font-size: 10.5px;
}

.panel-actions {
  display: flex;
  gap: 6px;
}

.panel-hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 10px;
  line-height: 1.6;
}

.panel-hint code {
  padding: 1px 4px;
  border-radius: 4px;
  background: #f2f4f7;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}

.permission-groups {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 22px;
  overflow-y: auto;
}

.permission-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--kb-border);
}

.group-head strong {
  font-size: 11.5px;
  font-weight: 600;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.permission-item {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
}

.item-name {
  color: var(--kb-text-2);
  font-size: 10.5px;
}

.item-code {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 8.5px;
}

.item-type {
  margin-left: auto;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 8.5px;
}

.item-type.menu {
  background: var(--kb-purple-soft);
  color: var(--kb-purple);
}

.item-type.action {
  background: #f2f4f7;
  color: var(--kb-text-3);
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--kb-border);
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.role-empty {
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
</style>
