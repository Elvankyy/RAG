export type PermissionTargetType = 'global' | 'department' | 'role' | 'user'

export interface UnitPermission {
  id: number
  target_type: PermissionTargetType
  target_id: number | null
  target_name: string
}

export interface KnowledgeUnit {
  id: number
  unit_code: string
  title: string
  content: string
  summary: string
  category: string
  source_file_name: string
  file_type: string
  file_size: number
  status: 'active' | 'disabled'
  creator_id: number
  creator_name: string
  tags: string
  version: number
  chunk_count: number
  index_status: 'synced' | 'syncing' | 'failed'
  permissions: UnitPermission[]
  permission_summary: string
  created_at: string
  updated_at: string
}

export interface CategoryItem {
  name: string
  count: number
}

export interface UnitVersion {
  version: number
  title: string
  summary: string
  editor_name: string
  created_at: string
  is_current: boolean
}

export interface UnitQuery {
  keyword?: string
  category?: string
  status?: string
  page: number
  page_size: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface UnitUpdatePayload {
  title?: string
  content?: string
  category?: string
  tags?: string
  status?: 'active' | 'disabled'
}

export interface UnitCreatePayload {
  title: string
  content: string
  category: string
  tags?: string
  permissions?: Array<{ target_type: PermissionTargetType; target_id: number | null }>
}

export interface PermissionPayload {
  target_type: PermissionTargetType
  target_id: number | null
}

export type ImportTaskStatus =
  | 'pending'
  | 'parsing'
  | 'splitting'
  | 'embedding'
  | 'indexing'
  | 'success'
  | 'failed'

export interface ImportTask {
  id: string
  file_name: string
  file_type: string
  file_size: number
  status: ImportTaskStatus
  progress: number
  message?: string
  unit_id?: number
  unit_code?: string
}

export interface ImportBatch {
  id: string
  status: 'processing' | 'success' | 'partial' | 'failed'
  total: number
  success_count: number
  failed_count: number
  created_at: string
  tasks: ImportTask[]
}
