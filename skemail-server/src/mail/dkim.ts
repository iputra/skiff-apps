import { createPublicKey, generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';

import { MailConfig } from '../config';

/** Loads the DKIM signing key, creating a 2048-bit RSA key on first use. */
export function loadDkimKey(config: MailConfig): string {
  if (!fs.existsSync(config.dkimKeyFile)) {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    fs.mkdirSync(path.dirname(config.dkimKeyFile), { recursive: true });
    fs.writeFileSync(config.dkimKeyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  }
  return fs.readFileSync(config.dkimKeyFile, 'utf8');
}

/** The DNS TXT value publishing the DKIM public key (at `<selector>._domainkey.<domain>`). */
export function dkimDnsValue(privateKeyPem: string): string {
  const der = createPublicKey(privateKeyPem).export({ type: 'spki', format: 'der' });
  return `v=DKIM1; k=rsa; p=${der.toString('base64')}`;
}

/**
 * Returns the message with a DKIM-Signature header prepended. mailauth's bundled typings describe a flat options
 * object, but the implementation only signs with `signatureData` (flat options silently produce no signature),
 * so the call is made here once, with a check.
 */
export async function dkimSignMessage(raw: Buffer, signer: { domain: string; selector: string; privateKey: string }) {
  const { dkimSign } = await import('mailauth');
  const result = (await dkimSign(raw, {
    signatureData: [{ signingDomain: signer.domain, selector: signer.selector, privateKey: signer.privateKey }]
  } as never)) as unknown as { signatures: string; errors: unknown[] };
  if (!result.signatures.startsWith('DKIM-Signature:')) {
    throw new Error(`DKIM signing failed: ${JSON.stringify(result.errors)}`);
  }
  return Buffer.concat([Buffer.from(result.signatures), raw]);
}
