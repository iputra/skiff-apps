import { GraphQLError } from 'graphql';

import { Config } from './config';
import { DB, now } from './db/db';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface SendLimits {
  /** Recipients per message (to + cc + bcc). */
  maxRecipientsPerMessage: number;
  /** Recipients per rolling hour: stops bursts from a compromised account quickly. */
  perHour: number;
  /** Recipients per rolling day; matches the Free tier's messagesPerDay in skiff-utils by default. */
  perDay: number;
}

function sentSince(db: DB, userID: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const row = db
    .prepare(
      'SELECT COALESCE(SUM(recipients), 0) AS total, MIN(created_at) AS oldest FROM send_log WHERE user_id = ? AND created_at > ?'
    )
    .get(userID, since) as { total: number; oldest: string | null };
  return row;
}

/**
 * Throws when sending to `recipients` more addresses would exceed the account's limits. The error codes are the
 * ones skemail-web already understands: MESSAGE_LIMIT opens its limit modal, RATE_LIMIT_EXCEEDED shows a toast.
 */
export function assertWithinSendLimits(db: DB, config: Config, userID: string, recipients: number) {
  const limits = config.sendLimits;
  if (recipients > limits.maxRecipientsPerMessage) {
    throw new GraphQLError(`A message can have at most ${limits.maxRecipientsPerMessage} recipients.`, {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }
  const day = sentSince(db, userID, DAY_MS);
  if (day.total + recipients > limits.perDay) {
    throw new GraphQLError(`Daily sending limit reached (${limits.perDay} recipients per 24 hours).`, {
      extensions: { code: 'MESSAGE_LIMIT', msBeforeNext: msUntilFree(day.oldest, DAY_MS) }
    });
  }
  const hour = sentSince(db, userID, HOUR_MS);
  if (hour.total + recipients > limits.perHour) {
    const wait = msUntilFree(hour.oldest, HOUR_MS);
    throw new GraphQLError(
      `Sending too fast: at most ${limits.perHour} recipients per hour. Try again in ${Math.ceil(wait / 60000)} min.`,
      { extensions: { code: 'RATE_LIMIT_EXCEEDED', msBeforeNext: wait } }
    );
  }
}

export function recordSend(db: DB, userID: string, recipients: number) {
  db.prepare('INSERT INTO send_log (user_id, recipients, created_at) VALUES (?, ?, ?)').run(userID, recipients, now());
}

const msUntilFree = (oldest: string | null, windowMs: number) =>
  oldest ? Math.max(0, new Date(oldest).getTime() + windowMs - Date.now()) : 0;
