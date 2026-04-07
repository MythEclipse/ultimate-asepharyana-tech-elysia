import { swagger } from '@elysiajs/swagger'
import Elysia from 'elysia'
import { config } from './config'
import { auth } from './modules/auth'
import { system } from './modules/system'
import { closeDb, initializeDb } from './db'
import { getRedis } from './utils/redis'
import { systemLogger } from './utils/logger'

import { logger } from './middleware'
import { errorHandler } from './middleware/errorHandler'
import { rateLimit } from './middleware/rateLimit'
import cors from '@elysiajs/cors'
import { register } from './utils/prometheus'
import jwt from '@elysiajs/jwt'

let isDbInitialized = false

/**
 * Initialize database and Redis connections
 */
export async function initializeConnections() {
  try {
    // Connect to database
    if (!isDbInitialized) {
      initializeDb(config.databaseUrl)
      isDbInitialized = true
      systemLogger.info('Database connected successfully')
    }

    // Connect to Redis
    const redis = getRedis()
    await redis.connect()
  }
  catch (error) {
    systemLogger.error('Failed to initialize connections', error)
    throw error // Re-throw to prevent server startup on critical failure
  }
}

/**
 * Main Elysia Application Instance
 */
export const app = new Elysia()
  .onRequest(({ request }) => {
    // Store request start time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(request as any).startTime = performance.now()
  })
  .onAfterResponse(({ request, path, set }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startTime = (request as any).startTime
    if (startTime) {
      const duration = (performance.now() - startTime) / 1000
      const route = path || 'unknown'
      const status = set.status || 200

      // Record metrics
      // @ts-expect-error - Custom metrics registry
      register.getSingleMetric('elysia_http_requests_total')?.inc({
        method: request.method,
        route,
        status_code: status,
      })

      // @ts-expect-error - Custom metrics registry
      register.getSingleMetric('elysia_http_request_duration_seconds')?.observe(
        {
          method: request.method,
          route,
          status_code: status,
        },
        duration,
      )
    }
  })
  .get('/metrics', async () => {
    return new Response(await register.metrics(), {
      headers: {
        'Content-Type': register.contentType,
      },
    })
  })
  .use(system)
  .use(errorHandler)
  .use(
    rateLimit({
      max: 100,
      window: 60 * 1000,
    }),
  )
  .use(
    cors({
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    }),
  )
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'ElysiaJS Auth API Documentation',
          version: '1.0.0',
          description:
            'API documentation for ElysiaJS authentication service with Redis caching',
        },
        tags: [
          { name: 'Health', description: 'Health check endpoints' },
          { name: 'Auth', description: 'Authentication endpoints' },
        ],
        servers: [
          {
            url: 'https://elysia.asepharyana.tech',
            description: 'Production server',
          },
          {
            url: `http://localhost:${config.port}`,
            description: 'Development server',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Enter your JWT token',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    }),
  )
  .use(
    jwt({
      name: 'jwt',
      secret: config.jwtSecret,
    }),
  )
  .use(logger)
  .get('/', () => ({
    message: 'Welcome to ElysiaJS Auth API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      health: '/health',
      metrics: '/metrics',
    },
  }))
  .use(auth)

/**
 * Starts the server instance
 */
export async function startServer() {
  await initializeConnections()

  const host = process.env.HOST || '0.0.0.0'
  app.listen({
    port: config.port,
    hostname: host,
  })
}

/**
 * Handle graceful shutdown
 */
export async function shutdown() {
  systemLogger.info('Shutting down server gracefully...')
  try {
    await closeDb()
  }
  catch (error) {
    systemLogger.error('Error during database closure', error)
  }
}
