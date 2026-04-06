import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { config } from '../../config'
import {
  accounts,
  and,
  emailVerificationTokens,
  eq,
  getDb,
  passwordResetTokens,
  sessions,
  users,
} from '../../db'
import { sendPasswordResetEmail, sendVerificationEmail } from '../../utils/email'
import { authLogger } from '../../utils/logger'
import { signJWT, verifyJWT } from '../../utils/jwt'
import { blacklistToken, isTokenBlacklisted } from '../../utils/redis'
import { sanitizeEmail, sanitizeString } from '../../utils/validation'
import type { TAuthModel } from './model'

export abstract class AuthService {
  private static generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  private static validatePassword(password: string): string | null {
    if (password.length < 8)
      return 'Password must be at least 8 characters'

    const hasUppercase = /[A-Z]/.test(password)
    const hasLowercase = /[a-z]/.test(password)
    const hasDigit = /\d/.test(password)
    const hasSpecial = /[^A-Z0-9]/i.test(password)

    if (!hasUppercase || !hasLowercase || !hasDigit)
      return 'Password must contain uppercase, lowercase, and numbers'

    if (!hasSpecial)
      return 'Password should contain at least one special character'

    return null
  }

  static async register(body: TAuthModel['registerBody']) {
    const db = getDb()
    const { email, name, password, username } = body

    authLogger.registerAttempt(email)

    const sanitizedEmail = sanitizeEmail(email)
    if (!sanitizedEmail) {
      authLogger.registerFailed(email, 'Invalid email format')
      throw new Error('Invalid email format')
    }

    const sanitizedName = name ? sanitizeString(name) : null

    const passwordError = this.validatePassword(password)
    if (passwordError) {
      authLogger.registerFailed(sanitizedEmail, passwordError)
      throw new Error(passwordError)
    }

    const existingUserResult = await db
      .select()
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1)

    if (existingUserResult.length > 0) {
      authLogger.registerFailed(sanitizedEmail, 'Email already exists')
      throw new Error('Email already exists')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`

    await db.insert(users).values({
      id: userId,
      email: sanitizedEmail,
      name: sanitizedName,
      username,
      password: hashedPassword,
      role: 'user',
    })

    const verificationToken = this.generateToken()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db.insert(emailVerificationTokens).values({
      id: `evt_${Date.now()}_${userId}`,
      userId,
      token: verificationToken,
      expiresAt,
    })

    authLogger.registerSuccess(userId, sanitizedEmail)

    try {
      await sendVerificationEmail(email, name || 'User', verificationToken)
    }
    catch (error) {
      console.error('Failed to send verification email:', error)
    }

    const newUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    return {
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      user: newUser[0],
    }
  }

  static async login(body: TAuthModel['loginBody']) {
    const db = getDb()
    const { email, password } = body

    authLogger.loginAttempt(email)

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    const user = userResult[0]
    if (!user || !user.password) {
      authLogger.loginFailed(email, 'Invalid credentials')
      throw new Error('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      authLogger.loginFailed(email, 'Invalid credentials')
      throw new Error('Invalid credentials')
    }

    authLogger.loginSuccess(user.id, email)

    const tokenExpiry = 30 * 24 * 3600
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const accessToken = await signJWT(
      {
        user_id: user.id,
        email: user.email || '',
        name: user.name || '',
      },
      tokenExpiry,
    )

    const sessionToken = `session_${user.id}_${Date.now()}`
    await db.insert(sessions).values({
      id: `sess_${Date.now()}_${user.id}`,
      userId: user.id,
      sessionToken,
      expires: refreshExpiresAt,
    })

    return {
      success: true,
      message: 'Logged in successfully',
      user,
      accessToken,
      refreshToken: sessionToken,
      expiresIn: tokenExpiry,
    }
  }

  static async verifyEmail(token: string) {
    const db = getDb()

    const result = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token))
      .limit(1)

    const verificationToken = result[0]
    if (!verificationToken)
      throw new Error('Invalid verification token')

    if (verificationToken.expiresAt < new Date())
      throw new Error('Verification token has expired')

    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, verificationToken.userId))

    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, verificationToken.id))

    return {
      success: true,
      message: 'Email verified successfully',
    }
  }

  static async refresh(refreshToken: string) {
    const db = getDb()

    const sessionResult = await db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, refreshToken))
      .limit(1)

    const session = sessionResult[0]
    if (!session)
      throw new Error('Invalid refresh token')

    if (session.expires < new Date()) {
      await db.delete(sessions).where(eq(sessions.id, session.id))
      throw new Error('Refresh token has expired')
    }

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1)

    const user = userResult[0]
    if (!user)
      throw new Error('User not found')

    // Generate new session token (rotate)
    const newSessionToken = this.generateToken()
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const tokenExpiry = 30 * 24 * 3600
    const accessToken = await signJWT(
      {
        user_id: user.id,
        email: user.email || '',
        name: user.name || '',
      },
      tokenExpiry,
    )

    await db
      .update(sessions)
      .set({
        sessionToken: newSessionToken,
        expires: refreshExpiresAt,
      })
      .where(eq(sessions.id, session.id))

    return {
      success: true,
      message: 'Token refreshed successfully',
      user,
      accessToken,
      refreshToken: newSessionToken,
      expiresIn: tokenExpiry,
    }
  }

  static async resetPassword(body: TAuthModel['resetPasswordBody']) {
    const db = getDb()
    const { token, newPassword } = body

    const passwordError = this.validatePassword(newPassword)
    if (passwordError)
      throw new Error(passwordError)

    const resetTokenResult = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1)

    const resetToken = resetTokenResult[0]
    if (!resetToken)
      throw new Error('Invalid reset token')

    if (resetToken.used !== 0)
      throw new Error('Reset token has already been used')

    if (resetToken.expiresAt < new Date())
      throw new Error('Reset token has expired')

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, resetToken.userId))

    await db
      .update(passwordResetTokens)
      .set({ used: 1 })
      .where(eq(passwordResetTokens.id, resetToken.id))

    return {
      success: true,
      message: 'Password has been reset successfully',
    }
  }

  static async forgotPassword(email: string) {
    const db = getDb()

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    const user = userResult[0]
    if (!user) {
      // Return success anyway for security (don't leak emails)
      return {
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      }
    }

    const token = this.generateToken()
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour

    await db.insert(passwordResetTokens).values({
      id: `prt_${Date.now()}_${user.id}`,
      userId: user.id,
      token,
      expiresAt,
      used: 0,
    })

    try {
      await sendPasswordResetEmail(email, user.name || 'User', token)
    }
    catch (error) {
      console.error('Failed to send forgot password email:', error)
    }

    return {
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    }
  }

  static async googleLogin(idToken: string) {
    const db = getDb()

    const client = new OAuth2Client(config.googleClientId)
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    })

    const payload = ticket.getPayload()
    if (!payload)
      throw new Error('Invalid token payload')

    const { sub: googleId, email, name, picture } = payload
    if (!email)
      throw new Error('Email not found in token')

    let user = (
      await db.select().from(users).where(eq(users.email, email)).limit(1)
    )[0]

    if (!user) {
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`
      await db.insert(users).values({
        id: userId,
        email,
        name: name || 'Google User',
        image: picture || null,
        role: 'user',
        password: '',
        emailVerified: new Date(),
      })
      user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    }

    if (!user)
      throw new Error('Failed to create or find user')

    const existingAccount = (
      await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.provider, 'google'),
            eq(accounts.providerAccountId, googleId),
          ),
        )
        .limit(1)
    )[0]

    if (!existingAccount) {
      const accountId = `acc_${Date.now()}_${Math.random().toString(36).substring(7)}`
      await db.insert(accounts).values({
        id: accountId,
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: googleId,
      })
    }

    const tokenExpiry = 30 * 24 * 3600
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const accessToken = await signJWT(
      {
        user_id: user.id,
        email: user.email || '',
        name: user.name || '',
      },
      tokenExpiry,
    )

    const sessionToken = `session_${user.id}_${Date.now()}`
    await db.insert(sessions).values({
      id: `sess_${Date.now()}_${user.id}`,
      userId: user.id,
      sessionToken,
      expires: refreshExpiresAt,
    })

    return {
      success: true,
      message: 'Google login successful',
      user,
      accessToken,
      refreshToken: sessionToken,
      expiresIn: tokenExpiry,
    }
  }

  static async getUserProfile(authHeader: string | undefined) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      authLogger.tokenInvalid('No token provided')
      throw new Error('No token provided')
    }

    const token = authHeader.substring(7)
    const isBlacklisted = await isTokenBlacklisted(token)
    if (isBlacklisted) {
      authLogger.tokenInvalid('Token has been revoked')
      throw new Error('Token has been revoked')
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      authLogger.tokenInvalid('Invalid token signature')
      throw new Error('Invalid token')
    }

    authLogger.tokenVerified(payload.user_id)

    const db = getDb()
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.user_id))
      .limit(1)

    const user = result[0]
    if (!user) {
      authLogger.tokenInvalid('User not found in database')
      throw new Error('User not found')
    }

    return {
      success: true,
      message: 'User profile retrieved successfully',
      user,
    }
  }

  static async logout(refreshToken: string, authHeader: string | undefined) {
    const db = getDb()
    await db.delete(sessions).where(eq(sessions.sessionToken, refreshToken))

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Use 30 days as max expiry for blacklist since that's our token max
      await blacklistToken(token, 30 * 24 * 3600)
    }

    return { success: true, message: 'Logged out successfully' }
  }
}
