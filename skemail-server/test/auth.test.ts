import { describe, expect, it } from 'vitest';

import { createAccountMaterial, srpLogin } from '../scripts/clientCrypto';
import { getUserByAlias } from '../src/db/users';
import { addUser, clientOperation, createTestEnv, run } from './helpers';

const LOGIN = `mutation login($request: LoginSrpRequest!) {
  loginSrp(request: $request) {
    status salt serverEphemeralPublic serverSessionProof userID encryptedUserData signingPublicKey rootOrgID
    publicKey publicData { displayName }
  }
}`;

describe('SRP login', () => {
  it('authenticates with the right password and hands back decryptable user data', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'Alice@Skiff.local');
    const call = async (request: Record<string, unknown>) => {
      const { data, errors } = await run(env, LOGIN, { request });
      expect(errors).toBeUndefined();
      return data!.loginSrp;
    };

    const { step2, privateUserData } = await srpLogin('alice@skiff.local', 'password123', call);
    expect(step2.status).toBe('AUTHENTICATED');
    expect(step2.userID).toBe(alice.row.user_id);
    expect(privateUserData).toEqual(alice.privateUserData);
    expect(env.cookies[`skiff_session_${alice.row.user_id}`]).toBeTruthy();
  });

  it('returns a session cache key at login and hands it back only to that session', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const call = async (request: Record<string, unknown>) =>
      (await run(env, LOGIN.replace('rootOrgID', 'rootOrgID cacheKey'), { request })).data!.loginSrp;

    const { step2 } = await srpLogin('alice@skiff.local', 'password123', call);
    expect(step2.cacheKey).toMatch(/^[A-Za-z0-9+/]{43}=$/);

    const sessionCache = async (cookies: Record<string, string>) => {
      const response = await env.server.executeOperation(
        { query: '{ sessionCache { cacheKey alternativeCacheKeys } }' },
        { contextValue: { db: env.db, config: env.config, user: alice.row, req: { cookies } as never } }
      );
      if (response.body.kind !== 'single') throw new Error('Expected a single result');
      return response.body.singleResult;
    };

    const own = await sessionCache(env.cookies);
    expect(own.errors).toBeUndefined();
    expect(own.data!.sessionCache).toEqual({ cacheKey: step2.cacheKey, alternativeCacheKeys: [] });

    const forged = await sessionCache({ [`skiff_session_${alice.row.user_id}`]: 'not-a-session' });
    expect(forged.errors?.[0].message).toBe('Not authenticated');
  });

  it('lets only ADMIN_USERS create accounts, and only on this server’s domains', async () => {
    const env = await createTestEnv();
    env.config = { ...env.config, adminUsers: ['admin@skiff.local'] };
    const admin = await addUser(env, 'admin@skiff.local');
    const alice = await addUser(env, 'alice@skiff.local');
    const material = await createAccountMaterial('new-password');
    const provision = (emailAlias: string, as = admin) =>
      run(
        env,
        clientOperation('provisionSrp'),
        {
          request: {
            emailAlias,
            newUserID: '00000000-0000-4000-8000-000000000000',
            createSrpRequest: {
              captchaToken: '',
              salt: material.salt,
              verifier: material.verifier,
              encryptedUserData: material.encryptedUserData,
              publicKey: material.publicKey,
              signingPublicKey: material.signingPublicKey,
              userAttributionData: {}
            },
            shareDocRequest: { docID: '', currentPublicHierarchicalKey: '', newPermissionEntries: [], signatures: [] }
          }
        },
        as.row
      );

    expect((await provision('postmaster@skiff.local', alice)).errors?.[0].message).toBe(
      'Only administrators can create accounts'
    );
    expect(getUserByAlias(env.db, 'postmaster@skiff.local')).toBeUndefined();

    for (const elsewhere of ['someone@gmail.com', 'a@b@skiff.local', 'x y@skiff.local']) {
      expect((await provision(elsewhere)).errors?.[0].message).toBe('Accounts can only be created on skiff.local');
    }
    expect((await provision('alice@skiff.local')).errors?.[0].message).toBe('alice@skiff.local is already taken');

    const created = await provision('Bob@Skiff.local');
    expect(created.errors).toBeUndefined();
    expect(getUserByAlias(env.db, 'bob@skiff.local')?.username).toBe('bob@skiff.local');
  });

  it('rejects a wrong password without starting a session', async () => {
    const env = await createTestEnv();
    await addUser(env, 'bob@skiff.local');
    const call = async (request: Record<string, unknown>) => (await run(env, LOGIN, { request })).data!.loginSrp;

    const { step2 } = await srpLogin('bob@skiff.local', 'wrong-password', call);
    expect(step2.status).toBe('AUTH_FAILURE');
    expect(Object.keys(env.cookies)).toHaveLength(0);
  });
});
