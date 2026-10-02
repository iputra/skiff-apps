import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLScalarType,
  isListType,
  isNonNullType,
  typeFromAST
} from 'graphql';
import { describe, expect, it } from 'vitest';

import { buildSchema } from '../src/schema';
import { addUser, clientOperations, createTestEnv, documentFor, run } from './helpers';

const schema = buildSchema(() => undefined);

/** Smallest value accepted for an input type: required fields only, empty lists. */
function dummy(type: GraphQLInputType): unknown {
  if (!isNonNullType(type)) return undefined;
  const inner = type.ofType;
  if (isListType(inner)) return [];
  if (inner instanceof GraphQLEnumType) return inner.getValues()[0].value;
  if (inner instanceof GraphQLInputObjectType) {
    return Object.fromEntries(
      Object.values(inner.getFields())
        .map((f) => [f.name, dummy(f.type)])
        .filter(([, v]) => v !== undefined)
    );
  }
  switch ((inner as GraphQLScalarType).name) {
    case 'Int':
    case 'Float':
      return 1;
    case 'Boolean':
      return false;
    case 'Date':
      return new Date().toISOString();
    case 'PublicKey':
    case 'PublicKeyWithSignature':
      return { key: 'a2V5', signature: 'c2ln' };
    case 'JSON':
      return {};
    default:
      return 'x';
  }
}

// Errors a resolver raises on purpose for nonsense input are fine; these mean the response broke the schema
// or the code crashed.
const BROKEN =
  /Cannot return null for non-nullable|cannot represent|is not a function|Cannot read properties|Expected Iterable/i;

describe('every operation skemail-web sends', () => {
  it.each(clientOperations.map((op) => [op.name!.value, op] as const))(
    '%s returns a schema-valid response',
    async (_name, op) => {
      const env = await createTestEnv();
      const alice = await addUser(env, 'alice@skiff.local');
      const variables = Object.fromEntries(
        (op.variableDefinitions ?? []).map((v) => [
          v.variable.name.value,
          dummy(typeFromAST(schema, v.type as never) as GraphQLInputType)
        ])
      );
      const { errors } = await run(env, documentFor(op), variables, alice.row);
      const broken = (errors ?? []).filter((e) => BROKEN.test(e.message));
      expect(broken).toEqual([]);
    }
  );
});
