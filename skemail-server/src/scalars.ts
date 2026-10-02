import { GraphQLError, GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { GraphQLUpload } from 'graphql-upload-minimal';

const toDate = (value: unknown): Date => {
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) throw new GraphQLError(`Invalid Date: ${String(value)}`);
  return date;
};

/** Sent as an ISO string; the client's type policies turn it back into a Date. Accepts strings or epoch ms. */
const DateScalar = new GraphQLScalarType({
  name: 'Date',
  serialize: (value) => toDate(value).toISOString(),
  parseValue: toDate,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) return toDate(ast.value);
    if (ast.kind === Kind.INT) return toDate(Number(ast.value));
    throw new GraphQLError('Date literal must be a string or integer');
  }
});

function literalToValue(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
    case Kind.ENUM:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(literalToValue);
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((f) => [f.name.value, literalToValue(f.value)]));
    default:
      return undefined;
  }
}

const passThrough = (name: string) =>
  new GraphQLScalarType({
    name,
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral: literalToValue
  });

export const scalarResolvers = {
  Date: DateScalar,
  JSON: passThrough('JSON'),
  /** `{ key: string, signature?: string }` objects, as produced by skiff-crypto. */
  PublicKey: passThrough('PublicKey'),
  PublicKeyWithSignature: passThrough('PublicKeyWithSignature'),
  Void: new GraphQLScalarType({
    name: 'Void',
    serialize: () => null,
    parseValue: () => null,
    parseLiteral: () => null
  }),
  Upload: GraphQLUpload
};
