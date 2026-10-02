import fs from 'fs';

import { SMTPServer, SMTPServerAddress } from 'smtp-server';

import { Config } from '../config';
import { DB } from '../db/db';
import { getUserByAlias } from '../db/users';
import { checkInbound, dnsblListing, Resolver, systemResolver } from './filter';
import { ingestMime, isLocalDomain } from './ingest';

const smtpError = (message: string, responseCode: number) => Object.assign(new Error(message), { responseCode });

/** Counts messages per remote IP over a sliding minute. */
function perIpLimiter(limitPerMinute: number) {
  const seen = new Map<string, number[]>();
  return (ip: string) => {
    const cutoff = Date.now() - 60_000;
    const recent = (seen.get(ip) ?? []).filter((t) => t > cutoff);
    recent.push(Date.now());
    seen.set(ip, recent);
    return recent.length <= limitPerMinute;
  };
}

export interface InboundOptions {
  log?: (msg: string) => void;
  /** DNS resolver for SPF/DKIM/DMARC and DNSBL lookups (tests pass a fake one). */
  resolver?: Resolver;
}

/**
 * The MX side of the mail server: accepts mail from other servers for the domains in MAIL_DOMAINS.
 * - It never relays: recipients outside those domains are refused, and there is no AUTH (users send through
 *   the GraphQL API).
 * - Connections from IPs on a DNS blocklist are refused, and each IP may send a limited number of messages
 *   per minute.
 * - Every message is checked with SPF, DKIM, DMARC (and rspamd when configured) before it is accepted; see
 *   checkInbound for the policy.
 */
export function createInboundServer(db: DB, config: Config, options: InboundOptions = {}) {
  const { mail } = config;
  const log = options.log ?? console.log;
  const resolver = options.resolver ?? systemResolver;
  const allowMessage = perIpLimiter(mail.inboundPerIpPerMinute);

  return new SMTPServer({
    name: mail.hostname,
    banner: 'skemail-server ESMTP',
    size: mail.maxMessageBytes,
    authOptional: true,
    disabledCommands: ['AUTH'],
    ...(mail.tlsKeyFile && mail.tlsCertFile
      ? { key: fs.readFileSync(mail.tlsKeyFile), cert: fs.readFileSync(mail.tlsCertFile) }
      : {}),
    logger: false,

    async onConnect(session, callback) {
      const zone = await dnsblListing(session.remoteAddress, mail.dnsblZones, resolver);
      if (zone) {
        log(`[inbound] refused ${session.remoteAddress}: listed on ${zone}`);
        return callback(
          smtpError(`5.7.1 Service unavailable; client host [${session.remoteAddress}] blocked using ${zone}`, 554)
        );
      }
      callback();
    },

    onMailFrom(_address, session, callback) {
      if (!allowMessage(session.remoteAddress)) {
        return callback(smtpError('4.7.0 Too many messages from your IP, try again later', 421));
      }
      callback();
    },

    onRcptTo(address: SMTPServerAddress, _session, callback) {
      if (!isLocalDomain(config, address.address)) {
        return callback(smtpError(`5.7.1 Relaying denied for <${address.address}>`, 554));
      }
      if (!getUserByAlias(db, address.address)) {
        return callback(smtpError(`5.1.1 <${address.address}>: Recipient address rejected: no such user`, 550));
      }
      callback();
    },

    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', callback);
      stream.on('end', async () => {
        if ((stream as unknown as { sizeExceeded?: boolean }).sizeExceeded) {
          return callback(smtpError('5.3.4 Message exceeds fixed maximum message size', 552));
        }
        const raw = Buffer.concat(chunks);
        const recipients = session.envelope.rcptTo.map((r) => r.address);
        const from = session.envelope.mailFrom ? session.envelope.mailFrom.address : '';
        const summary = `${from || '<>'} -> ${recipients.join(', ')} (${session.remoteAddress})`;
        try {
          const verdict = await checkInbound(
            config,
            { raw, ip: session.remoteAddress, helo: session.hostNameAppearsAs, mailFrom: from },
            recipients,
            resolver
          );
          const why = verdict.reasons.join('; ');
          if (verdict.action === 'reject') {
            log(`[inbound] rejected ${summary}: ${why}`);
            return callback(smtpError(`5.7.1 ${verdict.reasons[0]}`, 550));
          }
          if (verdict.action === 'tempfail') {
            log(`[inbound] deferred ${summary}: ${why}`);
            return callback(smtpError(`4.7.1 ${verdict.reasons[0]}, try again later`, 451));
          }
          const label = verdict.action === 'spam' ? 'SPAM' : 'INBOX';
          await ingestMime(db, config, raw, recipients, label);
          log(`[inbound] ${label === 'SPAM' ? 'spam' : 'accepted'} ${summary}${why ? `: ${why}` : ''}`);
          callback(null, 'Message accepted');
        } catch (err) {
          log(`[inbound] failed to process ${summary}: ${(err as Error).message}`);
          callback(smtpError('4.3.0 Temporary failure, please retry', 451));
        }
      });
    }
  });
}
