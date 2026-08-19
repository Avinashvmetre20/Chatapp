export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },

  database: {
    url: process.env.DATABASE_URL,
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 20,
      idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    },
  },

  webrtc: {
    stunUrl: process.env.WEBRTC_STUN_URL ?? 'stun:stun.l.google.com:19302',
    turnUrl: process.env.WEBRTC_TURN_URL ?? '',
    turnUsername: process.env.WEBRTC_TURN_USERNAME ?? '',
    turnPassword: process.env.WEBRTC_TURN_PASSWORD ?? '',
  },

  calls: {
    ringTimeoutSeconds: Number(process.env.CALL_RING_TIMEOUT_SECONDS) || 30,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? '15m',
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
    loginMaxAttempts: Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS) || 5,
    loginLockMinutes: Number(process.env.AUTH_LOGIN_LOCK_MINUTES) || 15,
    cookie: {
      secure: process.env.AUTH_COOKIE_SECURE
        ? process.env.AUTH_COOKIE_SECURE === 'true'
        : true,
      httpOnly: process.env.AUTH_COOKIE_HTTP_ONLY !== 'false',
      sameSite: (process.env.AUTH_COOKIE_SAME_SITE ?? 'none') as
        | 'lax'
        | 'strict'
        | 'none',
    },
  },
});
