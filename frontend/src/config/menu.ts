import type { Component } from 'vue'
import {
  Avatar,
  ChatDotRound,
  Collection,
  DataLine,
  MagicStick,
  OfficeBuilding,
  UploadFilled,
  UserFilled,
} from '@element-plus/icons-vue'

export interface MenuItem {
  label: string
  path: string
  icon: Component
  menu: string
}

export interface MenuGroup {
  label: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    label: '工作台',
    items: [
      { label: 'AI 对话', path: '/chat', icon: ChatDotRound, menu: 'menu:chat' },
      { label: '数据看板', path: '/dashboard', icon: DataLine, menu: 'menu:dashboard' },
    ],
  },
  {
    label: '知识管理',
    items: [
      { label: '知识导入', path: '/knowledge/import', icon: UploadFilled, menu: 'menu:knowledge' },
      { label: '知识单元', path: '/knowledge/units', icon: Collection, menu: 'menu:knowledge' },
      { label: '知识沉淀', path: '/settlement/faqs', icon: MagicStick, menu: 'menu:settlement' },
    ],
  },
  {
    label: '系统管理',
    items: [
      { label: '用户管理', path: '/org/users', icon: UserFilled, menu: 'menu:org' },
      { label: '角色管理', path: '/org/roles', icon: Avatar, menu: 'menu:org' },
      { label: '部门管理', path: '/org/departments', icon: OfficeBuilding, menu: 'menu:org' },
    ],
  },
]
