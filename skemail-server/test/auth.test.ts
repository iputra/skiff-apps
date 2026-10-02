import { describe, expect, it } from 'vitest';

import { srpLogin } from '../scripts/clientCrypto';
import { addUser, createTestEnv, run } from './helpers';

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

  it('rejects a wrong password without starting a session', async () => {
    const env = await createTestEnv();
    await addUser(env, 'bob@skiff.local');
    const call = async (request: Record<string, unknown>) => (await run(env, LOGIN, { request })).data!.loginSrp;

    const { step2 } = await srpLogin('bob@skiff.local', 'wrong-password', call);
    expect(step2.status).toBe('AUTH_FAILURE');
    expect(Object.keys(env.cookies)).toHaveLength(0);
  });
});
