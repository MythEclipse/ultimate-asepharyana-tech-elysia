import type { Elysia } from 'elysia';
import { apiLogger } from '../utils/logger';

/**
 * Global error handler middleware
 * Aligned with Best Practice unified response structure
 */
export const errorHandler = (app: Elysia) =>
  app.onError(({ code, error, set }) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorStatus = (error as any)?.status || (error as any)?.code || (typeof code === 'number' ? code : undefined)

    apiLogger.error('ERROR', 'GLOBAL_HANDLER', {
      code,
      status: errorStatus,
      message: errorMessage,
      stack: process.env.NODE_ENV !== 'production' ? errorStack : undefined,
    });

    // Helper for unified error response
    const respond = (status: number, msg: string, errCode?: string) => {
      set.status = status
      return {
        success: false,
        message: msg,
        code: errCode || code,
      }
    }

    // 1. Handle explicit status codes first
    if (typeof errorStatus === 'number') {
      return respond(errorStatus, errorMessage, 'ERROR')
    }

    // 2. Handle built-in Elysia error codes
    switch (code) {
      case 'VALIDATION':
        return respond(400, 'Invalid request data', 'VALIDATION_ERROR')

      case 'NOT_FOUND':
        return respond(404, 'Resource not found', 'NOT_FOUND')

      case 'PARSE':
        return respond(400, 'Invalid request format', 'PARSE_ERROR')

      case 'INTERNAL_SERVER_ERROR':
        return respond(500, 'An unexpected error occurred', 'INTERNAL_ERROR')
    }

    // 3. Pattern matching for common error messages
    const lowerMsg = errorMessage.toLowerCase()
    
    if (lowerMsg.includes('unauthorized'))
      return respond(401, errorMessage, 'UNAUTHORIZED')

    if (lowerMsg.includes('forbidden'))
      return respond(403, errorMessage, 'FORBIDDEN')

    if (lowerMsg.includes('not found'))
      return respond(404, errorMessage, 'NOT_FOUND')

    if (lowerMsg.includes('already exists'))
      return respond(409, errorMessage, 'CONFLICT')

    if (lowerMsg.startsWith('invalid'))
      return respond(400, errorMessage, 'BAD_REQUEST')

    // 4. Fallback to generic 500
    return respond(
      500,
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : errorMessage,
      'INTERNAL_ERROR',
    )
  })
