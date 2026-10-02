import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

export interface Config {
  port: number;
  /** Base URL the browser uses to reach this server; used to build attachment download links. */
  publicUrl: string;
  databaseFile: string;
  attachmentsDir: string;
  corsOrigins: string[];
  cookieSecure: boolean;
  /** HMAC key for signed attachment download links. */
  linkSecret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 4000);
  const dataDir = path.resolve(env.DATA_DIR ?? path.join(__dirname, '..', 'data'));
  return {
    port,
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
    databaseFile: env.DATABASE_FILE ?? path.join(dataDir, 'skemail.sqlite'),
    attachmentsDir: env.ATTACHMENTS_DIR ?? path.join(dataDir, 'attachments'),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:4200,http://localhost:1212')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    cookieSecure: env.COOKIE_SECURE === 'true',
    // A random secret means links stop working after a restart, which is fine for local development.
    linkSecret: env.LINK_SECRET ?? randomBytes(32).toString('hex')
  };
}

/** Loads skemail-server/.env when present (Node >= 20.12 has process.loadEnvFile). */
export function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  const load = (process as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (load && fs.existsSync(file)) load(file);
}
