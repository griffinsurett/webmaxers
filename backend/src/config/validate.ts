// backend/src/config/validate.ts
// Checks the environment at start-up so a bad deployment fails loudly and early, instead of
// running with a silently wrong setting (a typo'd number becoming NaN, a dev database in
// production, CORS left open to localhost).

export interface ConfigReport {
  /** Problems that make running unsafe or pointless: the process should not start. */
  errors: string[];
  /** Things worth knowing, logged at start-up. */
  warnings: string[];
}

const NUMERIC = ['PORT', 'TRUST_PROXY', 'MAX_MESSAGES_PER_SESSION', 'MAX_SESSIONS_PER_IP'] as const;
const DEV_DB = /\/\/blueprint:blueprint@/;

export function checkConfig(env: NodeJS.ProcessEnv): ConfigReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = (env.NODE_ENV || 'development') === 'production';

  for (const name of NUMERIC) {
    const raw = env[name];
    if (raw !== undefined && raw !== '' && !/^\d+$/.test(raw.trim())) errors.push(`${name} must be a whole number (got "${raw}")`);
  }
  if (env.RATE_LIMIT_ENABLED !== undefined && !/^(true|false)$/i.test(env.RATE_LIMIT_ENABLED)) {
    errors.push(`RATE_LIMIT_ENABLED must be "true" or "false" (got "${env.RATE_LIMIT_ENABLED}")`);
  }
  // https everywhere, except a local Supabase (its own dev setup serves plain http on this machine).
  if (env.SUPABASE_URL && !/^(https:\/\/[^/\s]+|http:\/\/(localhost|127\.0\.0\.1|host\.docker\.internal)(:\d+)?)$/.test(env.SUPABASE_URL.trim().replace(/\/+$/, ''))) {
    errors.push('SUPABASE_URL must be the project address, like https://abcdefgh.supabase.co');
  }
  if (Boolean(env.SUPABASE_URL) !== Boolean(env.SUPABASE_SERVICE_ROLE_KEY)) {
    errors.push('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set together (or both left empty to turn knowledge uploads off)');
  }
  if (env.KB_POLL_SECONDS !== undefined && !/^\d+$/.test(env.KB_POLL_SECONDS.trim())) errors.push(`KB_POLL_SECONDS must be a whole number (got "${env.KB_POLL_SECONDS}")`);
  if (env.DATABASE_SSL !== undefined && !/^(disable|require|no-verify)$/i.test(env.DATABASE_SSL)) {
    errors.push(`DATABASE_SSL must be disable, require or no-verify (got "${env.DATABASE_SSL}")`);
  }
  if (env.LOG_LEVEL !== undefined && !/^(debug|info|warn|error|silent)$/i.test(env.LOG_LEVEL)) {
    errors.push(`LOG_LEVEL must be debug, info, warn, error or silent (got "${env.LOG_LEVEL}")`);
  }

  if (!production) return { errors, warnings };

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required in production');
  else if (DEV_DB.test(env.DATABASE_URL)) errors.push('DATABASE_URL points at the development database credentials (blueprint:blueprint)');

  if (!env.CORS_ORIGINS) errors.push('CORS_ORIGINS is required in production (the site origin, e.g. https://webmaxxers.com)');
  else {
    const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    const bad = origins.filter((o) => !/^https?:\/\/[^/\s]+$/.test(o));
    if (bad.length) errors.push(`CORS_ORIGINS entries must be origins without a path or trailing slash (got ${bad.join(', ')})`);
    if (origins.some((o) => /localhost|127\.0\.0\.1/.test(o))) warnings.push('CORS_ORIGINS includes a localhost origin in production');
    if (origins.includes('*')) errors.push('CORS_ORIGINS must not be "*"');
  }

  if (!env.OPENAI_API_KEY) warnings.push('OPENAI_API_KEY is not set: the assistant will report itself unavailable and visitors will be offered the demo');
  if (!env.TRUST_PROXY || env.TRUST_PROXY.trim() === '0') {
    warnings.push('TRUST_PROXY is 0: behind a proxy or platform router every visitor would share one address and one rate limit. Set it to the number of proxies in front of this service');
  }
  if (!env.ADMIN_TOKEN) warnings.push('ADMIN_TOKEN is not set: admin routes (knowledge sync, metrics) are disabled');
  else if (env.ADMIN_TOKEN.length < 24) warnings.push('ADMIN_TOKEN is short; use at least 24 random characters');
  if (env.RATE_LIMIT_ENABLED?.toLowerCase() === 'false') warnings.push('RATE_LIMIT_ENABLED is false: burst throttling is OFF');

  return { errors, warnings };
}
