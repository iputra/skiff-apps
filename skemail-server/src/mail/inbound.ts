import fs from 'fs';

import { SMTPServer, SMTPServerAddress } from 'smtp-server';

import { Config } from '../config';
import { DB } from '../db/db';
import { getUserByAlias } from '../db/users';
import { ingestMime, isLocalDomain } from './ingest';

const smtpError = (message: string, responseCode: number) => Object.assign(new Error(message), { responseCode });

/**
 * The MX side of the mail server: accepts mail from other servers for the domains in MAIL_DOMAINS. It never relays:
 * recipients outside those domains are refused, and there is no AUTH (users send through the GraphQL API).
 */
export function createInboundServer(db: DB, config: Config, log: (msg: string) => void = console.log) {
  const { mail } = config;
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
        const recipients = session.envelope.rcptTo.map((r) => r.address);
        try {
          const { delivered } = await ingestMime(db, config, Buffer.concat(chunks), recipients);
          const from = session.envelope.mailFrom ? session.envelope.mailFrom.address : '<>';
          log(`[inbound] ${from} -> ${delivered.join(', ')} (${session.remoteAddress})`);
          callback(null, 'Message accepted');
        } catch (err) {
          log(`[inbound] failed to ingest message: ${(err as Error).message}`);
          callback(smtpError('4.3.0 Temporary failure, please retry', 451));
        }
      });
    }
  });
}
