import { X509Certificate } from 'crypto';
import fs from 'fs';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';

import { SMTPServer } from 'smtp-server';
import { afterEach, describe, expect, it } from 'vitest';

import { parsePolicy } from 'mailauth/lib/mta-sts';

import { createApp } from '../src/app';
import { OutboundDeps, processOutboundQueue } from '../src/mail/outbound';
import { MtaStsPolicy, mtaStsPolicyFor, parseTlsa, SecureAnswer, tlsaDigest } from '../src/mail/tls-policy';
import { addUser, clientMessage, clientOperation, createTestEnv, run, TestEnv } from './helpers';

// Self-signed certificate the fake remote server presents for STARTTLS (see fixtures/README.md).
const FIXTURES = path.join(__dirname, 'fixtures');
const remoteTls = {
  key: fs.readFileSync(path.join(FIXTURES, 'remote-mx.key')),
  cert: fs.readFileSync(path.join(FIXTURES, 'remote-mx.crt'))
};
const remoteCert = new X509Certificate(remoteTls.cert);
const DANE_EE = `3 1 1 ${tlsaDigest(remoteCert, 1, 1)}`;

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (closers.length) await closers.pop()!();
});

async function remoteServer(starttls = true) {
  const received: string[] = [];
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: starttls ? ['AUTH'] : ['AUTH', 'STARTTLS'],
    ...remoteTls,
    logger: false,
    onData(stream, session, cb) {
      stream.resume();
      stream.on('end', () => {
        received.push(session.envelope.rcptTo.map((r) => r.address).join(','));
        cb();
      });
    }
  });
  const port = await new Promise<number>((r) =>
    server.listen(0, '127.0.0.1', () => r((server.server.address() as AddressInfo).port))
  );
  closers.push(() => new Promise<void>((r) => server.close(() => r())));
  return { port, received };
}

async function setup(host: string, port: number) {
  const env = await createTestEnv();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skemail-tls-'));
  env.config.mail = {
    ...env.config.mail,
    domains: ['skiff.local'],
    dkimKeyFile: path.join(dir, 'dkim.pem'),
    mxOverrides: { 'remote.test': { host, port } }
  };
  env.config.attachmentsDir = path.join(dir, 'attachments');
  const alice = await addUser(env, 'alice@skiff.local');
  const send = async () =>
    run(
      env,
      clientOperation('sendMessage'),
      { request: await clientMessage(env, alice, ['bob@remote.test'], 'Hi', 'Body') },
      alice.row
    );
  return { env, alice, send };
}

/** Fake DNS for DANE: TLSA answers for the remote host, DNSSEC-validated unless `secure` is false. */
const daneDeps = (
  records: string[],
  secure = true,
  policy: MtaStsPolicy = { id: false, mode: 'none' }
): OutboundDeps => ({
  secureResolver: async (name, type): Promise<SecureAnswer> =>
    type === 'TLSA' && /^_\d+\._tcp\./.test(name) ? { answers: records, secure } : { answers: [], secure },
  mtaSts: async () => policy
});

const deliverOnce = async (env: TestEnv, deps: OutboundDeps) => {
  const logs: string[] = [];
  await processOutboundQueue(env.db, env.config, (m) => logs.push(m), deps);
  return logs.join('\n');
};

const job = (env: TestEnv) =>
  env.db.prepare('SELECT status, last_error FROM outbound_queue').get() as {
    status: string;
    last_error: string | null;
  };

describe('parseTlsa', () => {
  it('reads both the presentation and the RFC 3597 generic form', () => {
    expect(parseTlsa('3 1 1 ABCDEF')).toEqual({ usage: 3, selector: 1, matching: 1, data: 'abcdef' });
    expect(parseTlsa('\\# 6 030101 abcdef')).toEqual({ usage: 3, selector: 1, matching: 1, data: 'abcdef' });
  });
});

describe('DANE', () => {
  it('delivers when the certificate matches a DNSSEC-signed TLSA record', async () => {
    const remote = await remoteServer();
    const { env, send } = await setup('127.0.0.1', remote.port);
    await send();
    const log = await deliverOnce(env, daneDeps([DANE_EE]));
    expect(remote.received).toEqual(['bob@remote.test']);
    expect(log).toMatch(/\(DANE\)/);
  });

  it('refuses a certificate that does not match, and keeps the message queued', async () => {
    const remote = await remoteServer();
    const { env, send } = await setup('127.0.0.1', remote.port);
    await send();
    await deliverOnce(env, daneDeps([`3 1 1 ${'00'.repeat(32)}`]));
    expect(remote.received).toEqual([]);
    expect(job(env)).toMatchObject({
      status: 'pending',
      last_error: expect.stringMatching(/does not match its DANE TLSA/)
    });
  });

  it('refuses a server that cannot do STARTTLS when TLSA records exist', async () => {
    const remote = await remoteServer(false);
    const { env, send } = await setup('127.0.0.1', remote.port);
    await send();
    await deliverOnce(env, daneDeps([DANE_EE]));
    expect(remote.received).toEqual([]);
    expect(job(env).status).toBe('pending');
  });

  it('ignores TLSA records that were not DNSSEC-validated', async () => {
    const remote = await remoteServer();
    const { env, send } = await setup('127.0.0.1', remote.port);
    await send();
    const log = await deliverOnce(env, daneDeps([`3 1 1 ${'00'.repeat(32)}`], false));
    expect(remote.received).toEqual(['bob@remote.test']);
    expect(log).toMatch(/\(TLS\)/);
  });

  it('supports DANE-TA (usage 2) with a name check against the MX host', async () => {
    const remote = await remoteServer();
    const ta = `2 0 1 ${tlsaDigest(remoteCert, 0, 1)}`;
    const ok = await setup('localhost', remote.port);
    await ok.send();
    expect(await deliverOnce(ok.env, daneDeps([ta]))).toMatch(/\(DANE\)/);
  });
});

describe('MTA-STS', () => {
  const enforce: MtaStsPolicy = { id: '1', mode: 'enforce', mx: ['mx.remote.test'], maxAge: 86400 };

  it('skips MX hosts the enforce policy does not list', async () => {
    const remote = await remoteServer();
    const { env, send } = await setup('127.0.0.1', remote.port);
    await send();
    await deliverOnce(env, daneDeps([], true, enforce));
    expect(remote.received).toEqual([]);
    expect(job(env).last_error).toMatch(/not listed in the MTA-STS policy/);
  });

  it('requires a publicly trusted certificate in enforce mode, but only logs in testing mode', async () => {
    const remote = await remoteServer();
    const listed = { ...enforce, mx: ['127.0.0.1'] };
    const strict = await setup('127.0.0.1', remote.port);
    await strict.send();
    await deliverOnce(strict.env, daneDeps([], true, listed));
    expect(remote.received).toEqual([]);
    expect(job(strict.env).last_error).toMatch(/no valid TLS certificate/);

    const lenient = await setup('127.0.0.1', remote.port);
    await lenient.send();
    const log = await deliverOnce(lenient.env, daneDeps([], true, { ...listed, mode: 'testing' }));
    expect(remote.received).toEqual(['bob@remote.test']);
    expect(log).toMatch(/MTA-STS testing: 127.0.0.1 has no valid TLS certificate/);
  });

  it('caches a policy for its max_age', async () => {
    const env = await createTestEnv();
    let fetches = 0;
    const fetcher = async (): Promise<MtaStsPolicy> => {
      fetches++;
      return { ...enforce, expires: new Date(Date.now() + 86400_000).toISOString() };
    };
    await mtaStsPolicyFor(env.db, 'remote.test', fetcher);
    const cached = await mtaStsPolicyFor(env.db, 'remote.test', fetcher);
    expect(fetches).toBe(1);
    expect(cached.mode).toBe('enforce');
  });
});

describe('our own MTA-STS policy', () => {
  it('is served at /.well-known/mta-sts.txt and parses as a valid policy', async () => {
    const env = await createTestEnv();
    env.config.mail = { ...env.config.mail, hostname: 'mail.example.com', mtaStsMode: 'enforce', mtaStsMaxAge: 86400 };
    const { app, server } = await createApp(env.db, env.config);
    const http = app.listen(0);
    closers.push(async () => {
      http.close();
      await server.stop();
    });
    const port = (http.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/mta-sts.txt`);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(parsePolicy(await res.text())).toMatchObject({ mode: 'enforce', mx: ['mail.example.com'], maxAge: 86400 });
  });
});
