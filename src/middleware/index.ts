import { Elysia } from 'elysia'
import { apiLogger } from '../utils/logger'

export const logger = new Elysia()
  .onBeforeHandle(({ request }) => {
    const method = request.method
    const url = new URL(request.url)
    apiLogger.request(method, url.pathname)
  })
  .onAfterHandle(({ request, set }) => {
    const method = request.method
    const url = new URL(request.url)
    const status = typeof set.status === 'number' ? set.status : 200
    apiLogger.response(method, url.pathname, status)
  })
