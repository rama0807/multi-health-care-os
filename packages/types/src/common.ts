export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ResponseMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ResponseMeta {
  requestId: string
  timestamp: string
}

export interface PaginationQuery {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

export interface DateRangeQuery {
  from?: string
  to?: string
}

export type ID = string

export interface AuditableEntity {
  createdAt: Date
  updatedAt: Date
}

export interface SoftDeletableEntity extends AuditableEntity {
  deletedAt: Date | null
}

export interface TenantEntity {
  organizationId: string
}
