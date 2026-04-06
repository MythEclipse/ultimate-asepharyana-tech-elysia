import { describe, expect, it } from 'bun:test'
import { app } from './index'

describe('Elysia Server', () => {
  it('should return welcome message', async () => {
    const response = await app
      .handle(new Request('http://localhost/'))
      .then(res => res.json())
    
    expect(response).toHaveProperty('message', 'Welcome to ElysiaJS Auth API')
    expect(response).toHaveProperty('version', '1.0.0')
  })

  it('should return health status', async () => {
    const response = await app
      .handle(new Request('http://localhost/health'))
      .then(res => res.json())
    
    expect(response).toHaveProperty('status', 'ok')
    expect(response).toHaveProperty('timestamp')
    expect(response).toHaveProperty('environment')
    expect(response).toHaveProperty('database')
  })

  it('should return 401 for protected /me without token', async () => {
    const response = await app
      .handle(new Request('http://localhost/api/auth/me'))
      .then(res => res.status)
    
    expect(response).toBe(401)
  })

  it('should return 404 for non-existent routes', async () => {
    const response = await app
      .handle(new Request('http://localhost/api/non-existent'))
      .then(res => res.status)
    
    expect(response).toBe(404)
  })
})
