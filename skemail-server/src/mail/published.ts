/**
 * What this server publishes so that other mail servers use encrypted connections when sending to it.
 */
import { createHash, X509Certificate } from 'crypto';
import fs from 'fs';

import { MailConfig } from '../config';
import { dkimDnsValue, loadDkimKey } from './dkim';
import { tlsaDigest } from './tls-policy';

/** Body of https://mta-sts.<domain>/.well-known/mta-sts.txt (RFC 8461 §3.2). */
export const mtaStsPolicyText = (mail: MailConfig) =>
  [`version: STSv1`, `mode: ${mail.mtaStsMode}`, `mx: ${mail.hostname}`, `max_age: ${mail.mtaStsMaxAge}`, ''].join(
    '\r\n'
  );

/** Changes whenever the policy does, so senders refetch it. */
export const mtaStsPolicyId = (mail: MailConfig) =>
  createHash('sha256').update(mtaStsPolicyText(mail)).digest('hex').slice(0, 20);

/** "3 1 1 <sha256 of the public key>" for the inbound STARTTLS certificate, if one is configured. */
export function ownTlsaRecord(mail: MailConfig): string | null {
  if (!mail.tlsCertFile || !fs.existsSync(mail.tlsCertFile)) return null;
  const cert = new X509Certificate(fs.readFileSync(mail.tlsCertFile));
  return `3 1 1 ${tlsaDigest(cert, 1, 1)}`;
}

export function dnsRecords(mail: MailConfig, ip: string): [string, string, string][] {
  const rows: [string, string, string][] = [[mail.hostname, 'A', ip]];
  const tlsa = ownTlsaRecord(mail);
  if (tlsa) rows.push([`_25._tcp.${mail.hostname}`, 'TLSA', tlsa]);
  const dkim = dkimDnsValue(loadDkimKey(mail));
  for (const domain of mail.domains) {
    rows.push(
      [domain, 'MX', `10 ${mail.hostname}.`],
      [domain, 'TXT', `v=spf1 mx a:${mail.hostname} -all`],
      [`${mail.dkimSelector}._domainkey.${domain}`, 'TXT', dkim],
      [`_dmarc.${domain}`, 'TXT', `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}`],
      [`mta-sts.${domain}`, 'CNAME', `${mail.hostname}.`],
      [`_mta-sts.${domain}`, 'TXT', `v=STSv1; id=${mtaStsPolicyId(mail)}`],
      [`_smtp._tls.${domain}`, 'TXT', `v=TLSRPTv1; rua=mailto:postmaster@${domain}`]
    );
  }
  return rows;
}
