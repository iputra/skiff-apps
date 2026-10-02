/**
 * Prints the DNS records the mail server needs for each domain in MAIL_DOMAINS.
 *
 *   yarn workspace skemail-server dns [server-ip]
 */
import { loadConfig, loadDotEnv } from '../src/config';
import { dnsRecords, ownTlsaRecord } from '../src/mail/published';

loadDotEnv();
const { mail } = loadConfig();
const ip = process.argv[2] ?? '<server public IP>';

console.log(`DNS records for ${mail.domains.join(', ')} (mail host ${mail.hostname}):\n`);
for (const [name, type, value] of dnsRecords(mail, ip)) console.log(`${name}\t${type}\t${value}`);
console.log(`
Notes:
- Ask your hosting provider to set reverse DNS (PTR) of ${ip} to ${mail.hostname}.
- DKIM TXT values longer than 255 characters must be split into several quoted strings by some DNS providers.
- MTA-STS: https://mta-sts.<domain>/.well-known/mta-sts.txt must be served over HTTPS with a valid certificate.
  This server answers that path; put it behind your HTTPS reverse proxy for each mta-sts.<domain>.
  Current mode: ${mail.mtaStsMode} (MTA_STS_MODE). Switch to enforce once TLS on port 25 works reliably.`);
console.log(
  ownTlsaRecord(mail)
    ? `- DANE: the TLSA record only protects you if the zone is DNSSEC-signed. It pins the certificate's key, so
  renew certificates with the same key (certbot --reuse-key) or publish the new record before switching.`
    : `- DANE: set SMTP_TLS_CERT_FILE to also get a TLSA record (requires a DNSSEC-signed zone).`
);
