import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client'

/**
 * Singleton Prometheus registry.
 *
 * Using a single Registry instance is critical — prom-client throws at registration
 * time if the same metric name is registered twice (e.g., in dev hot-reload scenarios
 * without a singleton guard).
 */
const registry = new Registry()

registry.setDefaultLabels({
  app: 'elysia-api',
  environment: process.env.NODE_ENV ?? 'development',
})

collectDefaultMetrics({
  register: registry,
  // GC, event loop lag, heap stats, etc.
  prefix: 'elysia_',
})

/**
 * Total HTTP request counter.
 * Labels: method, route, status_code
 *
 * route is the normalised path pattern (e.g. /api/auth/login), NOT the raw URL,
 * so cardinality stays bounded even with millions of unique URLs.
 */
export const httpRequestsTotal = new Counter({
  name: 'elysia_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
})

/**
 * HTTP request latency histogram.
 * Buckets tuned for a typical API: sub-ms to 10 seconds.
 */
export const httpRequestDurationSeconds = new Histogram({
  name: 'elysia_http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
})

export { registry }
