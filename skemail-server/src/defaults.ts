import { MapperKind, mapSchema } from '@graphql-tools/utils';
import {
  GraphQLEnumType,
  GraphQLFieldResolver,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  isAbstractType,
  isListType,
  isNonNullType,
  isObjectType
} from 'graphql';

const ROOT_TYPES = new Set(['Query', 'Mutation', 'Subscription']);
const warned = new Set<string>();

/**
 * The smallest value that satisfies `type`. Non-null objects become `{}`, whose own fields are in turn
 * filled in by `withDefaults`, so deep non-null chains (e.g. `User.rootOrganization!`) stay valid.
 */
export function defaultValueFor(type: GraphQLOutputType): unknown {
  if (!isNonNullType(type)) return null;
  const inner = type.ofType;
  if (isListType(inner)) return [];
  if (inner instanceof GraphQLEnumType) return inner.getValues()[0]?.value ?? null;
  if (inner instanceof GraphQLScalarType) {
    switch (inner.name) {
      case 'String':
      case 'ID':
        return '';
      case 'Int':
      case 'Float':
        return 0;
      case 'Boolean':
        return false;
      case 'Date':
        return new Date(0);
      case 'PublicKey':
      case 'PublicKeyWithSignature':
        return { key: '' };
      case 'JSON':
        return {};
      default:
        return '';
    }
  }
  if (isObjectType(inner)) return {};
  if (isAbstractType(inner)) return null;
  return null;
}

/**
 * Gives every field without a resolver a type-safe fallback:
 * - root fields (Query/Mutation) return `defaultValueFor` and log `[stub]` once, so you can see which
 *   endpoints the UI hits that are not implemented yet;
 * - other fields read the property from their parent and fall back to `defaultValueFor` when it is missing.
 */
export function withDefaults(schema: GraphQLSchema, log: (msg: string) => void = console.warn): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
      if (fieldConfig.resolve) return fieldConfig;
      const isRoot = ROOT_TYPES.has(typeName);
      const resolve: GraphQLFieldResolver<Record<string, unknown> | undefined, unknown> = (parent) => {
        if (isRoot) {
          const key = `${typeName}.${fieldName}`;
          if (!warned.has(key)) {
            warned.add(key);
            log(`[stub] ${key} is not implemented; returning a default value`);
          }
          return defaultValueFor(fieldConfig.type);
        }
        const value = parent?.[fieldName];
        return value === undefined ? defaultValueFor(fieldConfig.type) : value;
      };
      return { ...fieldConfig, resolve };
    }
  });
}
