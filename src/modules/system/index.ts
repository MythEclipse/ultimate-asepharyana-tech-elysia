import cron from '@elysiajs/cron'
import serverTiming from '@elysiajs/server-timing'
import { Elysia } from 'elysia'
import { config } from '../../config'
import { instrumentation, metricsHandler, requestCounter, requestDuration } from '../../utils/otel'
import { SystemService } from './service'

export const system = new Elysia({ name: 'system' })
  .use(serverTiming())
  .use(instrumentation)
  .use(
    cron({
      name: 'maintenance',
      pattern: '0 * * * *', // Every hour
      async run() {
        await SystemService.performMaintenance()
      },
    }),
  )
  .derive({ as: 'global' }, () => ({
    startTime: performance.now(),
  }))
  .onAfterResponse({ as: 'global' }, ({ request, path, set, startTime }) => {
    const duration = (performance.now() - startTime) / 1000
    const method = request.method
    const status = String(set.status || 200)

    requestCounter.add(1, { method, path, status })
    requestDuration.record(duration, { method, path, status })
  })
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
    database: config.databaseUrl ? 'connected' : 'not configured',
  }), {
    detail: {
      summary: 'System health check',
      tags: ['System'],
    },
  })
  .get('/metric', async () => {
    return await metricsHandler()
  }, {
    detail: {
      summary: 'Prometheus metrics',
      tags: ['System'],
    },
  })
