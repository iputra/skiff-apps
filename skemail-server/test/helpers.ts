import type { ApolloServer } from '@apollo/server';
import fs from 'fs';
import { DefinitionNode, FragmentDefinitionNode, Kind, OperationDefinitionNode, parse, print, visit } from 'graphql';
import { Upload } from 'graphql-upload-minimal';
import path from 'path';
import { createRawJSONDatagram, encryptSessionKey, encryptSymmetric, generateSymmetricKey } from 'skiff-crypto';
import { Readable } from 'stream';

import { createAccountMaterial, PrivateUserData } from '../scripts/clientCrypto';
import { createApolloServer } from '../src/app';
import { Config, loadConfig } from '../src/config';
import { Context } from '../src/context';
import { DB, openDatabase } from '../src/db/db';
import { createUser, UserRow } from '../src/db/users';
import {
  AttachmentDatagram,
  AttachmentMetadataDatagram,
  encrypt,
  MailHtmlDatagram,
  MailSubjectDatagram,
  MailTextAsHTMLDatagram,
  MailTextDatagram
} from '../src/mail/datagrams';

export interface TestEnv {
  db: DB;
  config: Config;
  server: ApolloServer<Context>;
  cookies: Record<string, string>;
}

export async function createTestEnv(): Promise<TestEnv> {
  const db = openDatabase(':memory:');
  const config = { ...loadConfig({}), attachmentsDir: `/tmp/skemail-server-test-${process.pid}` };
  const server = createApolloServer();
  await server.start();
  return { db, config, server, cookies: {} };
}

export interface TestUser {
  row: UserRow;
  password: string;
  privateUserData: PrivateUserData;
  publicKey: { key: string; signature: string };
}

export async function addUser(env: TestEnv, username: string, password = 'password123'): Promise<TestUser> {
  const material = await createAccountMaterial(password);
  const row = createUser(env.db, { username, ...material });
  return { row, password, privateUserData: material.privateUserData, publicKey: material.publicKey };
}

/** Runs one operation as `user` (or anonymously) and returns `{ data, errors }`. */
export async function run(
  env: TestEnv,
  query: string,
  variables: Record<string, unknown> = {},
  user: UserRow | null = null
) {
  const res = {
    cookie: (name: string, value: string) => {
      env.cookies[name] = value;
    }
  };
  const response = await env.server.executeOperation(
    { query, variables },
    { contextValue: { db: env.db, config: env.config, user, res: res as never } }
  );
  if (response.body.kind !== 'single') throw new Error('Expected a single result');
  return response.body.singleResult as { data?: Record<string, any>; errors?: { message: string }[] };
}

// ---------------------------------------------------------------------------
// The exact operations skemail-web sends (docs/skemail-web-api/operations.graphql)
// ---------------------------------------------------------------------------

const OPERATIONS_FILE = path.resolve(__dirname, '../../docs/skemail-web-api/operations.graphql');
const opsDoc = parse(fs.readFileSync(OPERATIONS_FILE, 'utf8'));
const fragmentDefs = new Map(
  opsDoc.definitions
    .filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION)
    .map((d) => [d.name.value, d])
);

export const clientOperations: OperationDefinitionNode[] = opsDoc.definitions.filter(
  (d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION
);

/** Source text of a client operation plus every fragment it needs. */
export function clientOperation(name: string): string {
  const op = clientOperations.find((o) => o.name?.value === name);
  if (!op) throw new Error(`No client operation named ${name}`);
  return documentFor(op);
}

export function documentFor(op: OperationDefinitionNode): string {
  const needed = new Map<string, DefinitionNode>();
  const collect = (node: DefinitionNode) =>
    visit(node, {
      FragmentSpread(spread) {
        const name = spread.name.value;
        if (needed.has(name)) return;
        const frag = fragmentDefs.get(name)!;
        needed.set(name, frag);
        collect(frag);
      }
    });
  collect(op);
  return [op, ...needed.values()].map((d) => print(d)).join('\n\n');
}

export const TextDatagram = createRawJSONDatagram<{ text: string }>('ddl://skemail-server/test/Text');

/** Encrypts a message the way the client does: one session key, wrapped once per participant. */
export function encryptedMessage(from: TestUser, to: TestUser[], subject: string, body: string) {
  const sessionKey = generateSymmetricKey();
  const enc = (text: string) => ({ encryptedData: encryptSymmetric({ text }, sessionKey, TextDatagram) });
  const wrapFor = (user: TestUser) => {
    const { encryptedKey, encryptedBy } = encryptSessionKey(
      sessionKey,
      from.privateUserData.privateKey,
      from.publicKey,
      user.publicKey
    );
    return { encryptedSessionKey: encryptedKey, encryptedBy };
  };
  return {
    from: { address: from.row.username, name: 'Sender', encryptedSessionKey: wrapFor(from) },
    to: to.map((u) => ({ address: u.row.username, encryptedSessionKey: wrapFor(u) })),
    cc: [],
    bcc: [],
    attachments: [],
    captchaToken: '',
    rawSubject: '',
    encryptedSubject: enc(subject),
    encryptedText: enc(body),
    encryptedHtml: enc(`<p>${body}</p>`),
    encryptedTextAsHtml: enc(`<p>${body}</p>`),
    encryptedTextSnippet: enc(body.slice(0, 20))
  };
}

// ---------------------------------------------------------------------------
// Messages in skemail-web's real encrypted formats, including mail to other servers
// ---------------------------------------------------------------------------

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
export async function clientMessage(env: TestEnv, from: TestUser, to: string[], subject: string, body: string) {
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
