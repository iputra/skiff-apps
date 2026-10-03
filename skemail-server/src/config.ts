import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

import type { SendLimits } from './limits';

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
  mail: MailConfig;
  sendLimits: SendLimits;
  /** Accounts (usernames) allowed to create other accounts through provisionSrp; empty means nobody. */
  adminUsers: string[];
}

export interface MailConfig {
  /** Domains this server hosts mailboxes for; mail to any other domain is delivered to the internet. */
  domains: string[];
  /** Hostname announced in SMTP greetings (EHLO/banner); should match the MX record and reverse DNS. */
  hostname: string;
  /** Port of the inbound SMTP server (25 in production, 0 disables it). */
  smtpPort: number;
  smtpHost: string;
  /** PEM files for STARTTLS on the inbound server; a self-signed certificate is used when unset. */
  tlsKeyFile?: string;
  tlsCertFile?: string;
  maxMessageBytes: number;
  /** Deliver to other servers (false keeps mail queued, useful offline). */
  outboundEnabled: boolean;
  /** Port used to reach other servers' MX hosts (always 25 on the internet). */
  outboundPort: number;
  /** `domain=host:port` pairs that bypass MX lookup, for local testing. */
  mxOverrides: Record<string, { host: string; port: number }>;
  dkimSelector: string;
  dkimKeyFile: string;
  /** DNS blocklists checked for connecting IPs; their verdict rejects the connection. */
  dnsblZones: string[];
  /** Messages accepted per remote IP per minute. */
  inboundPerIpPerMinute: number;
  /** Optional rspamd controller URL (e.g. http://127.0.0.1:11333) for content-based spam filtering. */
  rspamdUrl?: string;
  /** DNS-over-HTTPS resolver that validates DNSSEC, used for DANE; empty disables DANE. */
  daneDohUrl: string;
  /** Honour recipient domains' MTA-STS policies. */
  mtaStsEnabled: boolean;
  /** Our own MTA-STS policy, served at /.well-known/mta-sts.txt. */
  mtaStsMode: 'enforce' | 'testing' | 'none';
  mtaStsMaxAge: number;
}

function parseMxOverrides(value = ''): MailConfig['mxOverrides'] {
  return Object.fromEntries(
    value
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [domain, target] = pair.split('=');
        const [host, port] = target.split(':');
        return [domain.toLowerCase(), { host, port: Number(port || 25) }];
      })
  );
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
    linkSecret: env.LINK_SECRET ?? randomBytes(32).toString('hex'),
    mail: loadMailConfig(env, dataDir),
    sendLimits: {
      maxRecipientsPerMessage: Number(env.SEND_MAX_RECIPIENTS ?? 50),
      perHour: Number(env.SEND_LIMIT_PER_HOUR ?? 50),
      perDay: Number(env.SEND_LIMIT_PER_DAY ?? 200)
    },
    adminUsers: (env.ADMIN_USERS ?? '')
      .split(',')
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean)
  };
}

function loadMailConfig(env: NodeJS.ProcessEnv, dataDir: string): MailConfig {
  const domains = (env.MAIL_DOMAINS ?? 'skiff.local')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return {
    domains,
    hostname: env.MAIL_HOSTNAME ?? `mail.${domains[0]}`,
    smtpPort: Number(env.SMTP_PORT ?? 2525),
    smtpHost: env.SMTP_HOST ?? '0.0.0.0',
    tlsKeyFile: env.SMTP_TLS_KEY_FILE,
    tlsCertFile: env.SMTP_TLS_CERT_FILE,
    maxMessageBytes: Number(env.MAX_MESSAGE_BYTES ?? 30 * 1024 * 1024),
    outboundEnabled: env.OUTBOUND_ENABLED !== 'false',
    outboundPort: Number(env.OUTBOUND_SMTP_PORT ?? 25),
    mxOverrides: parseMxOverrides(env.MX_OVERRIDES),
    dkimSelector: env.DKIM_SELECTOR ?? 'skemail',
    dkimKeyFile: env.DKIM_KEY_FILE ?? path.join(dataDir, 'dkim-private.pem'),
    dnsblZones: (env.DNSBL_ZONES ?? 'zen.spamhaus.org')
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean),
    inboundPerIpPerMinute: Number(env.INBOUND_PER_IP_PER_MINUTE ?? 30),
    rspamdUrl: env.RSPAMD_URL || undefined,
    daneDohUrl: env.DANE_DOH_URL ?? 'https://cloudflare-dns.com/dns-query',
    mtaStsEnabled: env.MTA_STS_ENABLED !== 'false',
    mtaStsMode: (env.MTA_STS_MODE as MailConfig['mtaStsMode']) ?? 'testing',
    mtaStsMaxAge: Number(env.MTA_STS_MAX_AGE ?? 604800)
  };
}

/** Loads skemail-server/.env when present (Node >= 20.12 has process.loadEnvFile). */
export function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  const load = (process as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (load && fs.existsSync(file)) load(file);
}
