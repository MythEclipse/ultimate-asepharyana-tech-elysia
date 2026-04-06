import { t } from 'elysia'
import type { UnwrapSchema } from 'elysia'

export const AuthModel = {
  user: t.Object({
    id: t.String(),
    email: t.String({ format: 'email' }),
    name: t.Nullable(t.String()),
    username: t.Nullable(t.String()),
    emailVerified: t.Nullable(t.Date()),
    image: t.Nullable(t.String()),
    role: t.String(),
  }),

  registerBody: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 8 }),
    name: t.Optional(t.String()),
    username: t.String({ minLength: 3 }),
  }),

  loginBody: t.Object({
    email: t.String({ format: 'email' }),
    password: t.String(),
  }),

  refreshBody: t.Object({
    refreshToken: t.String(),
  }),

  forgotPasswordBody: t.Object({
    email: t.String({ format: 'email' }),
  }),

  resetPasswordBody: t.Object({
    token: t.String(),
    newPassword: t.String({ minLength: 8 }),
  }),

  verifyEmailBody: t.Object({
    token: t.String(),
  }),

  authResponse: t.Object({
    success: t.Boolean(),
    message: t.String(),
    accessToken: t.Optional(t.String()),
    refreshToken: t.Optional(t.String()),
    expiresIn: t.Optional(t.Number()),
    user: t.Optional(
      t.Object({
        id: t.String(),
        email: t.Nullable(t.String()),
        name: t.Nullable(t.String()),
        username: t.Nullable(t.String()),
        emailVerified: t.Nullable(t.Date()),
        image: t.Nullable(t.String()),
        role: t.String(),
      }),
    ),
  }),

  errorResponse: t.Object({
    success: t.Literal(false),
    message: t.String(),
    code: t.Optional(t.String()),
  }),
} as const

// TypeScript helper types
export type TAuthModel = {
  [K in keyof typeof AuthModel]: UnwrapSchema<typeof AuthModel[K]>
}
