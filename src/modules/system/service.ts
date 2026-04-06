import {
  emailVerificationTokens,
  getDb,
  imageCache,
  lt,
  passwordResetTokens,
  sessions,
} from '../../db';
import { systemLogger } from '../../utils/logger';

export abstract class SystemService {
  /**
   * Performs various system maintenance tasks:
   * 1. Deletes expired sessions
   * 2. Deletes expired verification tokens
   * 3. Deletes expired password reset tokens
   * 4. Deletes expired image cache entries
   * 5. Logs system resource usage
   */
  static async performMaintenance() {
    const db = getDb()
    const now = new Date()

    systemLogger.info('Starting system maintenance...');

    try {
      // 1. Cleanup Sessions
      const deletedSessions = await db.delete(sessions).where(lt(sessions.expires, now))
      
      // 2. Cleanup Email Verification Tokens
      const deletedEmailTokens = await db.delete(emailVerificationTokens).where(lt(emailVerificationTokens.expiresAt, now))
      
      // 3. Cleanup Password Reset Tokens
      const deletedPassTokens = await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now))
      
      // 4. Cleanup Image Cache
      const deletedCache = await db.delete(imageCache).where(lt(imageCache.expiresAt, now))

      // 5. System Metrics
      const memory = process.memoryUsage()
      const memoryMB = {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
      }

      systemLogger.info('Maintenance complete', {
        deletedSessions: deletedSessions[0]?.affectedRows || 0,
        deletedEmailTokens: deletedEmailTokens[0]?.affectedRows || 0,
        deletedPassTokens: deletedPassTokens[0]?.affectedRows || 0,
        deletedCache: deletedCache[0]?.affectedRows || 0,
        memoryMB,
      });
    }
    catch (error) {
      systemLogger.error('Maintenance error', error);
    }
  }
}
