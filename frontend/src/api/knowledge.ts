import { http } from '@/api/http'
import type {
  CategoryItem,
  ImportBatch,
  KnowledgeUnit,
  Paginated,
  PermissionPayload,
  UnitCreatePayload,
  UnitPermission,
  UnitQuery,
  UnitUpdatePayload,
  UnitVersion,
} from '@/types/knowledge'

export function listCategories(): Promise<CategoryItem[]> {
  return http
    .get<{ items: CategoryItem[] }>('/api/knowledge/categories')
    .then((response) => response.data.items)
}

export function listUnits(query: UnitQuery): Promise<Paginated<KnowledgeUnit>> {
  return http
    .get<Paginated<KnowledgeUnit>>('/api/knowledge/units', { params: query })
    .then((response) => response.data)
}

export function getUnit(id: number): Promise<KnowledgeUnit> {
  return http
    .get<KnowledgeUnit>(`/api/knowledge/units/${id}`)
    .then((response) => response.data)
}

export function updateUnit(id: number, payload: UnitUpdatePayload): Promise<KnowledgeUnit> {
  return http
    .put<KnowledgeUnit>(`/api/knowledge/units/${id}`, payload)
    .then((response) => response.data)
}

export function createUnit(payload: UnitCreatePayload): Promise<KnowledgeUnit> {
  return http
    .post<KnowledgeUnit>('/api/knowledge/units', payload)
    .then((response) => response.data)
}

export function deleteUnits(ids: number[]): Promise<number> {
  return http
    .delete<{ deleted: number }>('/api/knowledge/units', { data: { ids } })
    .then((response) => response.data.deleted)
}

export function listUnitPermissions(id: number): Promise<UnitPermission[]> {
  return http
    .get<{ items: UnitPermission[] }>(`/api/knowledge/units/${id}/permissions`)
    .then((response) => response.data.items)
}

export function setUnitPermissions(
  id: number,
  permissions: PermissionPayload[],
): Promise<UnitPermission[]> {
  return http
    .post<{ items: UnitPermission[] }>(`/api/knowledge/units/${id}/permissions`, { permissions })
    .then((response) => response.data.items)
}

export function listVersions(id: number): Promise<UnitVersion[]> {
  return http
    .get<{ items: UnitVersion[] }>(`/api/knowledge/units/${id}/versions`)
    .then((response) => response.data.items)
}

export function rollbackUnit(id: number, version: number): Promise<KnowledgeUnit> {
  return http
    .post<KnowledgeUnit>(`/api/knowledge/units/${id}/versions/${version}/rollback`)
    .then((response) => response.data)
}

export function reindexUnit(id: number): Promise<KnowledgeUnit> {
  return http
    .post<KnowledgeUnit>(`/api/knowledge/units/${id}/reindex`)
    .then((response) => response.data)
}

export function importFiles(
  files: File[],
  category: string,
  tags: string,
): Promise<ImportBatch> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  form.append('category', category)
  form.append('tags', tags)
  return http
    .post<ImportBatch>('/api/knowledge/import', form, { timeout: 60_000 })
    .then((response) => response.data)
}

export function getImportBatch(batchId: string): Promise<ImportBatch> {
  return http
    .get<ImportBatch>(`/api/knowledge/import/batches/${batchId}`)
    .then((response) => response.data)
}

export function retryImportTask(taskId: string): Promise<void> {
  return http
    .post(`/api/knowledge/import/tasks/${taskId}/retry`)
    .then(() => undefined)
}
