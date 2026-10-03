import { GraphQLError } from 'graphql';
import srp from 'secure-remote-password/server';

import { Context, requireUser, SESSION_COOKIE_PREFIX } from '../context';
import { fromJSON } from '../db/db';
import {
  createSession,
  findSrpVerified,
  getSessionCacheKey,
  recordSrpVerified,
  saveSrpChallenge,
  takeSrpChallenge
} from '../db/misc';
import { createUser, getUserByAlias, getUserByUsername, normalizeAddress, updateSrp, UserRow } from '../db/users';
import type {
  LoginSrpRequest,
  MutationLoginSrpArgs,
  MutationProvisionSrpArgs,
  MutationUpdateSrpArgs
} from '../generated/graphql';
import { isMfaEnabled, verifyMfaToken } from '../mfa';

/** Starts a session and returns its cache key, which the client uses to encrypt its local session cache. */
function setSessionCookie(ctx: Context, user: UserRow): string {
  const { sessionID, cacheKey } = createSession(ctx.db, user.user_id);
  ctx.res?.cookie(SESSION_COOKIE_PREFIX + user.user_id, sessionID, {
    httpOnly: true,
    sameSite: ctx.config.cookieSecure ? 'none' : 'lax',
    secure: ctx.config.cookieSecure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  });
  return cacheKey;
}

/**
 * Lets a reloaded page decrypt the session cache it wrote at login (skemail-web useCachedLogin.ts).
 * The key belongs to the session in the caller's cookie, so it is only handed back to that session.
 */
function sessionCache(_: unknown, __: unknown, ctx: Context) {
  const user = requireUser(ctx);
  const sessionID = ctx.req?.cookies?.[SESSION_COOKIE_PREFIX + user.user_id];
  const cacheKey = sessionID ? getSessionCacheKey(ctx.db, sessionID) : null;
  if (!cacheKey) throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  return { cacheKey, alternativeCacheKeys: [] };
}

export type SrpCheck =
  | { status: 'AUTHENTICATED'; user: UserRow; serverSessionProof: string }
  | { status: 'USERNAME_INVALID' | 'AUTH_FAILURE' | 'TOKEN_NEEDED' };

/**
 * Checks a step-2 SRP request (password proof, plus the second factor when 2FA is on). Used by login and by
 * every action that asks for the password again (changing the password, managing 2FA).
 *
 * A proof is normally good for one step-1 challenge. skemail-web, though, re-sends the proof it just used for a
 * confirmation step (the password dialog checks it, then the action sends it again), so a proof that passed may
 * be checked again for a few minutes, only from a session of that same user.
 */
export function checkSrpRequest(ctx: Context, request: LoginSrpRequest): SrpCheck {
  const username = normalizeAddress(request.username);
  const user = getUserByUsername(ctx.db, username);
  if (!user) return { status: 'USERNAME_INVALID' };
  const { clientEphemeralPublic, clientSessionProof } = request;
  if (!clientEphemeralPublic || !clientSessionProof) return { status: 'AUTH_FAILURE' };

  let serverSessionProof =
    ctx.user?.user_id === user.user_id
      ? findSrpVerified(ctx.db, username, clientEphemeralPublic, clientSessionProof)
      : null;
  if (!serverSessionProof) {
    const serverSecret = takeSrpChallenge(ctx.db, username);
    if (!serverSecret) return { status: 'AUTH_FAILURE' };
    try {
      serverSessionProof = srp.deriveSession(
        serverSecret,
        clientEphemeralPublic,
        user.salt,
        username,
        user.verifier,
        clientSessionProof
      ).proof;
    } catch {
      return { status: 'AUTH_FAILURE' };
    }
    recordSrpVerified(ctx.db, username, clientEphemeralPublic, clientSessionProof, serverSessionProof);
  }

  if (isMfaEnabled(ctx.db, user.user_id)) {
    if (!request.tokenMFA) return { status: 'TOKEN_NEEDED' };
    if (!verifyMfaToken(ctx.db, user.user_id, request.tokenMFA)) return { status: 'AUTH_FAILURE' };
  }
  return { status: 'AUTHENTICATED', user, serverSessionProof };
}

/** Like checkSrpRequest, for actions on the caller's own account: the proof must be for the signed-in user. */
export function requireSrpForCurrentUser(ctx: Context, request: LoginSrpRequest | null | undefined): UserRow {
  const current = requireUser(ctx);
  const check = request ? checkSrpRequest(ctx, request) : null;
  if (check?.status !== 'AUTHENTICATED' || check.user.user_id !== current.user_id) {
    throw new GraphQLError('Password confirmation failed', { extensions: { code: 'FORBIDDEN' } });
  }
  return current;
}

/**
 * SRP login, mirroring skemail-web/src/utils/loginUtils.ts:
 * step 1 returns the salt and a server ephemeral; step 2 verifies the client proof (and the 2FA code when 2FA
 * is on), starts a session and returns the user's (still encrypted) private data.
 */
function loginSrp(_: unknown, { request }: MutationLoginSrpArgs, ctx: Context) {
  const username = normalizeAddress(request.username);
  if (request.step === 1) {
    const user = getUserByUsername(ctx.db, username);
    if (!user) return { status: 'USERNAME_INVALID' };
    const ephemeral = srp.generateEphemeral(user.verifier);
    saveSrpChallenge(ctx.db, username, ephemeral.secret);
    return { salt: user.salt, serverEphemeralPublic: ephemeral.public };
  }

  const check = checkSrpRequest(ctx, request);
  if (check.status === 'TOKEN_NEEDED') return { status: 'TOKEN_NEEDED', mfaTypes: ['TOTP', 'BACKUP_CODE'] };
  if (check.status !== 'AUTHENTICATED') return { status: check.status };
  const { user, serverSessionProof } = check;

  const cacheKey = setSessionCookie(ctx, user);
  return {
    status: 'AUTHENTICATED',
    serverSessionProof,
    userID: user.user_id,
    publicKey: fromJSON(user.public_key_json, { key: '' }),
    signingPublicKey: user.signing_public_key,
    encryptedUserData: user.encrypted_user_data,
    encryptedDocumentData: user.encrypted_document_data,
    publicData: fromJSON(user.public_data_json, {}),
    rootOrgID: user.root_org_id,
    mfaTypes: isMfaEnabled(ctx.db, user.user_id) ? ['TOTP', 'BACKUP_CODE'] : [],
    recoveryEmail: null,
    unverifiedRecoveryEmail: null,
    walletAddress: null,
    jwt: null,
    cacheKey
  };
}

/**
 * Creates another account (its own password, keys and inbox) with the given SRP data. In Skiff this is how org
 * admins add members; here only the accounts listed in ADMIN_USERS may do it, and only for addresses on this
 * server's own domains. Otherwise any user could take addresses like postmaster@, or open extra accounts to get
 * around the per-account sending limits.
 */
function provisionSrp(_: unknown, { request }: MutationProvisionSrpArgs, ctx: Context) {
  const admin = requireUser(ctx);
  if (!ctx.config.adminUsers.includes(admin.username)) {
    throw new GraphQLError('Only administrators can create accounts', { extensions: { code: 'FORBIDDEN' } });
  }
  const alias = normalizeAddress(request.emailAlias);
  const [localPart, domain, ...rest] = alias.split('@');
  if (rest.length || !/^[a-z0-9._+-]+$/.test(localPart ?? '') || !ctx.config.mail.domains.includes(domain ?? '')) {
    throw new GraphQLError(`Accounts can only be created on ${ctx.config.mail.domains.join(', ')}`, {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }
  if (getUserByAlias(ctx.db, alias)) throw new GraphQLError(`${alias} is already taken`);
  const { createSrpRequest: srpReq } = request;
  createUser(ctx.db, {
    username: alias,
    salt: srpReq.salt,
    verifier: srpReq.verifier,
    encryptedUserData: srpReq.encryptedUserData,
    publicKey: srpReq.publicKey,
    signingPublicKey: srpReq.signingPublicKey
  });
  return true;
}

/** Changing the password requires the current one (and the 2FA code when 2FA is on), not just a session. */
function updateSrpResolver(_: unknown, { request }: MutationUpdateSrpArgs, ctx: Context) {
  const user = requireSrpForCurrentUser(ctx, request.loginSrpRequest);
  updateSrp(ctx.db, user.user_id, {
    salt: request.salt,
    verifier: request.verifier,
    encryptedUserData: request.encryptedUserData
  });
  return { status: 'UPDATED' };
}

export const authResolvers = {
  Query: {
    sessionCache
  },
  Mutation: {
    loginSrp,
    provisionSrp,
    updateSrp: updateSrpResolver,
    clearSessionCache: () => ({ status: 'SUCCESS' })
  }
};
