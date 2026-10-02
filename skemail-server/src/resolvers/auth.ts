import { GraphQLError } from 'graphql';
import srp from 'secure-remote-password/server';

import { Context, requireUser, SESSION_COOKIE_PREFIX } from '../context';
import { fromJSON } from '../db/db';
import { createSession, saveSrpChallenge, takeSrpChallenge } from '../db/misc';
import { createUser, getUserByAlias, getUserByUsername, normalizeAddress, updateSrp, UserRow } from '../db/users';
import type { MutationLoginSrpArgs, MutationProvisionSrpArgs, MutationUpdateSrpArgs } from '../generated/graphql';

function setSessionCookie(ctx: Context, user: UserRow) {
  const sessionID = createSession(ctx.db, user.user_id);
  ctx.res?.cookie(SESSION_COOKIE_PREFIX + user.user_id, sessionID, {
    httpOnly: true,
    sameSite: ctx.config.cookieSecure ? 'none' : 'lax',
    secure: ctx.config.cookieSecure,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

/**
 * SRP login, mirroring skemail-web/src/utils/loginUtils.ts:
 * step 1 returns the salt and a server ephemeral; step 2 verifies the client proof, starts a session and
 * returns the user's (still encrypted) private data.
 */
function loginSrp(_: unknown, { request }: MutationLoginSrpArgs, ctx: Context) {
  const username = normalizeAddress(request.username);
  const user = getUserByUsername(ctx.db, username);
  if (!user) return { status: 'USERNAME_INVALID' };

  if (request.step === 1) {
    const ephemeral = srp.generateEphemeral(user.verifier);
    saveSrpChallenge(ctx.db, username, ephemeral.secret);
    return { salt: user.salt, serverEphemeralPublic: ephemeral.public };
  }

  const serverSecret = takeSrpChallenge(ctx.db, username);
  if (!serverSecret || !request.clientEphemeralPublic || !request.clientSessionProof) {
    return { status: 'AUTH_FAILURE' };
  }
  let serverSessionProof: string;
  try {
    serverSessionProof = srp.deriveSession(
      serverSecret,
      request.clientEphemeralPublic,
      user.salt,
      username,
      user.verifier,
      request.clientSessionProof
    ).proof;
  } catch {
    return { status: 'AUTH_FAILURE' };
  }

  setSessionCookie(ctx, user);
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
    mfaTypes: [],
    recoveryEmail: null,
    unverifiedRecoveryEmail: null,
    walletAddress: null,
    jwt: null,
    cacheKey: null
  };
}

/** Org admins provision accounts for others; here it simply creates the user with the given SRP data. */
function provisionSrp(_: unknown, { request }: MutationProvisionSrpArgs, ctx: Context) {
  requireUser(ctx);
  const alias = normalizeAddress(request.emailAlias);
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

function updateSrpResolver(_: unknown, { request }: MutationUpdateSrpArgs, ctx: Context) {
  const user = requireUser(ctx);
  updateSrp(ctx.db, user.user_id, {
    salt: request.salt,
    verifier: request.verifier,
    encryptedUserData: request.encryptedUserData
  });
  return { status: 'UPDATED' };
}

export const authResolvers = {
  Mutation: {
    loginSrp,
    provisionSrp,
    updateSrp: updateSrpResolver,
    clearSessionCache: () => ({ status: 'SUCCESS' })
  }
};
