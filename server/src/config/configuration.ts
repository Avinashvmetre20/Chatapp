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
});
