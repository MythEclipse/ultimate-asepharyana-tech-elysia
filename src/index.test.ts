import { describe, expect, it } from 'bun:test'
import { app } from './server'

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

  it('should proxy file upload to external service', async () => {
    const originalFetch = globalThis.fetch
    const file = new File(['test-data'], 'upload.png', { type: 'image/png' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('description', 'test upload')

    globalThis.fetch = (async (input, init) => {
      expect(input).toBe('https://picser-two.vercel.app/api/upload')
      expect(init?.method).toBe('POST')

      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers as Record<string, string> | undefined)
      expect(headers.get('Accept')).toBe('application/json')

      expect(init?.body).toBeInstanceOf(FormData)
      const bodyForm = init?.body as FormData
      const forwardedFile = bodyForm.get('file')
      expect(forwardedFile).toBeInstanceOf(File)
      expect((forwardedFile as File).name).toBe('upload.png')
      expect(bodyForm.get('description')).toBe('test upload')

      return new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    try {
      const response = await app.handle(new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      }))

      expect(response.status).toBe(201)
      const payload = await response.json()
      expect(payload).toEqual({ success: true })
    }
    finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should return 502 when external upload fails', async () => {
    const originalFetch = globalThis.fetch
    const file = new File(['test-data'], 'upload.png', { type: 'image/png' })
    const formData = new FormData()
    formData.append('file', file)

    globalThis.fetch = (async () => {
      throw new Error('network error')
    }) as unknown as typeof fetch

    try {
      const response = await app.handle(new Request('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      }))

      expect(response.status).toBe(502)
      const payload = await response.json()
      expect(payload).toEqual({ error: 'External upload service unavailable' })
    }
    finally {
      globalThis.fetch = originalFetch
    }
  })

  it('should return 404 for non-existent routes', async () => {
    const response = await app
      .handle(new Request('http://localhost/api/non-existent'))
      .then(res => res.status)

    expect(response).toBe(404)
  })
})
