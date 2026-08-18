export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },

  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    pool: {
      max: Number(process.env.DB_POOL_MAX) || 20,
      idleTimeout: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 5000,
    },
  },
});
