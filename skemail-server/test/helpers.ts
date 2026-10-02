import type { ApolloServer } from '@apollo/server';

import { createApolloServer } from '../src/app';
import { Config, loadConfig } from '../src/config';
import { Context } from '../src/context';
import { DB, openDatabase } from '../src/db/db';
import { createUser, UserRow } from '../src/db/users';
import { createAccountMaterial, PrivateUserData } from '../scripts/clientCrypto';

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

import fs from 'fs';
import path from 'path';

import { DefinitionNode, FragmentDefinitionNode, Kind, OperationDefinitionNode, parse, print, visit } from 'graphql';

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
