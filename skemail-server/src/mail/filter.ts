import { promises as dns } from 'dns';
import net from 'net';

import { authenticate, DNSResolver } from 'mailauth';

import { Config } from '../config';

export type Resolver = DNSResolver;
export const systemResolver: Resolver = (name, type) => dns.resolve(name, type) as Promise<string[][] | string[]>;

export type Action = 'accept' | 'spam' | 'reject' | 'tempfail';

export interface Verdict {
  action: Action;
  /** Human-readable reasons, also used as the SMTP rejection text. */
  reasons: string[];
  /** The Authentication-Results / Received-SPF headers mailauth produced, for logs. */
  authHeaders: string;
}

export interface InboundContext {
  raw: Buffer;
  ip: string;
  helo: string;
  mailFrom: string;
}

const isPublicIp = (ip: string) => {
  const v4 = ip.replace(/^::ffff:/, '');
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number);
    return !(a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0);
  }
  return !(ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80'));
};

/**
 * Checks the connecting IP against DNS blocklists (e.g. zen.spamhaus.org). Private and loopback addresses are
 * never listed. Returns the zone that lists the IP, or null.
 */
export async function dnsblListing(ip: string, zones: string[], resolver: Resolver = systemResolver) {
  const v4 = ip.replace(/^::ffff:/, '');
  if (!net.isIPv4(v4) || !isPublicIp(v4)) return null;
  const reversed = v4.split('.').reverse().join('.');
  for (const zone of zones) {
    try {
      const answers = (await resolver(`${reversed}.${zone}`, 'A')) as string[];
      // 127.255.255.x means the query itself was refused (e.g. via a public resolver), not that the IP is listed.
      if (answers.some((a) => a.startsWith('127.') && !a.startsWith('127.255.255.'))) return zone;
    } catch {
      // NXDOMAIN: not listed.
    }
  }
  return null;
}

/** Asks rspamd (https://rspamd.com) for its verdict via the /checkv2 HTTP API. */
async function rspamdVerdict(url: string, ctx: InboundContext, rcpts: string[]) {
  const res = await fetch(`${url.replace(/\/$/, '')}/checkv2`, {
    method: 'POST',
    headers: {
      IP: ctx.ip.replace(/^::ffff:/, ''),
      Helo: ctx.helo,
      From: ctx.mailFrom,
      ...Object.fromEntries(rcpts.map((r, i) => [i ? `Rcpt-${i}` : 'Rcpt', r]))
    },
    body: ctx.raw
  });
  if (!res.ok) throw new Error(`rspamd answered ${res.status}`);
  return (await res.json()) as { action: string; score: number; required_score: number };
}

/**
 * Decides what to do with an incoming message:
 * - DMARC fails and the sender's domain says p=reject           -> reject (550)
 * - DMARC fails with p=quarantine, or SPF fails with no valid
 *   DKIM signature to vouch for the message                       -> deliver to Spam
 * - rspamd (when RSPAMD_URL is set) says reject / greylist / spam  -> reject / tempfail / Spam
 * Otherwise the message is accepted into the inbox.
 */
export async function checkInbound(
  config: Config,
  ctx: InboundContext,
  rcpts: string[],
  resolver: Resolver = systemResolver
): Promise<Verdict> {
  const auth = await authenticate(ctx.raw, {
    ip: ctx.ip.replace(/^::ffff:/, ''),
    helo: ctx.helo,
    sender: ctx.mailFrom,
    mta: config.mail.hostname,
    resolver,
    disableBimi: true
  });
  const reasons: string[] = [];
  let action: Action = 'accept';
  const escalate = (to: Action, reason: string) => {
    const rank: Action[] = ['accept', 'spam', 'tempfail', 'reject'];
    if (rank.indexOf(to) > rank.indexOf(action)) action = to;
    reasons.push(reason);
  };

  const dmarc = auth.dmarc || null;
  const dmarcResult = dmarc?.status?.result;
  if (dmarc && dmarcResult === 'fail') {
    // pct lets a domain apply its policy to only part of its mail; honour it.
    const applies = dmarc.pct === undefined || Math.random() * 100 < dmarc.pct;
    if (dmarc.policy === 'reject' && applies)
      escalate('reject', `DMARC policy of ${dmarc.domain} rejects this message`);
    else if (dmarc.policy === 'quarantine' && applies)
      escalate('spam', `DMARC failed for ${dmarc.domain} (quarantine)`);
  }

  const spfResult = auth.spf ? auth.spf.status.result : 'none';
  const dkimPass = auth.dkim.results.some((r) => r.status.result === 'pass');
  if (spfResult === 'fail' && !dkimPass && dmarcResult !== 'pass') {
    escalate('spam', `SPF fails for ${ctx.mailFrom || ctx.helo} and there is no valid DKIM signature`);
  }

  if (config.mail.rspamdUrl) {
    try {
      const r = await rspamdVerdict(config.mail.rspamdUrl, ctx, rcpts);
      const label = `rspamd ${r.action} (score ${r.score.toFixed(1)}/${r.required_score})`;
      if (r.action === 'reject') escalate('reject', label);
      else if (r.action === 'soft reject' || r.action === 'greylist') escalate('tempfail', label);
      else if (r.action === 'add header' || r.action === 'rewrite subject') escalate('spam', label);
    } catch (err) {
      // A broken filter must not lose mail: accept and let auth checks above decide.
      reasons.push(`rspamd unavailable: ${(err as Error).message}`);
    }
  }

  return { action, reasons, authHeaders: auth.headers };
}
