/**
 * Client-side crypto, done the same way skemail-web does it, for creating accounts (seed) and for tests.
 * The server itself never uses any of this: it only stores what the client produces.
 */
import srp from 'secure-remote-password/client';
import {
  createDetachedSignatureAsymmetric,
  createKeyFromSecret,
  createPasswordDerivedSecret,
  createSRPKey,
  decryptSymmetric,
  encryptSymmetric,
  generatePublicPrivateKeyPair,
  generateSymmetricKey,
  PrivateUserDataDatagram,
  SignatureContext
} from 'skiff-crypto';

export interface PrivateUserData {
  privateKey: string;
  signingPrivateKey: string;
  documentKey: string;
}

/**
 * argon2-browser loads its wasm with `fetch` whenever `fetch` exists, which fails in Node for file paths.
 * Hiding `fetch` while the module initialises makes it read the wasm from disk instead. The wasm is the
 * same one the browser runs, so hashes match skemail-web exactly.
 */
export async function deriveMasterSecret(password: string, salt: string): Promise<string> {
  const g = globalThis as { fetch?: typeof fetch };
  const savedFetch = g.fetch;
  delete g.fetch;
  try {
    return await createKeyFromSecret(password, salt);
  } finally {
    g.fetch = savedFetch;
  }
}

/** Everything `createSrp` / `provisionSrp` would send for a new account (see provisionUserUtils.ts). */
export async function createAccountMaterial(password: string) {
  const salt = srp.generateSalt();
  const masterSecret = await deriveMasterSecret(password, salt);
  const verifier = srp.deriveVerifier(createSRPKey(masterSecret, salt));
  const keys = generatePublicPrivateKeyPair();
  const privateUserData: PrivateUserData = {
    privateKey: keys.privateKey,
    signingPrivateKey: keys.signingPrivateKey,
    documentKey: generateSymmetricKey()
  };
  const signature = createDetachedSignatureAsymmetric(
    keys.publicKey,
    keys.signingPrivateKey,
    SignatureContext.UserPublicKey
  );
  return {
    salt,
    verifier,
    encryptedUserData: encryptSymmetric(
      privateUserData,
      createPasswordDerivedSecret(masterSecret, salt),
      PrivateUserDataDatagram
    ),
    publicKey: { key: keys.publicKey, signature },
    signingPublicKey: keys.signingPublicKey,
    privateUserData
  };
}

/** Client half of SRP login, mirroring skemail-web/src/utils/loginUtils.ts. */
export async function srpLogin(
  username: string,
  password: string,
  call: (step: Record<string, unknown>) => Promise<Record<string, unknown>>
) {
  const clientEphemeral = srp.generateEphemeral();
  const step1 = await call({ step: 1, username });
  const salt = step1.salt as string;
  const masterSecret = await deriveMasterSecret(password, salt);
  const session = srp.deriveSession(
    clientEphemeral.secret,
    step1.serverEphemeralPublic as string,
    salt,
    username,
    createSRPKey(masterSecret, salt)
  );
  const step2 = await call({
    step: 2,
    username,
    clientSessionProof: session.proof,
    clientEphemeralPublic: clientEphemeral.public
  });
  if (step2.status !== 'AUTHENTICATED') return { step2, privateUserData: null };
  srp.verifySession(clientEphemeral.public, session, step2.serverSessionProof as string);
  const privateUserData = decryptSymmetric(
    step2.encryptedUserData as string,
    createPasswordDerivedSecret(masterSecret, salt),
    PrivateUserDataDatagram
  ) as PrivateUserData;
  return { step2, privateUserData };
}
