<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'

import { useAuthStore } from '@/stores/auth'
import { getRememberedUsername, setRememberedUsername } from '@/utils/token'

interface DemoAccount {
  label: string
  username: string
  password: string
}

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const rememberedUsername = getRememberedUsername()
const formRef = ref<FormInstance>()
const errorMessage = ref('')
const form = reactive({
  username: rememberedUsername || 'km',
  password: '',
  remember: Boolean(rememberedUsername),
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const demoAccounts: DemoAccount[] = [
  { label: '系统管理员', username: 'admin', password: 'Admin@123' },
  { label: '知识管理员', username: 'km', password: 'Km@12345' },
  { label: '普通用户', username: 'alice', password: 'User@123' },
]

const features = [
  { icon: '◈', title: '四维数据权限', desc: '全局 / 部门 / 角色 / 个人任意匹配即放行' },
  { icon: '◎', title: '混合召回', desc: '向量 + BM25，未命中自动沉淀知识缺口' },
  { icon: '⚡', title: 'FAQ 缓存加速', desc: '高频问题审核发布后直接命中标准答案' },
]

function fillDemo(account: DemoAccount): void {
  form.username = account.username
  form.password = account.password
  errorMessage.value = ''
}

function handleForgot(): void {
  ElMessage.info('请联系系统管理员重置密码')
}

async function handleSubmit(): Promise<void> {
  if (!formRef.value) {
    return
  }
  const isValid = await formRef.value.validate().catch(() => false)
  if (!isValid) {
    return
  }

  errorMessage.value = ''
  try {
    const result = await auth.login({ username: form.username.trim(), password: form.password })
    setRememberedUsername(form.remember ? form.username.trim() : '')
    ElMessage.success(`欢迎回来，${result.user_info.display_name}`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/chat'
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败，请稍后重试'
  }
}
</script>

<template>
  <div class="login">
    <section class="brand-panel">
      <div class="brand">
        <div class="brand-logo">知</div>
        <div class="brand-text">
          <span class="brand-name">知识库平台</span>
          <span class="brand-sub">Knowledge OS</span>
        </div>
      </div>

      <div class="hero">
        <span class="eyebrow">企业知识库 · AI 鉴权检索</span>
        <h1>让每一条回答，<br />都有权限边界。</h1>
        <p>文档解析、知识单元、四维数据权限与 AI 问答一体化，回答只基于你被授权的内容。</p>

        <ul class="features">
          <li v-for="feature in features" :key="feature.title">
            <span class="feature-icon">{{ feature.icon }}</span>
            <span class="feature-text">
              <strong>{{ feature.title }}</strong>
              <span>{{ feature.desc }}</span>
            </span>
          </li>
        </ul>
      </div>

      <span class="copyright">© 2026 云启科技 · 知识库管理平台 v1.0</span>
    </section>

    <section class="form-panel">
      <div class="form-card">
        <header>
          <h2>欢迎回来</h2>
          <p>登录后进入 AI 工作台与知识维护</p>
        </header>

        <el-alert
          v-if="errorMessage"
          :title="errorMessage"
          type="error"
          show-icon
          :closable="false"
        />

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          size="large"
          @submit.prevent="handleSubmit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input v-model="form.username" placeholder="请输入用户名" :prefix-icon="User" autocomplete="username" />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              show-password
              autocomplete="current-password"
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <div class="options">
            <el-checkbox v-model="form.remember">记住我</el-checkbox>
            <button type="button" class="link" @click="handleForgot">忘记密码？</button>
          </div>

          <el-button
            class="submit"
            type="primary"
            native-type="submit"
            :loading="auth.isLoading"
            @click="handleSubmit"
          >
            登 录
          </el-button>
        </el-form>

        <div class="demo">
          <span class="demo-title">演示账号 · 点击填充</span>
          <button
            v-for="account in demoAccounts"
            :key="account.username"
            type="button"
            class="demo-item"
            @click="fillDemo(account)"
          >
            <span>{{ account.label }}</span>
            <code>{{ account.username }} / {{ account.password }}</code>
          </button>
        </div>

        <p class="legal">登录即表示同意《使用条款》与《隐私政策》</p>
        <p class="api-hint">POST /api/auth/login · GET /api/auth/me</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  min-height: 100vh;
  background: var(--kb-surface);
}

.brand-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 600px;
  flex: 0 0 600px;
  padding: 56px;
  background: var(--kb-sidebar);
  color: #f8fafc;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--kb-primary);
  font-size: 17px;
  font-weight: 700;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
}

.brand-sub {
  color: #64748b;
  font-family: var(--kb-font-num);
  font-size: 9.5px;
  letter-spacing: 1.2px;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 420px;
}

.eyebrow {
  color: #60a5fa;
  font-size: 11.5px;
  letter-spacing: 1.4px;
}

.hero h1 {
  margin: 0;
  font-size: 38px;
  font-weight: 600;
  line-height: 1.28;
}

.hero p {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.75;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.features li {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 8px;
  background: #16213a;
  color: #60a5fa;
  font-size: 14px;
}

.feature-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.feature-text strong {
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 500;
}

.feature-text span {
  color: #64748b;
  font-size: 11.5px;
}

.copyright {
  color: #475569;
  font-size: 11px;
}

.form-panel {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 392px;
}

header h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
}

header p {
  margin: 6px 0 0;
  color: var(--kb-text-2);
  font-size: 13px;
}

.options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 18px;
}

.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kb-primary);
  font-size: 12px;
  cursor: pointer;
}

.submit {
  width: 100%;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
}

.demo {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border-radius: 8px;
  background: var(--kb-primary-soft);
}

.demo-title {
  color: var(--kb-primary);
  font-size: 11.5px;
  font-weight: 600;
}

.demo-item {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: #1e40af;
  font-size: 11.5px;
  cursor: pointer;
  text-align: left;
}

.demo-item:hover {
  text-decoration: underline;
}

.demo-item code {
  color: #1e40af;
  font-family: var(--kb-font-num);
  font-size: 11px;
}

.legal,
.api-hint {
  margin: 0;
  color: var(--kb-text-3);
  font-size: 11px;
  text-align: center;
}

.api-hint {
  color: #cbd5e1;
  font-family: var(--kb-font-num);
  font-size: 10.5px;
}

@media (max-width: 1000px) {
  .brand-panel {
    display: none;
  }
}
</style>
