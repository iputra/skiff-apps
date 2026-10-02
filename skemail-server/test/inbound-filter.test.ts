import { generateKeyPairSync } from 'crypto';
import http from 'http';
import { AddressInfo } from 'net';

import MailComposer from 'nodemailer/lib/mail-composer';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it } from 'vitest';

import { dkimSignMessage } from '../src/mail/dkim';
import { dnsblListing, Resolver } from '../src/mail/filter';
import { createInboundServer } from '../src/mail/inbound';
import { addUser, clientOperation, createTestEnv, run, TestEnv, TestUser } from './helpers';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

// A small fake internet: DNS records for a few sender domains.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const dkimTxt = `v=DKIM1; k=rsa; p=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`;
const DNS: Record<string, string[][] | string[]> = {
  // good.test: SPF allows our test client (127.0.0.1), signs with DKIM, DMARC reject.
  'good.test/TXT': [['v=spf1 ip4:127.0.0.1 -all']],
  'sel._domainkey.good.test/TXT': [[dkimTxt]],
  '_dmarc.good.test/TXT': [['v=DMARC1; p=reject']],
  // bank.test: only its own servers may send, DMARC reject. Mail "from" it via 127.0.0.1 is forged.
  'bank.test/TXT': [['v=spf1 ip4:192.0.2.1 -all']],
  '_dmarc.bank.test/TXT': [['v=DMARC1; p=reject']],
  // shop.test: same, but DMARC quarantine.
  'shop.test/TXT': [['v=spf1 ip4:192.0.2.1 -all']],
  '_dmarc.shop.test/TXT': [['v=DMARC1; p=quarantine']],
  // nodmarc.test: SPF fail and no DMARC record.
  'nodmarc.test/TXT': [['v=spf1 ip4:192.0.2.1 -all']],
  // DNSBL: 203.0.113.66 is listed, and a public resolver gets the "refused" answer.
  '66.113.0.203.zen.spamhaus.org/A': ['127.0.0.2'],
  '77.113.0.203.zen.spamhaus.org/A': ['127.255.255.254']
};
const resolver: Resolver = async (name, type) => {
  const answer = DNS[`${name.toLowerCase()}/${type}`];
  if (answer) return answer;
  throw Object.assign(new Error(`${name} not found`), { code: 'ENOTFOUND' });
};

async function setup() {
  const env = await createTestEnv();
  env.config.mail = {
    ...env.config.mail,
    domains: ['skiff.local'],
    hostname: 'mx.skiff.local',
    dnsblZones: ['zen.spamhaus.org']
  };
  const alice = await addUser(env, 'alice@skiff.local');
  const logs: string[] = [];
  const server = createInboundServer(env.db, env.config, { log: (m) => logs.push(m), resolver });
  const port = await new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve((server.server.address() as AddressInfo).port))
  );
  closers.push(() => new Promise<void>((r) => server.close(() => r())));
  return { env, alice, port, logs };
}

async function rawMessage(from: string, subject: string, sign = false) {
  const raw = await new MailComposer({ from, to: 'alice@skiff.local', subject, text: 'hello' }).compile().build();
  if (!sign) return raw;
  return dkimSignMessage(raw, {
    domain: 'good.test',
    selector: 'sel',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  });
}

const deliver = (port: number, envelopeFrom: string, raw: Buffer) =>
  nodemailer
    .createTransport({ host: '127.0.0.1', port, secure: false, ignoreTLS: true, name: 'client.test' })
    .sendMail({ envelope: { from: envelopeFrom, to: ['alice@skiff.local'] }, raw });

const threadCount = async (env: TestEnv, user: TestUser, label: string) =>
  (await run(env, clientOperation('mailbox'), { request: { label, limit: 20 } }, user.row)).data!.mailbox.threads
    .length;

describe('inbound mail filtering', () => {
  it('accepts mail that passes SPF, DKIM and DMARC into the inbox', async () => {
    const { env, alice, port, logs } = await setup();
    await deliver(port, 'news@good.test', await rawMessage('news@good.test', 'Legit', true));
    expect(await threadCount(env, alice, 'INBOX')).toBe(1);
    expect(logs.join('\n')).toMatch(/accepted news@good.test/);
  });

  it('rejects forged mail when the domain publishes DMARC p=reject', async () => {
    const { env, alice, port } = await setup();
    await expect(deliver(port, 'ceo@bank.test', await rawMessage('ceo@bank.test', 'Wire money'))).rejects.toMatchObject(
      {
        responseCode: 550,
        response: expect.stringContaining('DMARC policy of bank.test rejects this message')
      }
    );
    expect(await threadCount(env, alice, 'INBOX')).toBe(0);
    expect(await threadCount(env, alice, 'SPAM')).toBe(0);
  });

  it('puts DMARC quarantine failures and unvouched SPF failures in Spam', async () => {
    const { env, alice, port } = await setup();
    await deliver(port, 'deals@shop.test', await rawMessage('deals@shop.test', 'Cheap'));
    await deliver(port, 'x@nodmarc.test', await rawMessage('x@nodmarc.test', 'Hmm'));
    expect(await threadCount(env, alice, 'INBOX')).toBe(0);
    expect(await threadCount(env, alice, 'SPAM')).toBe(2);
  });

  it('flags IPs on a DNS blocklist, but not private ones or refused lookups', async () => {
    expect(await dnsblListing('203.0.113.66', ['zen.spamhaus.org'], resolver)).toBe('zen.spamhaus.org');
    expect(await dnsblListing('::ffff:203.0.113.66', ['zen.spamhaus.org'], resolver)).toBe('zen.spamhaus.org');
    expect(await dnsblListing('203.0.113.77', ['zen.spamhaus.org'], resolver)).toBeNull();
    expect(await dnsblListing('203.0.113.1', ['zen.spamhaus.org'], resolver)).toBeNull();
    expect(await dnsblListing('127.0.0.1', ['zen.spamhaus.org'], resolver)).toBeNull();
  });

  it('limits how many messages one IP may send per minute', async () => {
    const { env } = await setup();
    env.config.mail.inboundPerIpPerMinute = 1; // read when the server is created, so build a new one
    const server = createInboundServer(env.db, env.config, { log: () => undefined, resolver });
    const p = await new Promise<number>((resolve) =>
      server.listen(0, '127.0.0.1', () => resolve((server.server.address() as AddressInfo).port))
    );
    closers.push(() => new Promise<void>((r) => server.close(() => r())));
    await deliver(p, 'news@good.test', await rawMessage('news@good.test', 'one', true));
    await expect(deliver(p, 'news@good.test', await rawMessage('news@good.test', 'two', true))).rejects.toMatchObject({
      responseCode: 421
    });
  });

  it('follows rspamd when it is configured', async () => {
    const { env, alice, port } = await setup();
    let action = 'add header';
    const rspamd = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => res.end(JSON.stringify({ action, score: 9.5, required_score: 7 })));
    });
    await new Promise<void>((r) => rspamd.listen(0, '127.0.0.1', () => r()));
    closers.push(() => new Promise<void>((r) => rspamd.close(() => r())));
    env.config.mail.rspamdUrl = `http://127.0.0.1:${(rspamd.address() as AddressInfo).port}`;

    await deliver(port, 'news@good.test', await rawMessage('news@good.test', 'Spammy', true));
    expect(await threadCount(env, alice, 'SPAM')).toBe(1);

    action = 'reject';
    await expect(
      deliver(port, 'news@good.test', await rawMessage('news@good.test', 'Worse', true))
    ).rejects.toMatchObject({
      responseCode: 550
    });
  });
});
