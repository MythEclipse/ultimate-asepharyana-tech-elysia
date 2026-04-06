import { t } from 'elysia'
import type { UnwrapSchema } from 'elysia'

export const SystemModel = {
  healthResponse: t.Object({
    status: t.String(),
    timestamp: t.String(),
    environment: t.String(),
    database: t.String(),
  }),

  metricsResponse: t.String({
    description: 'Prometheus metrics in text format',
  }),
} as const

export type TSystemModel = {
  [K in keyof typeof SystemModel]: UnwrapSchema<typeof SystemModel[K]>
}
