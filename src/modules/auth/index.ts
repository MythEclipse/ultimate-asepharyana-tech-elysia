import { Elysia, t, status } from 'elysia';
import { bearer } from '@elysiajs/bearer';
import { AuthService } from './service';
import { AuthModel } from './model';
import { verifyJWT } from '../../utils/jwt';
import { isTokenBlacklisted } from '../../utils/redis';

export const auth = new Elysia({ name: 'auth', prefix: '/api/auth' })
  .use(bearer())
  .model(AuthModel)
  .derive({ as: 'global' }, async ({ bearer }) => {
    if (!bearer) {
      return {
        userId: undefined,
        accessToken: undefined,
      };
    }

    const isBlacklisted = await isTokenBlacklisted(bearer);
    if (isBlacklisted) {
      return {
        userId: undefined,
        accessToken: undefined,
      };
    }

    const payload = await verifyJWT(bearer);
    if (!payload) {
      return {
        userId: undefined,
        accessToken: undefined,
      };
    }

    return {
      userId: payload.user_id as string,
      accessToken: bearer,
    };
  })
  .post(
    '/register',
    async ({ body, set }) => {
      const result = await AuthService.register(body);
      set.status = 201;
      return result;
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
      return await AuthService.login(body);
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
      return await AuthService.refresh(body.refreshToken);
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
      return await AuthService.googleLogin(body.idToken);
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
    '/verify',
    async ({ query }) => {
      return await AuthService.verifyEmail(query.token);
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
      return await AuthService.forgotPassword(body.email);
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
      return await AuthService.resetPassword(body);
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
  .guard(
    {
      beforeHandle({ userId }) {
        if (!userId) throw status(401);
      },
    },
    (app) =>
      app
        .get(
          '/me',
          async ({ userId }) => {
            return await AuthService.getUserProfile(userId!);
          },
          {
            response: 'authResponse',
            detail: {
              summary: 'Get current user profile',
              tags: ['Auth'],
            },
          },
        )
        .post(
          '/logout',
          async ({ body, accessToken }) => {
            return await AuthService.logout(body.refreshToken, accessToken);
          },
          {
            body: 'refreshBody',
            response: 'authResponse',
            detail: {
              summary: 'Logout and revoke refresh token',
              tags: ['Auth'],
            },
          },
        ),
  );
