import { createDetachedSignatureAsymmetric, SignatureContext } from 'skiff-crypto';
import { describe, expect, it } from 'vitest';

import { srpStep2Request } from '../scripts/clientCrypto';
import { MAX_FAILED_ATTEMPTS, matchTotp, totpAt, verifyMfaToken } from '../src/mfa';
import { addUser, clientOperation, createTestEnv, run, TestEnv, TestUser } from './helpers';

// What configureMFA (otplib authenticator.generateSecret) produces: base32.
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const step = (offset = 0) => Math.floor(Date.now() / 30000) + offset;

/** Step 1 + the step-2 request, as a password dialog builds it. `as` is the session it runs in (null: logged out). */
async function srpRequest(env: TestEnv, user: TestUser, as: TestUser | null, tokenMFA?: string) {
  const username = user.row.username;
  const step1 = (await run(env, clientOperation('loginSrpStep1'), { request: { step: 1, username } }, as?.row ?? null))
    .data!.loginSrp;
  return (await srpStep2Request(username, user.password, step1, tokenMFA)).request;
}

const step2 = async (env: TestEnv, request: Record<string, unknown>, as: TestUser | null) =>
  (await run(env, clientOperation('loginSrpStep2'), { request }, as?.row ?? null)).data!.loginSrp;

async function login(env: TestEnv, user: TestUser, tokenMFA?: string) {
  return step2(env, await srpRequest(env, user, null, tokenMFA), null);
}

async function enroll(env: TestEnv, user: TestUser, secret = SECRET) {
  // SetupMFA: the dialog checks the password, the handler sends the same proof again, then enrollMfa reuses it.
  const request = await srpRequest(env, user, user);
  expect((await step2(env, request, user)).status).toBe('AUTHENTICATED');
  expect((await step2(env, request, user)).status).toBe('AUTHENTICATED');
  const signature = createDetachedSignatureAsymmetric(
    secret,
    user.privateUserData.signingPrivateKey,
    SignatureContext.EnrollMfa
  );
  return run(
    env,
    clientOperation('enrollMfa'),
    { request: { dataMFA: secret, signature, loginSrpRequest: request } },
    user.row
  );
}

const userMfa = async (env: TestEnv, of: TestUser, as: TestUser) =>
  (await run(env, clientOperation('getUserMfa'), { request: { userID: of.row.user_id } }, as.row)).data!.user.mfa;

describe('TOTP', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // base32("12345678901234567890")
    expect(totpAt(rfcSecret, Math.floor(59 / 30))).toBe('287082');
    expect(totpAt(rfcSecret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(rfcSecret, Math.floor(1234567890 / 30))).toBe('005924');
  });

  it('accepts one step of clock drift either way, and never a step at or before the last one used', () => {
    const now = 1_700_000_000_000;
    const s = Math.floor(now / 30000);
    expect(matchTotp(SECRET, totpAt(SECRET, s - 1), 0, now)).toBe(s - 1);
    expect(matchTotp(SECRET, totpAt(SECRET, s + 1), 0, now)).toBe(s + 1);
    expect(matchTotp(SECRET, totpAt(SECRET, s + 2), 0, now)).toBeNull();
    expect(matchTotp(SECRET, totpAt(SECRET, s), s, now)).toBeNull();
  });
});

describe('two-factor authentication', () => {
  it('enrolls with the password, then requires a code at login; codes and backup codes work once', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');

    expect((await login(env, alice)).status).toBe('AUTHENTICATED');

    const enrolled = await enroll(env, alice);
    expect(enrolled.errors).toBeUndefined();
    expect(enrolled.data!.enrollMfa.status).toBe('SAVED');
    const backupCodes: string[] = enrolled.data!.enrollMfa.backupCodes;
    expect(backupCodes).toHaveLength(10);
    backupCodes.forEach((c) => expect(c).toMatch(/^[a-z2-9]{10}$/));

    // Only the owner sees that 2FA is on, and never the secret or the codes themselves.
    expect(await userMfa(env, alice, alice)).toEqual({
      totpData: 'enabled',
      backupCodes: Array(10).fill('**********'),
      webAuthnKeys: []
    });
    expect(await userMfa(env, alice, bob)).toEqual({ totpData: null, backupCodes: [], webAuthnKeys: [] });

    // Login: password alone is not enough, and starts no session.
    for (const name of Object.keys(env.cookies)) delete env.cookies[name];
    const noCode = await login(env, alice);
    expect(noCode.status).toBe('TOKEN_NEEDED');
    expect(noCode.mfaTypes).toEqual(['TOTP', 'BACKUP_CODE']);
    expect(env.cookies).toEqual({});
    expect((await login(env, alice, '000000')).status).toBe('AUTH_FAILURE');

    const code = totpAt(SECRET, step());
    const ok = await login(env, alice, code);
    expect(ok.status).toBe('AUTHENTICATED');
    expect(env.cookies[`skiff_session_${alice.row.user_id}`]).toBeTruthy();
    expect((await login(env, alice, code)).status).toBe('AUTH_FAILURE'); // same code again

    const backup = backupCodes[0];
    expect((await login(env, alice, backup.toUpperCase())).status).toBe('AUTHENTICATED');
    expect((await login(env, alice, backup)).status).toBe('AUTH_FAILURE'); // used up
    expect((await userMfa(env, alice, alice)).backupCodes).toHaveLength(9);

    // The wrong password still fails, even with a valid code.
    const wrongPassword = { ...alice, password: 'not-it' };
    expect((await login(env, wrongPassword, totpAt(SECRET, step(1)))).status).toBe('AUTH_FAILURE');
  });

  it('only lets a passed proof be checked again from a session of the same user', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');
    const request = await srpRequest(env, alice, alice);
    expect((await step2(env, request, alice)).status).toBe('AUTHENTICATED');
    expect((await step2(env, request, null)).status).toBe('AUTH_FAILURE');
    expect((await step2(env, request, bob)).status).toBe('AUTH_FAILURE');
    expect((await step2(env, request, alice)).status).toBe('AUTHENTICATED');
  });

  it('refuses enrollment without a valid password proof or signature', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const bob = await addUser(env, 'bob@skiff.local');
    const signature = createDetachedSignatureAsymmetric(
      SECRET,
      alice.privateUserData.signingPrivateKey,
      SignatureContext.EnrollMfa
    );

    // A proof that was never checked against a challenge (no step 1 for it).
    const unchecked = await srpRequest(env, alice, alice);
    const forged = { ...unchecked, clientSessionProof: 'ab'.repeat(32) };
    const noProof = await run(
      env,
      clientOperation('enrollMfa'),
      { request: { dataMFA: SECRET, signature, loginSrpRequest: forged } },
      alice.row
    );
    expect(noProof.errors?.[0].message).toBe('Password confirmation failed');

    // Bob's own valid proof cannot enroll 2FA on Alice's account.
    const bobProof = await srpRequest(env, bob, bob);
    const crossUser = await run(
      env,
      clientOperation('enrollMfa'),
      { request: { dataMFA: SECRET, signature, loginSrpRequest: bobProof } },
      alice.row
    );
    expect(crossUser.errors?.[0].message).toBe('Password confirmation failed');

    const badSignature = await run(
      env,
      clientOperation('enrollMfa'),
      {
        request: {
          dataMFA: 'KRSXG5CTMVRXEZLUKRSXG5CT',
          signature,
          loginSrpRequest: await srpRequest(env, alice, alice)
        }
      },
      alice.row
    );
    expect(badSignature.errors?.[0].message).toBe('Invalid signature');
    expect((await userMfa(env, alice, alice)).totpData).toBeNull();
  });

  it('regenerates backup codes and disables 2FA only with the password and a current code', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const old = (await enroll(env, alice)).data!.enrollMfa.backupCodes as string[];

    // Without a code the dialog gets TOKEN_NEEDED, and the action itself is refused.
    const noCode = await srpRequest(env, alice, alice);
    expect((await step2(env, noCode, alice)).status).toBe('TOKEN_NEEDED');
    const refused = await run(
      env,
      clientOperation('disableMfa'),
      { request: { disableTotp: true, loginSrpRequest: noCode } },
      alice.row
    );
    expect(refused.errors?.[0].message).toBe('Password confirmation failed');

    const signature = createDetachedSignatureAsymmetric(
      alice.row.username,
      alice.privateUserData.signingPrivateKey,
      SignatureContext.RegenerateMfaBackupCodes
    );
    const regenerated = await run(
      env,
      clientOperation('regenerateMfaBackupCodes'),
      { request: { signature, loginSrpRequest: await srpRequest(env, alice, alice, totpAt(SECRET, step())) } },
      alice.row
    );
    expect(regenerated.data!.regenerateMfaBackupCodes.status).toBe('SUCCESS');
    const fresh = regenerated.data!.regenerateMfaBackupCodes.backupCodes as string[];
    expect(fresh).toHaveLength(10);
    expect((await login(env, alice, old[0])).status).toBe('AUTH_FAILURE');
    expect((await login(env, alice, fresh[0])).status).toBe('AUTHENTICATED');

    const disabled = await run(
      env,
      clientOperation('disableMfa'),
      { request: { disableTotp: true, loginSrpRequest: await srpRequest(env, alice, alice, fresh[1]) } },
      alice.row
    );
    expect(disabled.data!.disableMfa.status).toBe('SUCCESS');
    expect((await userMfa(env, alice, alice)).totpData).toBeNull();
    expect((await login(env, alice)).status).toBe('AUTHENTICATED');
  });

  it('locks second-factor checks after too many wrong codes', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    await enroll(env, alice);
    const now = Date.now();
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      expect(verifyMfaToken(env.db, alice.row.user_id, '000000', now)).toBe(false);
    }
    // Locked: even the right code is refused...
    expect(verifyMfaToken(env.db, alice.row.user_id, totpAt(SECRET, Math.floor(now / 30000)), now)).toBe(false);
    // ...until the lock (15 minutes) has passed.
    const later = now + 16 * 60 * 1000;
    expect(verifyMfaToken(env.db, alice.row.user_id, totpAt(SECRET, Math.floor(later / 30000)), later)).toBe(true);
  });
});

describe('changing the password', () => {
  it('requires the current password, and the 2FA code when 2FA is on', async () => {
    const env = await createTestEnv();
    const alice = await addUser(env, 'alice@skiff.local');
    const update = (loginSrpRequest?: Record<string, unknown>) =>
      run(
        env,
        clientOperation('updateSrp'),
        {
          request: {
            salt: alice.row.salt,
            verifier: alice.row.verifier,
            encryptedUserData: alice.row.encrypted_user_data,
            saltSignature: '',
            verifierSignature: '',
            userDataSignature: '',
            ...(loginSrpRequest ? { loginSrpRequest } : {})
          }
        },
        alice.row
      );

    expect((await update()).errors?.[0].message).toBe('Password confirmation failed');
    expect((await update(await srpRequest(env, alice, alice))).data!.updateSrp.status).toBe('UPDATED');

    await enroll(env, alice);
    expect((await update(await srpRequest(env, alice, alice))).errors?.[0].message).toBe(
      'Password confirmation failed'
    );
    const withCode = await update(await srpRequest(env, alice, alice, totpAt(SECRET, step())));
    expect(withCode.data!.updateSrp.status).toBe('UPDATED');

    const { data } = await run(env, clientOperation('canDirectlyUpdateSrp'), {}, alice.row);
    expect(data!.currentUser.canDirectlyUpdateSrp).toBe(false);
  });
});
