import fs from 'fs';
import path from 'path';

import { makeExecutableSchema } from '@graphql-tools/schema';

import { withDefaults } from './defaults';
import { attachmentResolvers } from './resolvers/attachments';
import { authResolvers } from './resolvers/auth';
import { contactResolvers } from './resolvers/contacts';
import { draftResolvers } from './resolvers/drafts';
import { mailboxResolvers } from './resolvers/mailbox';
import { sendResolvers } from './resolvers/send';
import { userResolvers } from './resolvers/user';
import { scalarResolvers } from './scalars';

/** The contract generated from skemail-web by scripts/skemail-api-spec (see docs/skemail-web-api). */
export const SCHEMA_PATH = path.resolve(__dirname, '../../docs/skemail-web-api/schema.graphql');

type ResolverMap = Record<string, Record<string, unknown>>;

const resolverModules: ResolverMap[] = [
  authResolvers,
  userResolvers,
  mailboxResolvers,
  sendResolvers,
  draftResolvers,
  contactResolvers,
  attachmentResolvers
];

function mergeResolvers(modules: ResolverMap[]): ResolverMap {
  const merged: ResolverMap = {};
  for (const mod of modules) {
    for (const [typeName, fields] of Object.entries(mod)) {
      for (const fieldName of Object.keys(fields)) {
        if (merged[typeName]?.[fieldName]) throw new Error(`Duplicate resolver ${typeName}.${fieldName}`);
      }
      merged[typeName] = { ...merged[typeName], ...fields };
    }
  }
  return merged;
}

export function buildSchema(log?: (msg: string) => void) {
  const typeDefs = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: { ...scalarResolvers, ...mergeResolvers(resolverModules) }
  });
  return withDefaults(schema, log);
}
