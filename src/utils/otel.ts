import { opentelemetry } from '@elysiajs/opentelemetry'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { metrics, ValueType } from '@opentelemetry/api'

/**
 * Configure Prometheus Exporter for OpenTelemetry.
 * We set preventServerStart to true because we want to serve metrics
 * via a standard Elysia route (/metric).
 */
export const prometheusExporter = new PrometheusExporter({
  preventServerStart: true,
})

/**
 * Elysia OpenTelemetry Instrumentation Plugin
 */
export const instrumentation = opentelemetry({
  serviceName: 'ultimate-asepharyana-elysia',
  metricReader: prometheusExporter,
})

// Initialize Metering
const meter = metrics.getMeter('elysia-metrics')

export const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
})

export const requestDuration = meter.createHistogram('http_request_duration_seconds', {
  description: 'Duration of HTTP requests in seconds',
  unit: 's',
  valueType: ValueType.DOUBLE,
})

/**
 * Helper to expose metrics and return them as a string
 * compatible with Prometheus format.
 */
export const metricsHandler = async () => {
  return new Promise<string>((resolve, reject) => {
    prometheusExporter.collect().then((_result) => {
      // Mock Node.js response object
      const response = {
        _content: '',
        setHeader: () => {},
        writeHead: () => {},
        end(content: string) {
          this._content = content
          resolve(content)
        },
      }

      prometheusExporter.getMetricsRequestHandler({} as any, response as any)
    }).catch(reject)
  })
}
