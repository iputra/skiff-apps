import { Context, requireUser } from '../context';
import { fromJSON } from '../db/db';
import { getOrCreateServerKey, getPreferences, setPreferences } from '../db/misc';
import {
  getAliases,
  getDefaultAlias,
  getUserByAlias,
  getUserByID,
  getUserByUsername,
  setDefaultAlias,
  toGraphQLUser,
  UserRow
} from '../db/users';
import { SERVER_KEY_NAME } from '../mail/ingest';
import type {
  MutationSetDefaultEmailAliasArgs,
  MutationSetUserPreferencesArgs,
  QueryAliasDisplayInfoArgs,
  QueryOrgMemberDefaultEmailAliasArgs,
  QueryOrgMemberEmailAliasesArgs,
  QueryUserArgs,
  QueryUsersArgs,
  QueryUsersFromEmailAliasArgs
} from '../generated/graphql';

const asUser = (ctx: Context, row: UserRow | undefined | null) => (row ? toGraphQLUser(ctx.db, row) : null);

/** Must return one entry per requested alias, in order (`null` when unknown): the client matches by index. */
const usersFromEmailAlias = (_: unknown, { emailAliases }: QueryUsersFromEmailAliasArgs, ctx: Context) => {
  requireUser(ctx);
  return emailAliases.map((alias) => asUser(ctx, getUserByAlias(ctx.db, alias)));
};

export const userResolvers = {
  Query: {
    currentUser: (_: unknown, __: unknown, ctx: Context) => (ctx.user ? toGraphQLUser(ctx.db, ctx.user) : null),
    user: (_: unknown, { request }: QueryUserArgs, ctx: Context) => {
      if (request.userID) return asUser(ctx, getUserByID(ctx.db, request.userID));
      if (request.username) return asUser(ctx, getUserByUsername(ctx.db, request.username));
      return null;
    },
    users: (_: unknown, { request }: QueryUsersArgs, ctx: Context) =>
      request.userIDs.map((id) => getUserByID(ctx.db, id)).flatMap((row) => (row ? [toGraphQLUser(ctx.db, row)] : [])),
    usersFromEmailAlias,
    usersFromEmailAliasWithCatchall: usersFromEmailAlias,
    aliasDisplayInfo: (_: unknown, { emailAlias }: QueryAliasDisplayInfoArgs, ctx: Context) => {
      const row = getUserByAlias(ctx.db, emailAlias);
      if (!row) return null;
      const publicData = fromJSON<{ displayName?: string }>(row.public_data_json, {});
      return { displayName: publicData.displayName ?? null, displayPictureData: null };
    },
    fullAliasInfo: (_: unknown, __: unknown, ctx: Context) => {
      const user = requireUser(ctx);
      return getAliases(ctx.db, user.user_id).map((a) => ({
        emailAlias: a.alias,
        displayName: a.display_name,
        createdAt: new Date(user.created_at),
        areNotificationsEnabled: true,
        displayPictureData: null,
        encryptedAliasData: null,
        encryptedByKey: null,
        encryptedSessionKey: null
      }));
    },
    orgMemberDefaultEmailAlias: (_: unknown, { userID }: QueryOrgMemberDefaultEmailAliasArgs, ctx: Context) =>
      getDefaultAlias(ctx.db, userID),
    orgMemberEmailAliases: (_: unknown, { userID }: QueryOrgMemberEmailAliasesArgs, ctx: Context) =>
      getAliases(ctx.db, userID).map((a) => a.alias),
    userPreferences: (_: unknown, __: unknown, ctx: Context) => getPreferences(ctx.db, requireUser(ctx).user_id),
    decryptionServicePublicKey: (_: unknown, __: unknown, ctx: Context) => ({
      key: getOrCreateServerKey(ctx.db, SERVER_KEY_NAME).publicKey
    })
  },
  Mutation: {
    setUserPreferences: (_: unknown, { request }: MutationSetUserPreferencesArgs, ctx: Context) =>
      setPreferences(ctx.db, requireUser(ctx).user_id, request as Record<string, unknown>),
    setDefaultEmailAlias: (_: unknown, { request }: MutationSetDefaultEmailAliasArgs, ctx: Context) =>
      request ? setDefaultAlias(ctx.db, requireUser(ctx).user_id, request.defaultAlias) : false
  }
};
