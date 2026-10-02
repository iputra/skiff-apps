import { randomUUID } from 'crypto';
import { promises as dns } from 'dns';
import fs from 'fs';

import { isIP } from 'net';
import { TLSSocket } from 'tls';

import MailComposer from 'nodemailer/lib/mail-composer';
import SMTPConnection from 'nodemailer/lib/smtp-connection';
import { decryptSessionKey } from 'skiff-crypto';

import { Config } from '../config';
import { DB, fromJSON, now, toJSON } from '../db/db';
import { Address, getEmailRow, listAttachmentRows } from '../db/mail';
import { getOrCreateServerKey } from '../db/misc';
import { normalizeAddress, PublicKey } from '../db/users';
import {
  AttachmentDatagram,
  AttachmentMetadata,
  AttachmentMetadataDatagram,
  decrypt,
  MailHtmlDatagram,
  MailSubjectDatagram,
  MailTextDatagram
} from './datagrams';
import { dkimSignMessage, loadDkimKey } from './dkim';
import { ingestMime, isLocalDomain, SERVER_KEY_NAME } from './ingest';
import {
  daneMatches,
  dohResolver,
  fetchMtaSts,
  MtaStsFetcher,
  MtaStsPolicy,
  mtaStsPolicyFor,
  mxAllowedByPolicy,
  parseTlsa,
  pkixValid,
  SecureResolver,
  Tlsa
} from './tls-policy';

/** Network lookups used for delivery; tests replace them with fakes. */
export interface OutboundDeps {
  /** DNSSEC-validating resolver for MX and TLSA (DANE); null disables DANE. */
  secureResolver?: SecureResolver | null;
  mtaSts?: MtaStsFetcher;
}

export const defaultOutboundDeps = (config: Config): OutboundDeps => ({
  secureResolver: config.mail.daneDohUrl ? dohResolver(config.mail.daneDohUrl) : null,
  mtaSts: fetchMtaSts
});

/** Prepends a DKIM-Signature for the sender's domain. */
const signDkim = (config: Config, dkimKey: string, envelopeFrom: string, raw: Buffer) =>
  dkimSignMessage(raw, { domain: envelopeFrom.split('@')[1], selector: config.mail.dkimSelector, privateKey: dkimKey });

/** Delay before each retry after a temporary failure; the message bounces once these run out (~1.5 days). */
const RETRY_DELAYS_MS = [1, 5, 15, 60, 180, 360, 720].map((m) => m * 60 * 1000);
const CONNECT_TIMEOUT_MS = 30_000;

interface QueueRow {
  id: string;
  sender_user_id: string;
  email_id: string;
  external_session_key: string;
  external_session_key_by_json: string;
  recipients_json: string;
  domain: string;
  in_reply_to: string | null;
  attempts: number;
}

export interface OutboundRequest {
  senderUserID: string;
  emailID: string;
  /** SendEmailRequest.externalEncryptedSessionKey: the session key wrapped for the server's key. */
  externalSessionKey: { encryptedSessionKey: string; encryptedBy: PublicKey };
  recipients: string[];
  inReplyTo?: string | null;
}

/** Queues delivery to other mail servers, one job per recipient domain. */
export function enqueueOutbound(db: DB, req: OutboundRequest) {
  const byDomain = new Map<string, string[]>();
  for (const address of req.recipients.map(normalizeAddress)) {
    const domain = address.split('@')[1] ?? '';
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), address]);
  }
  const insert = db.prepare(
    `INSERT INTO outbound_queue (id, sender_user_id, email_id, external_session_key, external_session_key_by_json,
       recipients_json, domain, in_reply_to, next_attempt_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const ts = now();
  for (const [domain, recipients] of byDomain) {
    insert.run(
      randomUUID(),
      req.senderUserID,
      req.emailID,
      req.externalSessionKey.encryptedSessionKey,
      toJSON(req.externalSessionKey.encryptedBy),
      toJSON([...new Set(recipients)]),
      domain,
      req.inReplyTo ?? null,
      ts,
      ts,
      ts
    );
  }
}

/** Rebuilds the MIME message from the sender's encrypted copy. Plaintext only ever lives in memory. */
function renderMime(db: DB, config: Config, job: QueueRow) {
  const email = getEmailRow(db, job.sender_user_id, job.email_id);
  if (!email) throw new PermanentError('The original message no longer exists');
  const server = getOrCreateServerKey(db, SERVER_KEY_NAME);
  const sessionKey = decryptSessionKey(
    job.external_session_key,
    server.secretKey,
    fromJSON<PublicKey>(job.external_session_key_by_json, { key: '' })
  );
  const subject = decrypt<{ subject: string }>(MailSubjectDatagram, sessionKey, email.encrypted_subject).subject;
  const text = decrypt<{ text: string }>(MailTextDatagram, sessionKey, email.encrypted_text).text;
  const html = decrypt<{ html: string }>(MailHtmlDatagram, sessionKey, email.encrypted_html).html;
  const attachments = listAttachmentRows(db, job.sender_user_id, job.email_id).map((a) => {
    const meta = decrypt<AttachmentMetadata>(AttachmentMetadataDatagram, sessionKey, a.encrypted_metadata);
    const content = decrypt<{ content: string }>(
      AttachmentDatagram,
      sessionKey,
      fs.readFileSync(a.blob_path, 'utf8')
    ).content;
    const inline = meta.contentDisposition.startsWith('inline');
    return {
      filename: meta.filename,
      contentType: meta.contentType,
      content: Buffer.from(content, 'base64'),
      contentDisposition: (inline ? 'inline' : 'attachment') as 'inline' | 'attachment',
      ...(meta.contentId ? { cid: meta.contentId.replace(/^<|>$/g, '') } : {})
    };
  });

  const from = fromJSON<Address>(email.from_json, { address: '' });
  const format = (a: Address) => (a.name ? { name: a.name, address: a.address } : a.address);
  const composer = new MailComposer({
    from: format(from),
    to: fromJSON<Address[]>(email.to_json, []).map(format),
    cc: fromJSON<Address[]>(email.cc_json, []).map(format),
    subject,
    text,
    html,
    attachments,
    messageId: email.message_id ?? undefined,
    date: new Date(email.created_at),
    ...(job.in_reply_to ? { inReplyTo: job.in_reply_to, references: [job.in_reply_to] } : {})
  });
  return { from: from.address, subject, messageId: email.message_id, build: () => composer.compile().build() };
}

class PermanentError extends Error {}

interface MxHost {
  host: string;
  port: number;
  /** The MX answer was DNSSEC-validated (or configured locally), so DANE may apply to this host. */
  secure: boolean;
}

async function mxHosts(config: Config, domain: string, deps: OutboundDeps): Promise<MxHost[]> {
  const override = config.mail.mxOverrides[domain];
  if (override) return [{ ...override, secure: true }];
  const port = config.mail.outboundPort;
  const byPriority = (records: { priority: number; exchange: string }[]) =>
    records.sort((a, b) => a.priority - b.priority).map((r) => r.exchange.replace(/\.$/, ''));

  if (deps.secureResolver) {
    try {
      const { answers, secure } = await deps.secureResolver(domain, 'MX');
      if (answers.length) {
        const records = answers.map((a) => {
          const [priority, exchange] = a.split(/\s+/);
          return { priority: Number(priority), exchange };
        });
        return byPriority(records).map((host) => ({ host, port, secure }));
      }
    } catch {
      // Fall back to the system resolver below; DANE then cannot apply.
    }
  }
  try {
    const records = await dns.resolveMx(domain);
    if (records.length) return byPriority(records).map((host) => ({ host, port, secure: false }));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOTFOUND' && code !== 'ENODATA') throw err;
  }
  // RFC 5321 §5.1: without MX records the domain itself is the mail host, if it resolves.
  await dns.lookup(domain).catch(() => {
    throw new PermanentError(`Domain ${domain} does not exist or does not receive mail`);
  });
  return [{ host: domain, port, secure: false }];
}

/** A TLS requirement (DANE or MTA-STS) the MX host did not meet. Temporary: other hosts or a later try may. */
class TlsPolicyError extends Error {}

/** The DANE TLSA records that apply to an MX host, or null when DANE does not apply (RFC 7672 §2.2). */
async function daneRecords(mx: MxHost, deps: OutboundDeps): Promise<Tlsa[] | null> {
  if (!deps.secureResolver || !mx.secure) return null;
  let answer;
  try {
    answer = await deps.secureResolver(`_${mx.port}._tcp.${mx.host}`, 'TLSA');
  } catch (err) {
    // A failed lookup in a signed zone may be an attack; do not fall back to unauthenticated TLS.
    throw new TlsPolicyError(`TLSA lookup for ${mx.host} failed: ${(err as Error).message}`);
  }
  if (!answer.secure) return null;
  const usable = answer.answers.map(parseTlsa).filter((r): r is Tlsa => !!r && (r.usage === 2 || r.usage === 3));
  return usable.length ? usable : null;
}

/**
 * Hands the message to the recipient domain's MX hosts in priority order, applying the strongest TLS policy the
 * domain publishes:
 * - DANE (TLSA records in a DNSSEC-signed zone): STARTTLS required and the certificate must match a TLSA record.
 * - MTA-STS in enforce mode: only MX hosts listed in the policy, STARTTLS required, publicly trusted certificate
 *   for the MX name. In testing mode violations are only logged.
 * - Otherwise opportunistic STARTTLS, as is usual between mail servers.
 */
async function deliver(
  db: DB,
  config: Config,
  envelopeFrom: string,
  recipients: string[],
  domain: string,
  raw: Buffer,
  deps: OutboundDeps,
  log: (msg: string) => void
) {
  const noPolicy: MtaStsPolicy = { id: false, mode: 'none' };
  const policy = config.mail.mtaStsEnabled
    ? await mtaStsPolicyFor(db, domain, deps.mtaSts ?? fetchMtaSts).catch(() => noPolicy)
    : noPolicy;
  const enforce = policy.mode === 'enforce';
  let lastError: Error | null = null;

  for (const mx of await mxHosts(config, domain, deps)) {
    const tlsa = await daneRecords(mx, deps).catch((err: Error) => {
      lastError = err;
      return undefined;
    });
    if (tlsa === undefined) continue;
    const useMtaSts = !tlsa && policy.mode !== 'none';
    if (useMtaSts && !mxAllowedByPolicy(mx.host, policy)) {
      const msg = `MX ${mx.host} is not listed in the MTA-STS policy of ${domain}`;
      if (enforce) {
        lastError = new TlsPolicyError(msg);
        continue;
      }
      log(`[outbound] MTA-STS testing: ${msg}`);
    }

    const connection = new SMTPConnection({
      host: mx.host,
      port: mx.port,
      name: config.mail.hostname,
      secure: false,
      requireTLS: !!tlsa || (useMtaSts && enforce),
      // Certificates are checked below, according to the policy that applies.
      tls: { rejectUnauthorized: false, ...(isIP(mx.host) ? {} : { servername: mx.host }) },
      connectionTimeout: CONNECT_TIMEOUT_MS,
      greetingTimeout: CONNECT_TIMEOUT_MS
    });
    try {
      await new Promise<void>((resolve, reject) => {
        connection.once('error', reject);
        connection.connect(() => resolve());
      });
      // SMTPConnection keeps the upgraded TLS socket private.
      const socket = (connection as unknown as { _socket: TLSSocket })._socket;
      const encrypted = connection.secure && socket instanceof TLSSocket;
      let mode = encrypted ? 'TLS' : 'plaintext';
      if (tlsa) {
        if (!encrypted || !daneMatches(socket, tlsa, mx.host)) {
          throw new TlsPolicyError(`certificate of ${mx.host} does not match its DANE TLSA records`);
        }
        mode = 'DANE';
      } else if (useMtaSts) {
        const ok = encrypted && pkixValid(socket, mx.host);
        if (!ok && enforce) throw new TlsPolicyError(`${mx.host} has no valid TLS certificate (MTA-STS enforce)`);
        if (!ok) log(`[outbound] MTA-STS testing: ${mx.host} has no valid TLS certificate`);
        mode = `MTA-STS ${policy.mode}`;
      }
      await new Promise<void>((resolve, reject) =>
        connection.send({ from: envelopeFrom, to: recipients }, raw, (err) => (err ? reject(err) : resolve()))
      );
      connection.quit();
      return `${mx.host}:${mx.port} (${mode})`;
    } catch (err) {
      connection.close();
      const { responseCode, command, code } = err as { responseCode?: number; command?: string; code?: string };
      // TLS could not be negotiated (e.g. STARTTLS refused while a policy requires it): a temporary failure.
      if (code === 'ETLS' || command === 'STARTTLS') {
        lastError = new TlsPolicyError(`${mx.host}: ${(err as Error).message}`);
        continue;
      }
      // A 5xx answer is the receiving domain's final word; other MX hosts would say the same.
      if (responseCode && responseCode >= 500) throw new PermanentError((err as Error).message);
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error(`No mail host for ${domain}`);
}

/** Tells the sender, in their own inbox, that delivery failed. */
async function bounce(db: DB, config: Config, job: QueueRow, reason: string) {
  const email = getEmailRow(db, job.sender_user_id, job.email_id);
  if (!email) return;
  const sender = fromJSON<Address>(email.from_json, { address: '' }).address;
  const recipients = fromJSON<string[]>(job.recipients_json, []);
  const raw = await new MailComposer({
    from: { name: 'Mail Delivery System', address: `mailer-daemon@${config.mail.domains[0]}` },
    to: sender,
    subject: 'Undelivered Mail Returned to Sender',
    text: [
      `Your message could not be delivered to: ${recipients.join(', ')}`,
      '',
      `Reason: ${reason}`,
      '',
      'No further delivery attempts will be made.'
    ].join('\n'),
    ...(email.message_id ? { inReplyTo: email.message_id, references: [email.message_id] } : {})
  })
    .compile()
    .build();
  await ingestMime(db, config, raw, [sender]);
}

function finish(db: DB, job: QueueRow, status: 'sent' | 'failed', error: string | null) {
  db.prepare('UPDATE outbound_queue SET status = ?, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?').run(
    status,
    job.attempts + 1,
    error,
    now(),
    job.id
  );
}

/** Attempts every job that is due. Exposed for tests; the server runs it on a timer. */
export async function processOutboundQueue(
  db: DB,
  config: Config,
  log: (msg: string) => void = console.log,
  deps: OutboundDeps = defaultOutboundDeps(config)
) {
  const jobs = db
    .prepare("SELECT * FROM outbound_queue WHERE status = 'pending' AND next_attempt_at <= ? ORDER BY next_attempt_at")
    .all(now()) as QueueRow[];
  if (!jobs.length) return;
  const dkimKey = loadDkimKey(config.mail);
  for (const job of jobs) {
    const recipients = fromJSON<string[]>(job.recipients_json, []);
    try {
      if (isLocalDomain(config, `x@${job.domain}`)) {
        throw new PermanentError(`No such user here: ${recipients.join(', ')}`);
      }
      const message = renderMime(db, config, job);
      const signed = await signDkim(config, dkimKey, message.from, await message.build());
      const via = await deliver(db, config, message.from, recipients, job.domain, signed, deps, log);
      finish(db, job, 'sent', null);
      log(`[outbound] ${message.from} -> ${recipients.join(', ')} delivered via ${via}`);
    } catch (err) {
      const reason = (err as Error).message;
      const retryDelay = RETRY_DELAYS_MS[job.attempts];
      if (err instanceof PermanentError || retryDelay === undefined) {
        finish(db, job, 'failed', reason);
        log(`[outbound] giving up on ${recipients.join(', ')}: ${reason}`);
        await bounce(db, config, job, reason).catch((e) => log(`[outbound] bounce failed: ${(e as Error).message}`));
      } else {
        db.prepare(
          'UPDATE outbound_queue SET attempts = ?, last_error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?'
        ).run(job.attempts + 1, reason, new Date(Date.now() + retryDelay).toISOString(), now(), job.id);
        log(`[outbound] ${recipients.join(', ')}: ${reason}; retrying in ${retryDelay / 60000} min`);
      }
    }
  }
}

/** Runs the queue every few seconds. Returns a function that stops it. */
export function startOutboundWorker(db: DB, config: Config, intervalMs = 5000) {
  const deps = defaultOutboundDeps(config);
  let running = false;
  const timer = setInterval(async () => {
    if (running || !config.mail.outboundEnabled) return;
    running = true;
    try {
      await processOutboundQueue(db, config, console.log, deps);
    } catch (err) {
      console.error('[outbound] queue error', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
