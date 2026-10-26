import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import { setupRouterGuards } from '@/router/guards'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    redirect: '/chat',
    children: [
      {
        path: 'chat',
        name: 'chat',
        component: () => import('@/views/ChatView.vue'),
        meta: {
          title: 'AI 对话',
          menu: 'menu:chat',
          permission: 'ai:access',
          description: '多轮对话、SSE 流式回答、知识引用与权限缺失提示。',
          apiHint: 'POST /api/ai/chat/stream · GET /api/ai/sessions',
        },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: {
          title: '数据看板',
          menu: 'menu:dashboard',
          permission: 'dashboard:read',
          description: '访问量、UV、Token、响应时间、问题与知识单元排行。',
          apiHint: 'GET /api/dashboard/metrics · /rankings/questions · /rankings/units · /stats/tokens',
        },
      },
      {
        path: 'knowledge/import',
        name: 'knowledge-import',
        component: () => import('@/views/KnowledgeImportView.vue'),
        meta: {
          title: '知识导入',
          menu: 'menu:knowledge',
          permission: 'knowledge:import',
          description: '单文件、批量与目录导入，解析进度与失败重试。',
          apiHint: 'POST /api/knowledge/import · GET /api/knowledge/import/batches/{batch_id}',
        },
      },
      {
        path: 'knowledge/units',
        name: 'knowledge-units',
        component: () => import('@/views/KnowledgeUnitsView.vue'),
        meta: {
          title: '知识单元',
          menu: 'menu:knowledge',
          permission: 'knowledge:read',
          description: '知识单元列表、搜索筛选、数据权限摘要与状态管理。',
          apiHint: 'GET /api/knowledge/units · GET /api/knowledge/categories',
        },
      },
      {
        path: 'knowledge/units/:id',
        name: 'knowledge-unit-detail',
        component: () => import('@/views/UnitDetailView.vue'),
        meta: {
          title: '知识单元详情',
          menu: 'menu:knowledge',
          permission: 'knowledge:read',
          hidden: true,
          description: '正文编辑、版本历史、附件与四维数据权限配置。',
          apiHint:
            'GET /api/knowledge/units/{id} · POST /api/knowledge/units/{id}/permissions · POST /api/knowledge/units/{id}/reindex',
        },
      },
      {
        path: 'org/users',
        name: 'org-users',
        component: () => import('@/views/OrgUsersView.vue'),
        meta: {
          title: '用户管理',
          menu: 'menu:org',
          permission: 'user:read',
          description: '账号、部门归属、角色与启停用管理。',
          apiHint: 'GET/POST /api/org/users · PUT /api/org/users/{id} · POST /api/org/users/{id}/reset-password',
        },
      },
      {
        path: 'org/roles',
        name: 'org-roles',
        component: () => import('@/views/OrgRolesView.vue'),
        meta: {
          title: '角色管理',
          menu: 'menu:org',
          permission: 'role:read',
          description: '角色与菜单/操作权限树配置。',
          apiHint: 'GET /api/org/roles · POST /api/org/roles/{id}/permissions · GET /api/org/permissions',
        },
      },
      {
        path: 'org/departments',
        name: 'org-departments',
        component: () => import('@/views/OrgDepartmentsView.vue'),
        meta: {
          title: '部门管理',
          menu: 'menu:org',
          permission: 'dept:read',
          description: '部门树、负责人、成员与子部门管理。',
          apiHint: 'GET /api/org/departments · POST/PUT/DELETE /api/org/departments[/{id}]',
        },
      },
      {
        path: 'settlement/faqs',
        name: 'settlement-faqs',
        component: () => import('@/views/SettlementFaqsView.vue'),
        meta: {
          title: '知识沉淀',
          menu: 'menu:settlement',
          permission: 'settlement:read',
          description: '高频问题推荐、FAQ 审核发布与缓存状态。',
          apiHint: 'GET /api/settlement/faqs/recommendations · POST /api/settlement/faqs/{id}/review',
        },
      },
      {
        path: 'settlement/gaps',
        name: 'settlement-gaps',
        component: () => import('@/views/SettlementGapsView.vue'),
        meta: {
          title: '知识缺口',
          menu: 'menu:settlement',
          permission: 'settlement:read',
          description: '未命中问题聚类、提问频次与一键创建知识单元。',
          apiHint: 'GET /api/settlement/knowledge-gaps · POST /api/settlement/knowledge-gaps/{id}/create-unit',
        },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/ProfileView.vue'),
        meta: { title: '个人中心' },
      },
      {
        path: '403',
        name: 'forbidden',
        component: () => import('@/views/ForbiddenView.vue'),
        meta: { title: '无访问权限' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在', public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

setupRouterGuards(router)

export default router
