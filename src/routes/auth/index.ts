import { Elysia } from 'elysia'
import { forgotPasswordRoute } from './forgot-password'
import { googleAuth } from './google'
import { loginRoute } from './login'
import { logoutRoute } from './logout'
import { meRoute } from './me'
import { refreshTokenRoute } from './refresh-token'
import { registerRoute } from './register'
import { resetPasswordRoute } from './reset-password'
import { verifyRoute } from './verify'

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(registerRoute)
  .use(loginRoute)
  .use(googleAuth)
  .use(logoutRoute)
  .use(meRoute)
  .use(verifyRoute)
  .use(forgotPasswordRoute)
  .use(resetPasswordRoute)
  .use(refreshTokenRoute)
