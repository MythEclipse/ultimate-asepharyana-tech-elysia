/**
 * Standardized API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  }
}

/**
 * Error response helper
 */
export function errorResponse(code: string, message: string, details?: Record<string, unknown>): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && process.env.NODE_ENV === 'development' && { details }),
    },
  }
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

export function getPagination(params: PaginationParams) {
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 10))
  const skip = (page - 1) * limit

  return { page, limit, skip }
}

export function createPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  }
}
