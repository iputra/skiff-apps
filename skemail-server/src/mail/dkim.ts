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
