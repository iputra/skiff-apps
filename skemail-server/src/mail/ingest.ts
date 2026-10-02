import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import { AddressObject, simpleParser } from 'mailparser';
import { encryptSessionKey, generateSymmetricKey } from 'skiff-crypto';

import { Config } from '../config';
import { DB, fromJSON, now } from '../db/db';
import { Address, deliverEmail, findThreadByMessageIds } from '../db/mail';
import { getOrCreateServerKey } from '../db/misc';
import { getUserByAlias, normalizeAddress, PublicKey } from '../db/users';
import {
  AttachmentDatagram,
  AttachmentMetadataDatagram,
  encrypt,
  MailHtmlDatagram,
  MailSubjectDatagram,
  MailTextAsHTMLDatagram,
  MailTextDatagram
} from './datagrams';

/** Name of the server keypair that wraps session keys for mail crossing the server boundary. */
export const SERVER_KEY_NAME = 'decryption-service';

const SNIPPET_LENGTH = 200;

const toAddresses = (value: AddressObject | AddressObject[] | undefined): Address[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((group) => group.value)
    .filter((a) => !!a.address)
    .map((a) => ({ address: normalizeAddress(a.address!), name: a.name || null }));

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const isLocalDomain = (config: Config, address: string) =>
  config.mail.domains.includes(normalizeAddress(address).split('@')[1] ?? '');

export interface IngestResult {
  delivered: string[];
  unknown: string[];
}

/**
 * Accepts a MIME message from another mail server for the given envelope recipients. The plaintext exists only
 * in memory here: it is encrypted with a fresh session key, which is wrapped for each recipient's public key
 * (by the server keypair), exactly like a message sent by another Skiff user.
 */
export async function ingestMime(
  db: DB,
  config: Config,
  raw: Buffer,
  envelopeRecipients: string[]
): Promise<IngestResult> {
  const recipients = [...new Set(envelopeRecipients.map(normalizeAddress))];
  const users = new Map<string, { publicKey: PublicKey; address: string }>();
  const unknown: string[] = [];
  for (const address of recipients) {
    const user = getUserByAlias(db, address);
    if (!user) unknown.push(address);
    else if (!users.has(user.user_id))
      users.set(user.user_id, { publicKey: fromJSON(user.public_key_json, { key: '' }), address });
  }
  if (!users.size) return { delivered: [], unknown };

  const parsed = await simpleParser(raw);
  const sessionKey = generateSymmetricKey();
  const text = parsed.text ?? '';
  const textAsHtml = parsed.textAsHtml ?? `<p>${escapeHtml(text)}</p>`;
  const html = typeof parsed.html === 'string' ? parsed.html : textAsHtml;

  const encrypted = {
    subject: encrypt(MailSubjectDatagram, { subject: parsed.subject ?? '' }, sessionKey),
    text: encrypt(MailTextDatagram, { text }, sessionKey),
    html: encrypt(MailHtmlDatagram, { html }, sessionKey),
    textAsHtml: encrypt(MailTextAsHTMLDatagram, { textAsHTML: textAsHtml }, sessionKey),
    snippet: encrypt(MailTextDatagram, { text: text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LENGTH) }, sessionKey)
  };

  // Attachments are encrypted once with the message's session key and shared by every recipient's copy.
  fs.mkdirSync(config.attachmentsDir, { recursive: true });
  const attachments = parsed.attachments.map((a) => {
    const content = a.content.toString('base64');
    const blobPath = path.join(config.attachmentsDir, randomUUID());
    fs.writeFileSync(blobPath, encrypt(AttachmentDatagram, { content }, sessionKey));
    const disposition = a.contentDisposition === 'inline' ? 'inline' : 'attachment';
    return {
      attachmentID: randomUUID(),
      blobPath,
      encryptedMetadata: encrypt(
        AttachmentMetadataDatagram,
        {
          contentType: a.contentType,
          contentDisposition: `${disposition}; ${a.filename ? `filename="${a.filename}"` : ''}`,
          filename: a.filename ?? 'attachment',
          // Same as skemail-web: base64 SHA-256 of the base64 content.
          checksum: createHash('sha256').update(content).digest('base64'),
          size: a.size,
          contentId: a.cid ? `<${a.cid}>` : ''
        },
        sessionKey
      )
    };
  });

  const server = getOrCreateServerKey(db, SERVER_KEY_NAME);
  const references = [
    ...(parsed.inReplyTo ? [parsed.inReplyTo] : []),
    ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])
  ];
  const from = toAddresses(parsed.from)[0] ?? { address: 'unknown@invalid', name: null };
  const messageId = parsed.messageId ?? `<${randomUUID()}@${config.mail.hostname}>`;
  const emailID = randomUUID();
  const createdAt = now();

  for (const [userID, recipient] of users) {
    const wrapped = encryptSessionKey(
      sessionKey,
      server.secretKey,
      { key: server.publicKey },
      {
        key: recipient.publicKey.key
      }
    );
    deliverEmail(
      db,
      {
        emailID,
        threadID: findThreadByMessageIds(db, userID, references) ?? randomUUID(),
        userID,
        from,
        to: toAddresses(parsed.to),
        cc: toAddresses(parsed.cc),
        bcc: [],
        replyTo: toAddresses(parsed.replyTo)[0] ?? null,
        encryptedSubject: encrypted.subject,
        encryptedText: encrypted.text,
        encryptedHtml: encrypted.html,
        encryptedTextAsHtml: encrypted.textAsHtml,
        encryptedTextSnippet: encrypted.snippet,
        encryptedSessionKey: wrapped.encryptedKey,
        encryptedBy: wrapped.encryptedBy,
        createdAt,
        messageId
      },
      { addLabels: ['INBOX'], read: false },
      attachments
    );
  }
  return { delivered: [...users.values()].map((u) => u.address), unknown };
}
