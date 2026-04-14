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

const uploadRateLimitStore = new Map<string, { count: number; resetTime: number }>()
const UPLOAD_RATE_LIMIT_MAX = 5
const UPLOAD_RATE_LIMIT_WINDOW = 60 * 1000
import { httpRequestDurationSeconds, httpRequestsTotal, registry } from './utils/prometheus'
import jwt from '@elysiajs/jwt'

let isDbInitialized = false
const requestStartTime = new WeakMap<Request, number>()

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
    requestStartTime.set(request, performance.now())
  })
  .onAfterResponse(({ request, path, set }) => {
    const startTime = requestStartTime.get(request)
    requestStartTime.delete(request)
    if (startTime) {
      const duration = (performance.now() - startTime) / 1000
      const route = path || 'unknown'
      const status = set.status || 200

      // Record metrics
      httpRequestsTotal.inc({
        method: request.method,
        route,
        status_code: status,
      })

      httpRequestDurationSeconds.observe(
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
    return new Response(await registry.metrics(), {
      headers: {
        'Content-Type': registry.contentType,
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
          { name: 'Upload', description: 'Image upload endpoints' },
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
      upload: '/api/upload',
    },
  }))
  .use(auth)
  /**
   * Proxy image upload requests to picser-two upload service.
   * Accepts multipart/form-data with field `file`.
   * Validates file size and permitted image types, forwards extra fields,
   * and protects the endpoint with a per-IP upload rate limit.
   */
  .post('/api/upload', async ({ request }) => {
    const contentType = request.headers.get('content-type') ?? ''

    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be multipart/form-data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const uploadKey = `upload:${ip}`
    const now = Date.now()
    const uploadRecord = uploadRateLimitStore.get(uploadKey)

    if (!uploadRecord || now > uploadRecord.resetTime) {
      uploadRateLimitStore.set(uploadKey, {
        count: 1,
        resetTime: now + UPLOAD_RATE_LIMIT_WINDOW,
      })
    }
    else {
      if (uploadRecord.count >= UPLOAD_RATE_LIMIT_MAX) {
        return new Response(JSON.stringify({ error: 'Too many upload requests, please try again later' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      uploadRecord.count++
    }

    const formData = await request.formData()
    const isFile = (value: FormDataEntryValue): value is File =>
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      'size' in value &&
      'type' in value &&
      typeof (value as any).arrayBuffer === 'function'

    const fileEntries = formData.getAll('file').filter(isFile)

    if (fileEntries.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing file field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (fileEntries.length > 1) {
      return new Response(JSON.stringify({ error: 'Only one file may be uploaded at a time' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const file = fileEntries[0]

    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File size must be 10MB or smaller' }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    if (!allowedTypes.has(file.type)) {
      return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const uploadForm = new FormData()
    for (const [key, value] of formData.entries()) {
      if (isFile(value)) {
        uploadForm.append(key, value, value.name || 'file')
      }
      else {
        uploadForm.append(key, String(value))
      }
    }

    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), 15_000)

    let externalResponse: Response
    try {
      externalResponse = await fetch('https://picser-two.vercel.app/api/upload', {
        method: 'POST',
        body: uploadForm,
        headers: {
          Accept: 'application/json',
        },
        signal: abortController.signal,
      })
    }
    catch {
      return new Response(JSON.stringify({ error: 'External upload service unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    finally {
      clearTimeout(timeout)
    }

    const externalContentType = externalResponse.headers.get('content-type') ?? 'application/octet-stream'
    const body = externalContentType.includes('application/json')
      ? await externalResponse.text()
      : await externalResponse.arrayBuffer()

    if (!externalResponse.ok) {
      return new Response(body, {
        status: externalResponse.status,
        headers: { 'Content-Type': externalContentType },
      })
    }

    return new Response(body, {
      status: externalResponse.status,
      headers: { 'Content-Type': externalContentType },
    })
  }, {
    detail: {
      summary: 'Upload an image file',
      description: 'Public uploader endpoint that forwards a single image file to the picser-two upload service. Request must use multipart/form-data with a field named `file` containing the image.',
      tags: ['Upload'],
    },
  })

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
