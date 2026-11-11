import 'dotenv/config';

const required = ['JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0 && process.env.NODE_ENV === 'production') {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

if (process.env.NODE_ENV === 'production' && process.env.AUTH_BYPASS === 'true') {
  throw new Error('AUTH_BYPASS must be disabled in production');
}

export const env = {
  port: Number(process.env.PORT || 5006),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5180',
  authBypass: process.env.AUTH_BYPASS === 'true',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || 'mutya_licios_lechon_manok',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  }
};
