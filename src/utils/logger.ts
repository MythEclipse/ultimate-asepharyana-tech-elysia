import winston from 'winston';

/**
 * Centralized Logger Utility
 * Powered by Winston for robust, structured logging
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

// Custom format for premium console output
const consoleFormat = winston.format.printf(({ level, message, timestamp, prefix, ...metadata }) => {
  const p = prefix || 'SYSTEM';
  const contextStr = metadata.context ? ` ‹${metadata.context}›` : '';
  const dataStr = metadata.data ? `\n${JSON.stringify(metadata.data, null, 2)}` : '';
  
  // Format: 19:19:02 INFO  [SYSTEM] › Message
  // Using a clean separator '›' for modern feel
  return `${timestamp} ${level.padEnd(5)} [${p}] › ${message}${contextStr}${dataStr}`;
});

// Initialize Winston Logger
const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
  ],
});

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return '';
  const parts: string[] = [];
  if (context.userId) parts.push(`user=${context.userId}`);
  if (context.sessionId) parts.push(`session=${context.sessionId}`);
  if (context.requestId) parts.push(`req=${context.requestId}`);
  if (context.ip) parts.push(`ip=${context.ip}`);
  if (context.method && context.path) parts.push(`${context.method} ${context.path}`);
  return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
}

function log(level: LogLevel, prefix: string, message: string, context?: LogContext, data?: unknown): void {
  const contextStr = formatContext(context);
  winstonLogger.log({
    level,
    prefix,
    message,
    context: contextStr,
    data,
  });
}

// System Logger (Generic)
export const systemLogger = {
  info: (message: string, context?: LogContext) => log('info', 'SYSTEM', message, context),
  warn: (message: string, context?: LogContext) => log('warn', 'SYSTEM', message, context),
  error: (message: string, error?: unknown, context?: LogContext) => log('error', 'SYSTEM', message, context, error),
  debug: (message: string, context?: LogContext) => log('debug', 'SYSTEM', message, context),
};

// Auth Logger
export const authLogger = {
  loginAttempt: (email: string, ip?: string) =>
    log('info', 'AUTH', `Login attempt for ${email}`, { ip }),
  loginSuccess: (userId: string, email: string, ip?: string) =>
    log('info', 'AUTH', `Login successful for ${email}`, { userId, ip }),
  loginFailed: (email: string, reason: string, ip?: string) =>
    log('warn', 'AUTH', `Login failed for ${email}: ${reason}`, { ip }),
  registerAttempt: (email: string, ip?: string) =>
    log('info', 'AUTH', `Registration attempt for ${email}`, { ip }),
  registerSuccess: (userId: string, email: string) =>
    log('info', 'AUTH', `Registration successful for ${email}`, { userId }),
  registerFailed: (email: string, reason: string) =>
    log('warn', 'AUTH', `Registration failed for ${email}: ${reason}`),
  tokenVerified: (userId: string) =>
    log('debug', 'AUTH', `Token verified`, { userId }),
  tokenInvalid: (reason: string) =>
    log('warn', 'AUTH', `Token invalid: ${reason}`),
  logout: (userId: string) =>
    log('info', 'AUTH', `User logged out`, { userId }),
  passwordReset: (email: string) =>
    log('info', 'AUTH', `Password reset requested for ${email}`),
  emailVerified: (userId: string, email: string) =>
    log('info', 'AUTH', `Email verified for ${email}`, { userId }),
  error: (message: string, error?: unknown) =>
    log('error', 'AUTH', message, undefined, error),
};

// API Logger
export const apiLogger = {
  request: (method: string, path: string, userId?: string, ip?: string) =>
    log('info', 'API', `Request received`, { method, path, userId, ip }),
  response: (
    method: string,
    path: string,
    status: number,
    durationMs?: number,
  ) =>
    log(
      'info',
      'API',
      `Response sent: ${status}${durationMs ? ` (${durationMs}ms)` : ''}`,
      { method, path },
    ),
  error: (method: string, path: string, error: unknown) =>
    log('error', 'API', `Error processing request`, { method, path }, error),
};

// History Logger
export const historyLogger = {
  fetch: (userId: string, count: number) =>
    log('info', 'HISTORY', `Fetched ${count} matches for user`, { userId }),
  fetchError: (userId: string, error: unknown) =>
    log('error', 'HISTORY', `Failed to fetch history`, { userId }, error),
  error: (message: string, error?: unknown) =>
    log('error', 'HISTORY', message, undefined, error),
};

// Chat Logger
export const chatLogger = {
  roomCreated: (roomId: string, userId: string, name: string) =>
    log('info', 'CHAT', `Room created: ${name}`, { userId }),
  roomFetch: (userId: string, count: number) =>
    log('info', 'CHAT', `Fetched ${count} rooms`, { userId }),
  messageSent: (roomId: string, userId: string) =>
    log('debug', 'CHAT', `Message sent to room ${roomId}`, { userId }),
  memberJoined: (roomId: string, userId: string) =>
    log('info', 'CHAT', `User joined room ${roomId}`, { userId }),
  memberLeft: (roomId: string, userId: string) =>
    log('info', 'CHAT', `User left room ${roomId}`, { userId }),
  error: (action: string, error: unknown) =>
    log('error', 'CHAT', `Error: ${action}`, undefined, error),
};

// WebSocket Logger
export const wsLogger = {
  connected: (sessionId: string, userId?: string, username?: string) =>
    log('info', 'WS', `Client connected${username ? `: ${username}` : ''}`, {
      sessionId,
      userId,
    }),
  disconnected: (sessionId: string, userId?: string, reason?: string) =>
    log('info', 'WS', `Client disconnected${reason ? `: ${reason}` : ''}`, {
      sessionId,
      userId,
    }),
  messageReceived: (sessionId: string, type: string, userId?: string) =>
    log('debug', 'WS', `Message received: ${type}`, { sessionId, userId }),
  messageSent: (sessionId: string, type: string) =>
    log('debug', 'WS', `Message sent: ${type}`, { sessionId }),
  error: (sessionId: string, error: unknown) =>
    log('error', 'WS', `Error`, { sessionId }, error),
  authenticated: (sessionId: string, userId: string, username: string) =>
    log('info', 'WS', `User authenticated: ${username}`, { sessionId, userId }),
};

// Friend System Logger
export const friendLogger = {
  requestSent: (fromUserId: string, toUserId: string) =>
    log(
      'info',
      'FRIEND',
      `Friend request sent from ${fromUserId} to ${toUserId}`,
    ),
  requestAccepted: (userId: string) =>
    log('info', 'FRIEND', `Friend request accepted`, { userId }),
  requestRejected: (userId: string) =>
    log('info', 'FRIEND', `Friend request rejected`, { userId }),
  removed: (userId: string, friendId: string) =>
    log('info', 'FRIEND', `Friend removed: ${friendId}`, { userId }),
  listFetched: (userId: string, count: number) =>
    log('debug', 'FRIEND', `Friend list fetched: ${count} friends`, { userId }),
  inviteSent: (senderId: string, receiverId: string) =>
    log(
      'info',
      'FRIEND',
      `Match invite sent from ${senderId} to ${receiverId}`,
    ),
  inviteAccepted: (userId: string) =>
    log('info', 'FRIEND', `Match invite accepted`, { userId }),
  inviteRejected: (userId: string) =>
    log('info', 'FRIEND', `Match invite rejected`, { userId }),
  error: (action: string, error: unknown) =>
    log('error', 'FRIEND', `Error: ${action}`, undefined, error),
};

// Match/Game Logger
export const matchLogger = {
  created: (matchId: string, player1: string, player2: string) =>
    log(
      'info',
      'MATCH',
      `Match created: ${matchId} (${player1} vs ${player2})`,
    ),
  started: (matchId: string) =>
    log('info', 'MATCH', `Match started: ${matchId}`),
  ended: (matchId: string, winnerId?: string) =>
    log(
      'info',
      'MATCH',
      `Match ended: ${matchId}${winnerId ? `, winner: ${winnerId}` : ''}`,
    ),
  playerJoined: (matchId: string, userId: string) =>
    log('info', 'MATCH', `Player joined match ${matchId}`, { userId }),
  playerLeft: (matchId: string, userId: string) =>
    log('info', 'MATCH', `Player left match ${matchId}`, { userId }),
  answerSubmitted: (matchId: string, userId: string, correct: boolean) =>
    log(
      'debug',
      'MATCH',
      `Answer submitted: ${correct ? 'correct' : 'incorrect'}`,
      { userId },
    ),
  error: (matchId: string, error: unknown) =>
    log('error', 'MATCH', `Error in match ${matchId}`, undefined, error),
};

// Queue Logger
export const queueLogger = {
  joined: (userId: string, username: string) =>
    log('info', 'QUEUE', `User joined matchmaking queue: ${username}`, {
      userId,
    }),
  left: (userId: string, username: string) =>
    log('info', 'QUEUE', `User left matchmaking queue: ${username}`, {
      userId,
    }),
  matched: (user1: string, user2: string, matchId: string) =>
    log(
      'info',
      'QUEUE',
      `Players matched: ${user1} vs ${user2}, match: ${matchId}`,
    ),
  timeout: (userId: string) =>
    log('info', 'QUEUE', `Queue timeout for user`, { userId }),
  error: (message: string, error?: unknown) =>
    log('error', 'QUEUE', message, undefined, error),
};

// Leaderboard Logger
export const leaderboardLogger = {
  fetched: (type: string, count: number) =>
    log(
      'debug',
      'LEADERBOARD',
      `Fetched ${type} leaderboard: ${count} entries`,
    ),
  updated: (userId: string, points: number) =>
    log('debug', 'LEADERBOARD', `Updated user points: ${points}`, { userId }),
  error: (action: string, error: unknown) =>
    log('error', 'LEADERBOARD', `Error: ${action}`, undefined, error),
};

// Lobby Logger
export const lobbyLogger = {
  created: (lobbyId: string, hostId: string) =>
    log('info', 'LOBBY', `Lobby created: ${lobbyId}`, { userId: hostId }),
  joined: (lobbyId: string, userId: string) =>
    log('info', 'LOBBY', `User joined lobby ${lobbyId}`, { userId }),
  left: (lobbyId: string, userId: string) =>
    log('info', 'LOBBY', `User left lobby ${lobbyId}`, { userId }),
  started: (lobbyId: string) =>
    log('info', 'LOBBY', `Lobby game started: ${lobbyId}`),
  closed: (lobbyId: string) => log('info', 'LOBBY', `Lobby closed: ${lobbyId}`),
  error: (lobbyId: string, error: unknown) =>
    log('error', 'LOBBY', `Error in lobby ${lobbyId}`, undefined, error),
};

export default {
  system: systemLogger,
  auth: authLogger,
  api: apiLogger,
  history: historyLogger,
  chat: chatLogger,
  ws: wsLogger,
  friend: friendLogger,
  match: matchLogger,
  queue: queueLogger,
  leaderboard: leaderboardLogger,
  lobby: lobbyLogger,
};
