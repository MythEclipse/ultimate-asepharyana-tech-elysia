import { Elysia, t } from 'elysia'
import { AuthService } from './service'
import { AuthModel } from './model'

export const auth = new Elysia({ prefix: '/api/auth' })
  .model(AuthModel)
  .post(
    '/register',
    async ({ body, set }) => {
      const result = await AuthService.register(body)
      set.status = 201
      return result
    },
    {
      body: 'registerBody',
      response: {
        201: 'authResponse',
      },
      detail: {
        summary: 'Register a new user',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/login',
    async ({ body }) => {
      return await AuthService.login(body)
    },
    {
      body: 'loginBody',
      response: 'authResponse',
      detail: {
        summary: 'Login with email and password',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/refresh',
    async ({ body }) => {
      return await AuthService.refresh(body.refreshToken)
    },
    {
      body: 'refreshBody',
      response: 'authResponse',
      detail: {
        summary: 'Refresh access token',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/google',
    async ({ body }) => {
      return await AuthService.googleLogin(body.idToken)
    },
    {
      body: t.Object({ idToken: t.String() }),
      response: 'authResponse',
      detail: {
        summary: 'Login with Google OAuth idToken',
        tags: ['Auth'],
      },
    },
  )
  .get(
    '/me',
    async ({ headers }) => {
      return await AuthService.getUserProfile(headers.authorization)
    },
    {
      response: 'authResponse',
      detail: {
        summary: 'Get current user profile',
        tags: ['Auth'],
      },
    },
  )
  .get(
    '/verify',
    async ({ query }) => {
      return await AuthService.verifyEmail(query.token)
    },
    {
      query: 'verifyEmailBody',
      response: 'authResponse',
      detail: {
        summary: 'Verify user email',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/forgot-password',
    async ({ body }) => {
      return await AuthService.forgotPassword(body.email)
    },
    {
      body: 'forgotPasswordBody',
      response: 'authResponse',
      detail: {
        summary: 'Request password reset email',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/reset-password',
    async ({ body }) => {
      return await AuthService.resetPassword(body)
    },
    {
      body: 'resetPasswordBody',
      response: 'authResponse',
      detail: {
        summary: 'Reset password using token',
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/logout',
    async ({ body, headers }) => {
      return await AuthService.logout(body.refreshToken, headers.authorization)
    },
    {
      body: 'refreshBody',
      response: 'authResponse',
      detail: {
        summary: 'Logout and revoke refresh token',
        tags: ['Auth'],
      },
    },
  )
