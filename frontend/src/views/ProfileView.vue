<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Lock } from '@element-plus/icons-vue'

import { changePassword } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const user = computed(() => auth.user)
const roles = computed(() => user.value?.roles ?? [])
const menuCount = computed(() => auth.permissions.filter((code) => code.startsWith('menu:')).length)
const actionCount = computed(
  () => auth.permissions.filter((code) => !code.startsWith('menu:')).length,
)
const avatarChar = computed(() => (user.value?.display_name ?? '未').slice(0, 1))

const formRef = ref<FormInstance>()
const isSubmitting = ref(false)
const form = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
})

const rules: FormRules = {
  old_password: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '新密码至少 8 位', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value !== form.new_password) {
          callback(new Error('两次输入的密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) {
    return
  }
  const isValid = await formRef.value.validate().catch(() => false)
  if (!isValid) {
    return
  }

  isSubmitting.value = true
  try {
    await changePassword({
      old_password: form.old_password,
      new_password: form.new_password,
    })
    ElMessage.success('密码已修改，请重新登录')
    await auth.logout()
    await router.push('/login')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '修改失败')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="profile">
    <header class="profile-head">
      <h1 class="kb-page-title">个人中心</h1>
      <p class="kb-page-subtitle">查看身份、部门与角色，修改登录密码</p>
    </header>

    <div class="profile-body">
      <section class="identity kb-card">
        <div class="avatar">{{ avatarChar }}</div>
        <div class="name-block">
          <strong>{{ user?.display_name ?? '—' }}</strong>
          <span>@{{ user?.username ?? '—' }} · {{ user?.department?.name ?? '未分配部门' }}</span>
        </div>
        <div class="role-chips">
          <el-tag v-for="role in roles" :key="role.id" size="small" effect="light">
            {{ role.role_name }}
          </el-tag>
        </div>

        <dl class="meta">
          <div>
            <dt>账号状态</dt>
            <dd>{{ user?.status === 'active' ? '启用' : '停用' }}</dd>
          </div>
          <div>
            <dt>所属部门</dt>
            <dd>{{ user?.department?.name ?? '—' }}</dd>
          </div>
          <div>
            <dt>菜单权限</dt>
            <dd>{{ menuCount }} 项</dd>
          </div>
          <div>
            <dt>操作权限</dt>
            <dd>{{ actionCount }} 项</dd>
          </div>
        </dl>

        <p class="hint">部门与角色由管理员维护；如需调整请联系系统管理员。</p>
      </section>

      <section class="settings">
        <div class="kb-card password-card">
          <header>
            <strong>修改密码</strong>
            <p>修改后当前 refresh token 会被吊销，需要重新登录其他设备。</p>
          </header>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            @submit.prevent="handleSubmit"
          >
            <el-form-item label="原密码" prop="old_password">
              <el-input v-model="form.old_password" type="password" show-password :prefix-icon="Lock" placeholder="请输入当前密码" />
            </el-form-item>
            <div class="password-grid">
              <el-form-item label="新密码" prop="new_password">
                <el-input v-model="form.new_password" type="password" show-password :prefix-icon="Lock" placeholder="至少 8 位" />
              </el-form-item>
              <el-form-item label="确认新密码" prop="confirm_password">
                <el-input v-model="form.confirm_password" type="password" show-password :prefix-icon="Lock" placeholder="再次输入新密码" />
              </el-form-item>
            </div>
            <el-button type="primary" :loading="isSubmitting" @click="handleSubmit">
              保存修改
            </el-button>
          </el-form>
        </div>

        <div class="kb-card permission-card">
          <strong>权限概览</strong>
          <div class="permission-grid">
            <div>
              <span>AI 访问</span>
              <b class="text-success">{{ auth.hasPermission('ai:access') ? '已开通' : '未开通' }}</b>
            </div>
            <div>
              <span>知识维护</span>
              <b>{{ auth.hasPermission('knowledge:update') ? '可编辑' : '只读/无权限' }}</b>
            </div>
            <div>
              <span>数据权限</span>
              <b>按单元 ACL</b>
            </div>
          </div>
          <p class="hint">
            管理员角色不会绕过 AI 数据权限；问答只召回当前账号被授权的知识单元。
          </p>
        </div>
      </section>
    </div>

    <p class="api-hint">GET /api/auth/me · PUT /api/auth/password · POST /api/auth/logout</p>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.profile-body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 360px;
  flex: 0 0 360px;
  padding: 20px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  background: #1d4ed8;
  color: #fff;
  font-size: 28px;
  font-weight: 600;
}

.name-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-block strong {
  font-size: 18px;
  font-weight: 600;
}

.name-block span {
  color: var(--kb-text-3);
  font-family: var(--kb-font-num);
  font-size: 11px;
}

.role-chips {
  display: flex;
  gap: 6px;
}

.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
  padding-top: 14px;
  border-top: 1px solid var(--kb-border);
}

.meta dt {
  margin-bottom: 2px;
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.meta dd {
  margin: 0;
  color: var(--kb-text-2);
  font-size: 11.5px;
}

.hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 9.5px;
  line-height: 1.6;
}

.settings {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.password-card,
.permission-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.password-card header strong,
.permission-card strong {
  font-size: 13px;
  font-weight: 600;
}

.password-card header p {
  margin: 4px 0 0;
  color: var(--kb-text-3);
  font-size: 10px;
}

.password-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.permission-grid div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px;
  border-radius: 8px;
  background: #f9fafb;
}

.permission-grid span {
  color: var(--kb-text-3);
  font-size: 9.5px;
}

.permission-grid b {
  color: var(--kb-text);
  font-size: 11.5px;
  font-weight: 500;
}

.text-success {
  color: var(--kb-success);
}

.api-hint {
  margin: 0;
  color: #b8c2d3;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
}
</style>
