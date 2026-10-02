import type { Request, Response } from 'express';
import { GraphQLError } from 'graphql';

import { Config } from './config';
import { DB } from './db/db';
import { getSessionUserID } from './db/misc';
import { getUserByID, UserRow } from './db/users';

/** Header the client sets to pick which of its logged-in accounts a request is for (skiff-utils). */
export const USER_ID_HEADER = 'x-skiff-userid';
export const SESSION_COOKIE_PREFIX = 'skiff_session_';

export interface Context {
  db: DB;
  config: Config;
  req?: Request;
  res?: Response;
  user: UserRow | null;
}

/**
 * Resolves the caller. The client can be logged into several accounts at once, so there is one session
 * cookie per userID and the `x-skiff-userid` header selects which one applies.
 */
export function resolveUser(db: DB, cookies: Record<string, string>, headerUserID?: string): UserRow | null {
  const candidates = headerUserID
    ? [headerUserID]
    : Object.keys(cookies)
        .filter((name) => name.startsWith(SESSION_COOKIE_PREFIX))
        .map((name) => name.slice(SESSION_COOKIE_PREFIX.length));
  // Without the header we can only pick a session when it is unambiguous.
  if (candidates.length !== 1) return null;
  const userID = candidates[0];
  const sessionID = cookies[SESSION_COOKIE_PREFIX + userID];
  if (!sessionID || getSessionUserID(db, sessionID) !== userID) return null;
  return getUserByID(db, userID) ?? null;
}

export function requireUser(ctx: Context): UserRow {
  if (!ctx.user) {
    throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return ctx.user;
}
