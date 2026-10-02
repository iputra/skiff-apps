import fs from 'fs';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';

import { Upload } from 'graphql-upload-minimal';
import { dkimVerify } from 'mailauth/lib/dkim/verify';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { decryptSessionKey, encryptSessionKey, generateSymmetricKey } from 'skiff-crypto';
import { SMTPServer } from 'smtp-server';
import { Readable } from 'stream';
import { afterEach, describe, expect, it } from 'vitest';

import { getAttachment } from '../src/db/mail';
import {
  AttachmentDatagram,
  AttachmentMetadataDatagram,
  decrypt,
  encrypt,
  MailHtmlDatagram,
  MailSubjectDatagram,
  MailTextAsHTMLDatagram,
  MailTextDatagram
} from '../src/mail/datagrams';
import { createInboundServer } from '../src/mail/inbound';
import { dkimDnsValue, loadDkimKey } from '../src/mail/dkim';
import { processOutboundQueue } from '../src/mail/outbound';
import { addUser, clientOperation, createTestEnv, run, TestEnv, TestUser } from './helpers';

const closers: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

const listen = (server: SMTPServer) =>
  new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.server.address() as AddressInfo).port));
    closers.push(() => new Promise<void>((r) => server.close(() => r())));
  });

/** Stands in for Gmail: an SMTP server that records everything it is handed. */
async function startExternalServer(reply?: (rcpt: string) => { code: number; message: string } | null) {
  const received: { from: string; to: string[]; raw: Buffer }[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    logger: false,
    onRcptTo(address, _session, cb) {
      const r = reply?.(address.address);
      cb(r ? Object.assign(new Error(r.message), { responseCode: r.code }) : undefined);
    },
    onData(stream, session, cb) {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks)
        });
        cb();
      });
    }
  });
  return { port: await listen(server), received };
}

async function mailEnv(externalPort?: number): Promise<TestEnv> {
  const env = await createTestEnv();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skemail-mail-'));
  env.config.attachmentsDir = path.join(dir, 'attachments');
  env.config.mail = {
    ...env.config.mail,
    domains: ['skiff.local'],
    hostname: 'mail.skiff.local',
    dkimKeyFile: path.join(dir, 'dkim.pem'),
    mxOverrides: externalPort ? { 'external.test': { host: '127.0.0.1', port: externalPort } } : {}
  };
  return env;
}

function uploadOf(content: string) {
  const upload = new Upload();
  // `resolve` exists at runtime but is missing from graphql-upload-minimal's type definitions.
  (upload as unknown as { resolve(file: unknown): void }).resolve({
    filename: 'blob',
    mimetype: 'application/octet-stream',
    encoding: '7bit',
    createReadStream: () => Readable.from([Buffer.from(content)])
  });
  return upload;
}

/** A message encrypted exactly like skemail-web does, including the copy of the key for the server. */
async function clientMessage(env: TestEnv, from: TestUser, to: string[], subject: string, body: string) {
  const serverKey = (await run(env, '{ decryptionServicePublicKey }', {}, from.row)).data!.decryptionServicePublicKey;
  const sessionKey = generateSymmetricKey();
  const wrap = (key: { key: string }) => {
    const w = encryptSessionKey(sessionKey, from.privateUserData.privateKey, from.publicKey, key);
    return { encryptedSessionKey: w.encryptedKey, encryptedBy: w.encryptedBy };
  };
  const fileContent = Buffer.from('hello attachment').toString('base64');
  return {
    from: { address: from.row.username, name: 'Alice', encryptedSessionKey: wrap(from.publicKey) },
    to: to.map((address) => ({ address })),
    cc: [],
    bcc: [],
    attachments: [
      {
        encryptedContent: {
          encryptedFile: uploadOf(encrypt(AttachmentDatagram, { content: fileContent }, sessionKey))
        },
        encryptedMetadata: {
          encryptedData: encrypt(
            AttachmentMetadataDatagram,
            {
              contentType: 'text/plain',
              contentDisposition: 'attachment; filename="note.txt"',
              filename: 'note.txt',
              checksum: '',
              size: 16,
              contentId: '<abc@skiff>'
            },
            sessionKey
          )
        }
      }
    ],
    captchaToken: '',
    rawSubject: '',
    encryptedSubject: { encryptedData: encrypt(MailSubjectDatagram, { subject }, sessionKey) },
    encryptedText: { encryptedData: encrypt(MailTextDatagram, { text: body }, sessionKey) },
    encryptedHtml: { encryptedData: encrypt(MailHtmlDatagram, { html: `<p>${body}</p>` }, sessionKey) },
    encryptedTextAsHtml: { encryptedData: encrypt(MailTextAsHTMLDatagram, { textAsHTML: body }, sessionKey) },
    externalEncryptedSessionKey: wrap(serverKey)
  };
}

const inbox = async (env: TestEnv, user: TestUser, label = 'INBOX') =>
  (await run(env, clientOperation('mailbox'), { request: { label, limit: 20 } }, user.row)).data!.mailbox
    .threads as any[];

/** Full emails of a thread, as the client loads them when a thread is opened. */
const threadEmails = async (env: TestEnv, user: TestUser, threadID: string) =>
  (await run(env, clientOperation('getThreadFromID'), { threadID }, user.row)).data!.userThread.emails as any[];

const readEmail = (user: TestUser, email: any) => {
  const key = decryptSessionKey(
    email.encryptedSessionKey.encryptedSessionKey,
    user.privateUserData.privateKey,
    email.encryptedSessionKey.encryptedBy
  );
  return {
    key,
    subject: decrypt<{ subject: string }>(MailSubjectDatagram, key, email.encryptedSubject.encryptedData).subject,
    text: decrypt<{ text: string }>(MailTextDatagram, key, email.encryptedText.encryptedData).text,
    html: decrypt<{ html: string }>(MailHtmlDatagram, key, email.encryptedHtml.encryptedData).html
  };
};

const sendInbound = (port: number, mail: Record<string, unknown>) =>
  nodemailer
    .createTransport({ host: '127.0.0.1', port, secure: false, ignoreTLS: true })
    .sendMail({ from: 'Friend <friend@external.test>', ...mail });

describe('mail to other servers', () => {
  it('delivers a DKIM-signed MIME message with the decrypted content and attachment', async () => {
    const external = await startExternalServer();
    const env = await mailEnv(external.port);
    const alice = await addUser(env, 'alice@skiff.local');

    const message = await clientMessage(env, alice, ['friend@external.test'], 'Hello outside', 'Plain body');
    const sent = await run(env, clientOperation('sendMessage'), { request: message }, alice.row);
    expect(sent.errors).toBeUndefined();

    await processOutboundQueue(env.db, env.config, () => undefined);
    expect(external.received).toHaveLength(1);
    const { from, to, raw } = external.received[0];
    expect(from).toBe('alice@skiff.local');
    expect(to).toEqual(['friend@external.test']);

    const mime = await simpleParser(raw);
    expect(mime.subject).toBe('Hello outside');
    expect(mime.text?.trim()).toBe('Plain body');
    expect(mime.html).toContain('<p>Plain body</p>');
    expect(mime.messageId).toBe(`<${sent.data!.sendMessage.messageID}@skiff.local>`);
    expect(mime.attachments[0].filename).toBe('note.txt');
    expect(mime.attachments[0].content.toString()).toBe('hello attachment');
    const dkim = mime.headers.get('dkim-signature') as { value: string; params: Record<string, string> } | undefined;
    expect(dkim?.params.d).toBe('skiff.local');
    expect(dkim?.params.s).toBe('skemail');

    // A receiving server that looks up skemail._domainkey.skiff.local (the record `yarn dns` prints) accepts it.
    const txt = dkimDnsValue(loadDkimKey(env.config.mail));
    const resolver = async (name: string, type: string) => {
      if (name === 'skemail._domainkey.skiff.local' && type === 'TXT') return [[txt]];
      throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
    };
    const verification = await dkimVerify(raw, { resolver });
    expect(verification.results.map((r: { status: { result: string } }) => r.status.result)).toEqual(['pass']);
  });

  it('retries temporary failures and bounces permanent ones into the sender inbox', async () => {
    const external = await startExternalServer((rcpt) =>
      rcpt.startsWith('gone') ? { code: 550, message: '5.1.1 User unknown' } : null
    );
    const env = await mailEnv(external.port);
    const alice = await addUser(env, 'alice@skiff.local');

    // Permanent: the remote server rejects the recipient.
    const gone = await clientMessage(env, alice, ['gone@external.test'], 'To nobody', 'x');
    await run(env, clientOperation('sendMessage'), { request: gone }, alice.row);
    // Temporary: a domain whose server cannot be reached.
    env.config.mail.mxOverrides['down.test'] = { host: '127.0.0.1', port: 1 };
    const down = await clientMessage(env, alice, ['someone@down.test'], 'To a down server', 'x');
    await run(env, clientOperation('sendMessage'), { request: down }, alice.row);

    await processOutboundQueue(env.db, env.config, () => undefined);
    const jobs = env.db.prepare('SELECT domain, status, attempts FROM outbound_queue ORDER BY domain').all();
    expect(jobs).toEqual([
      { domain: 'down.test', status: 'pending', attempts: 1 },
      { domain: 'external.test', status: 'failed', attempts: 1 }
    ]);

    const threads = await inbox(env, alice);
    expect(threads).toHaveLength(1);
    const bounce = readEmail(alice, (await threadEmails(env, alice, threads[0].threadID)).at(-1));
    expect(bounce.subject).toBe('Undelivered Mail Returned to Sender');
    expect(bounce.text).toContain('gone@external.test');
    expect(bounce.text).toContain('User unknown');
  });

  it('bounces mail to a non-existent user on our own domain without touching the network', async () => {
    const env = await mailEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const message = await clientMessage(env, alice, ['typo@skiff.local'], 'Hi', 'x');
    await run(env, clientOperation('sendMessage'), { request: message }, alice.row);
    await processOutboundQueue(env.db, env.config, () => undefined);
    const [thread] = await inbox(env, alice);
    expect(readEmail(alice, (await threadEmails(env, alice, thread.threadID)).at(-1)).text).toContain(
      'No such user here: typo@skiff.local'
    );
  });
});

describe('mail from other servers', () => {
  it('encrypts incoming mail for the recipient and threads replies to messages we sent', async () => {
    const external = await startExternalServer();
    const env = await mailEnv(external.port);
    const alice = await addUser(env, 'alice@skiff.local');
    const smtpPort = await listen(createInboundServer(env.db, env.config, () => undefined));

    // Alice writes to a friend outside...
    const sent = await run(
      env,
      clientOperation('sendMessage'),
      { request: await clientMessage(env, alice, ['friend@external.test'], 'Lunch?', 'Tomorrow at 12?') },
      alice.row
    );
    await processOutboundQueue(env.db, env.config, () => undefined);
    const outgoingId = (await simpleParser(external.received[0].raw)).messageId;

    // ...who replies from their own mail server, with an attachment.
    await sendInbound(smtpPort, {
      to: 'alice@skiff.local',
      subject: 'Re: Lunch?',
      text: 'Sounds good!',
      html: '<b>Sounds good!</b>',
      inReplyTo: outgoingId,
      references: [outgoingId],
      attachments: [{ filename: 'menu.txt', content: 'soup' }]
    });

    const threads = await inbox(env, alice);
    expect(threads).toHaveLength(1);
    expect(threads[0].threadID).toBe(sent.data!.sendMessage.threadID);
    expect(threads[0].attributes.read).toBe(false);
    const reply = (await threadEmails(env, alice, threads[0].threadID)).at(-1);
    expect(reply.from).toMatchObject({ address: 'friend@external.test', name: 'Friend' });
    const decrypted = readEmail(alice, reply);
    expect(decrypted).toMatchObject({ subject: 'Re: Lunch?', text: 'Sounds good!', html: '<b>Sounds good!</b>' });

    // The attachment can be opened with the same session key, in the format skemail-web expects.
    const { attachmentID, encryptedData } = reply.attachmentMetadata[0];
    const meta = decrypt<{ filename: string; contentType: string }>(
      AttachmentMetadataDatagram,
      decrypted.key,
      encryptedData.encryptedData
    );
    expect(meta).toMatchObject({ filename: 'menu.txt', contentType: 'text/plain' });
    const blob = fs.readFileSync(getAttachment(env.db, alice.row.user_id, attachmentID)!.blob_path, 'utf8');
    const content = decrypt<{ content: string }>(AttachmentDatagram, decrypted.key, blob).content;
    expect(Buffer.from(content, 'base64').toString()).toBe('soup');
  });

  it('refuses to relay and rejects unknown local users', async () => {
    const env = await mailEnv();
    await addUser(env, 'alice@skiff.local');
    const smtpPort = await listen(createInboundServer(env.db, env.config, () => undefined));

    await expect(sendInbound(smtpPort, { to: 'victim@gmail.com', text: 'spam' })).rejects.toMatchObject({
      responseCode: 554
    });
    await expect(sendInbound(smtpPort, { to: 'nobody@skiff.local', text: 'hi' })).rejects.toMatchObject({
      responseCode: 550
    });
  });
});
