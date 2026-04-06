import type { Elysia } from 'elysia'

/**
 * Global error handler middleware
 * Aligned with Best Practice unified response structure
 */
export const errorHandler = (app: Elysia) =>
  app.onError(({ code, error, set }) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error('Error:', {
      code,
      message: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    })

    // Helper for unified error response
    const respond = (status: number, msg: string, errCode?: string) => {
      set.status = status
      return {
        success: false,
        message: msg,
        code: errCode || code,
      }
    }

    // Handle different error types
    switch (code) {
      case 'VALIDATION':
        return respond(400, 'Invalid request data', 'VALIDATION_ERROR')

      case 'NOT_FOUND':
        return respond(404, 'Resource not found', 'NOT_FOUND')

      case 'PARSE':
        return respond(400, 'Invalid request format', 'PARSE_ERROR')

      case 'INTERNAL_SERVER_ERROR':
        return respond(500, 'An unexpected error occurred', 'INTERNAL_ERROR')

      case 'UNKNOWN':
      default:
        // Handle custom domain errors from strings
        if (errorMessage.startsWith('Unauthorized'))
          return respond(401, errorMessage, 'UNAUTHORIZED')

        if (errorMessage.startsWith('Forbidden'))
          return respond(403, errorMessage, 'FORBIDDEN')

        if (errorMessage.includes('not found'))
          return respond(404, errorMessage, 'NOT_FOUND')

        if (errorMessage.includes('already exists'))
          return respond(409, errorMessage, 'CONFLICT')

        if (errorMessage.startsWith('Invalid'))
          return respond(400, errorMessage, 'BAD_REQUEST')

        // Default internal error
        return respond(
          500,
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : errorMessage,
          'INTERNAL_ERROR',
        )
    }
  })
