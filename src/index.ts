import { swagger } from '@elysiajs/swagger'
import Elysia from 'elysia'
import { config } from './config'
import { auth } from './modules/auth'
import { system } from './modules/system'
import { closeDb, initializeDb } from './db'
import { getRedis } from './utils/redis'

import { logger } from './middleware'
import { errorHandler } from './middleware/errorHandler'
import { rateLimit } from './middleware/rateLimit'
import cors from '@elysiajs/cors'
import jwt from '@elysiajs/jwt'

let isDbInitialized = false

// Initialize database and Redis connectionsa
async function initializeConnections() {
  try {
    // Connect to database
    if (!isDbInitialized) {
      initializeDb(config.databaseUrl)
      isDbInitialized = true
      console.log('✅ Database connected successfully')
    }

    // Connect to Redis
    const redis = getRedis()
    await redis.connect()
  }
  catch (error) {
    console.error('Failed to initialize connections:', error)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await closeDb()
  process.exit(0)
})

export const app = new Elysia()
  .use(system)
  .use(errorHandler) // Global error handling
  .use(
    rateLimit({
      // Global rate limit: 100 requests per minute
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
    },
  }))
  .use(auth)

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully...')
  try {
    await closeDb()
    process.exit(0)
  }
  catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
})

// Start the server
initializeConnections().then(() => {
  const host = process.env.HOST || '0.0.0.0'
  app.listen({
    port: config.port,
    hostname: host,
  })

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  )
  console.log(`📝 Environment: ${config.env}`)
  console.log(
    `🔐 Auth endpoints: http://${app.server?.hostname}:${app.server?.port}/api/auth`,
  )
  console.log(
    `📚 Swagger docs: http://${app.server?.hostname}:${app.server?.port}/docs`,
  )
})
