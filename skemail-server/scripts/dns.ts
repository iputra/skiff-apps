/**
 * Prints the DNS records the mail server needs for each domain in MAIL_DOMAINS.
 *
 *   yarn workspace skemail-server dns [server-ip]
 */
import { loadConfig, loadDotEnv } from '../src/config';
import { dkimDnsValue, loadDkimKey } from '../src/mail/dkim';

loadDotEnv();
const { mail } = loadConfig();
const ip = process.argv[2] ?? '<IP publik server>';
const dkim = dkimDnsValue(loadDkimKey(mail));

const rows: [string, string, string][] = [[mail.hostname, 'A', ip]];
for (const domain of mail.domains) {
  rows.push(
    [domain, 'MX', `10 ${mail.hostname}.`],
    [domain, 'TXT', `v=spf1 mx a:${mail.hostname} -all`],
    [`${mail.dkimSelector}._domainkey.${domain}`, 'TXT', dkim],
    [`_dmarc.${domain}`, 'TXT', `v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain}`]
  );
}

console.log(`DNS records for ${mail.domains.join(', ')} (mail host ${mail.hostname}):\n`);
for (const [name, type, value] of rows) console.log(`${name}\t${type}\t${value}`);
console.log(`\nAlso ask your hosting provider to set reverse DNS (PTR) of ${ip} to ${mail.hostname}.`);
console.log(
  'DKIM TXT values longer than 255 characters must be split into several quoted strings by some DNS providers.'
);
