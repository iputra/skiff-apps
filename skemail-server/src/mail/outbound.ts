import { randomUUID } from 'crypto';
import { promises as dns } from 'dns';
import fs from 'fs';

import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
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
import { loadDkimKey } from './dkim';
import { ingestMime, isLocalDomain, SERVER_KEY_NAME } from './ingest';

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

async function mxHosts(config: Config, domain: string): Promise<{ host: string; port: number }[]> {
  const override = config.mail.mxOverrides[domain];
  if (override) return [override];
  try {
    const records = await dns.resolveMx(domain);
    if (records.length) {
      return records
        .sort((a, b) => a.priority - b.priority)
        .map((r) => ({ host: r.exchange, port: config.mail.outboundPort }));
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') {
      // RFC 5321 §5.1: without MX records the domain itself is the mail host, if it resolves.
      await dns.lookup(domain).catch(() => {
        throw new PermanentError(`Domain ${domain} does not exist or does not receive mail`);
      });
      return [{ host: domain, port: config.mail.outboundPort }];
    }
    throw err;
  }
  return [{ host: domain, port: config.mail.outboundPort }];
}

/** Hands the message to the recipient domain's MX hosts, trying each in priority order. */
async function deliver(
  config: Config,
  dkimKey: string,
  envelopeFrom: string,
  recipients: string[],
  domain: string,
  raw: Buffer
) {
  const fromDomain = envelopeFrom.split('@')[1];
  let lastError: Error | null = null;
  for (const mx of await mxHosts(config, domain)) {
    const transport = nodemailer.createTransport({
      host: mx.host,
      port: mx.port,
      name: config.mail.hostname,
      secure: false,
      // Opportunistic STARTTLS, as between MTAs; certificates of other MX hosts are rarely verifiable.
      tls: { rejectUnauthorized: false },
      connectionTimeout: CONNECT_TIMEOUT_MS,
      greetingTimeout: CONNECT_TIMEOUT_MS,
      dkim: { domainName: fromDomain, keySelector: config.mail.dkimSelector, privateKey: dkimKey }
    });
    try {
      await transport.sendMail({ envelope: { from: envelopeFrom, to: recipients }, raw });
      return `${mx.host}:${mx.port}`;
    } catch (err) {
      const responseCode = (err as { responseCode?: number }).responseCode;
      // A 5xx answer is the receiving domain's final word; other MX hosts would say the same.
      if (responseCode && responseCode >= 500) throw new PermanentError((err as Error).message);
      lastError = err as Error;
    } finally {
      transport.close();
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
export async function processOutboundQueue(db: DB, config: Config, log: (msg: string) => void = console.log) {
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
      const via = await deliver(config, dkimKey, message.from, recipients, job.domain, await message.build());
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
  let running = false;
  const timer = setInterval(async () => {
    if (running || !config.mail.outboundEnabled) return;
    running = true;
    try {
      await processOutboundQueue(db, config);
    } catch (err) {
      console.error('[outbound] queue error', err);
    } finally {
      running = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
