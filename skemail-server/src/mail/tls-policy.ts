import { createHash, X509Certificate } from 'crypto';
import tls, { PeerCertificate, TLSSocket } from 'tls';

import { getPolicy, validateMx } from 'mailauth/lib/mta-sts';

import { DB, fromJSON, now, toJSON } from '../db/db';
import { systemResolver } from './filter';

// ---------------------------------------------------------------------------
// DNSSEC-validated lookups (needed for DANE)
// ---------------------------------------------------------------------------

export interface SecureAnswer {
  answers: string[];
  /** True when the resolver validated the answer with DNSSEC (the AD flag). */
  secure: boolean;
}
export type SecureResolver = (name: string, type: 'MX' | 'TLSA') => Promise<SecureAnswer>;

const RR_TYPES = { MX: 15, TLSA: 52 } as const;

/**
 * Looks records up through a DNS-over-HTTPS resolver that validates DNSSEC (Cloudflare, Google, Quad9, or your
 * own). Node's resolver cannot tell whether an answer was DNSSEC-validated, and DANE is only safe when it was.
 */
export function dohResolver(url: string): SecureResolver {
  return async (name, type) => {
    const res = await fetch(`${url}?name=${encodeURIComponent(name)}&type=${type}&do=1`, {
      headers: { accept: 'application/dns-json' }
    });
    if (!res.ok) throw new Error(`DoH ${res.status}`);
    const body = (await res.json()) as { Status: number; AD?: boolean; Answer?: { type: number; data: string }[] };
    // 0 = NOERROR, 3 = NXDOMAIN; anything else (SERVFAIL on a bogus signature, ...) is an error.
    if (body.Status !== 0 && body.Status !== 3)
      throw new Error(`DNS lookup of ${name} ${type} failed (rcode ${body.Status})`);
    return {
      answers: (body.Answer ?? []).filter((a) => a.type === RR_TYPES[type]).map((a) => a.data),
      secure: !!body.AD
    };
  };
}

// ---------------------------------------------------------------------------
// DANE (RFC 7672): TLSA records for _25._tcp.<mx>
// ---------------------------------------------------------------------------

export interface Tlsa {
  usage: number;
  selector: number;
  matching: number;
  data: string;
}

/** Parses "3 1 1 <hex>" as well as the RFC 3597 form "\# 35 030101<hex>" some DoH resolvers return. */
export function parseTlsa(record: string): Tlsa | null {
  const generic = record.match(/^\\#\s+\d+\s+([0-9a-fA-F\s]+)$/);
  if (generic) {
    const hex = generic[1].replace(/\s+/g, '').toLowerCase();
    return {
      usage: parseInt(hex.slice(0, 2), 16),
      selector: parseInt(hex.slice(2, 4), 16),
      matching: parseInt(hex.slice(4, 6), 16),
      data: hex.slice(6)
    };
  }
  const parts = record.trim().split(/\s+/);
  if (parts.length < 4) return null;
  return {
    usage: Number(parts[0]),
    selector: Number(parts[1]),
    matching: Number(parts[2]),
    data: parts.slice(3).join('').toLowerCase()
  };
}

/** The value a TLSA record of the given selector/matching type would hold for this certificate. */
export function tlsaDigest(cert: X509Certificate, selector: number, matching: number): string | null {
  const bytes =
    selector === 0 ? cert.raw : selector === 1 ? cert.publicKey.export({ type: 'spki', format: 'der' }) : null;
  if (!bytes) return null;
  if (matching === 0) return bytes.toString('hex');
  if (matching === 1) return createHash('sha256').update(bytes).digest('hex');
  if (matching === 2) return createHash('sha512').update(bytes).digest('hex');
  return null;
}

/** The certificate chain the server presented, leaf first. */
function presentedChain(socket: TLSSocket): X509Certificate[] {
  const chain: X509Certificate[] = [];
  let cert: PeerCertificate | undefined = socket.getPeerCertificate(true);
  const seen = new Set<string>();
  while (cert && cert.raw && !seen.has(cert.fingerprint256)) {
    seen.add(cert.fingerprint256);
    chain.push(new X509Certificate(cert.raw));
    cert = (cert as tls.DetailedPeerCertificate).issuerCertificate;
  }
  return chain;
}

/**
 * Checks the presented chain against TLSA records. Only the usages RFC 7672 defines for SMTP are honoured:
 * 3 (DANE-EE) pins the server's own certificate or key, with no name or expiry checks; 2 (DANE-TA) pins a
 * trust anchor in the presented chain, which must sign its way down to a leaf whose name matches the MX host.
 */
export function daneMatches(socket: TLSSocket, records: Tlsa[], mxHost: string): boolean {
  const chain = presentedChain(socket);
  if (!chain.length) return false;
  const matches = (cert: X509Certificate, r: Tlsa) => tlsaDigest(cert, r.selector, r.matching) === r.data;

  for (const r of records) {
    if (r.usage === 3 && matches(chain[0], r)) return true;
    if (r.usage === 2) {
      const anchor = chain.findIndex((c) => matches(c, r));
      if (anchor === -1) continue;
      const signedDown = chain.slice(0, anchor).every((cert, i) => cert.verify(chain[i + 1].publicKey));
      const nameOk = !tls.checkServerIdentity(mxHost, socket.getPeerCertificate());
      const valid = chain.slice(0, anchor + 1).every((c) => new Date(c.validTo) > new Date());
      if (signedDown && nameOk && valid) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// MTA-STS (RFC 8461)
// ---------------------------------------------------------------------------

export interface MtaStsPolicy {
  id: string | false;
  mode: 'enforce' | 'testing' | 'none';
  mx?: string[];
  maxAge?: number;
  expires?: string;
}
export type MtaStsFetcher = (domain: string, known: MtaStsPolicy | null) => Promise<MtaStsPolicy>;

export const fetchMtaSts: MtaStsFetcher = async (domain, known) =>
  (await getPolicy(domain, (known ?? undefined) as never, { resolver: systemResolver } as never))
    .policy as MtaStsPolicy;

/** The recipient domain's MTA-STS policy, cached for its max_age as RFC 8461 requires. */
export async function mtaStsPolicyFor(db: DB, domain: string, fetcher: MtaStsFetcher): Promise<MtaStsPolicy> {
  const row = db.prepare('SELECT policy_json, expires_at FROM mta_sts_policies WHERE domain = ?').get(domain) as
    | { policy_json: string; expires_at: string }
    | undefined;
  const cached = row ? fromJSON<MtaStsPolicy>(row.policy_json, { id: false, mode: 'none' }) : null;
  if (row && new Date(row.expires_at) > new Date()) return cached!;
  const policy = await fetcher(domain, cached);
  const expires = policy.expires ?? new Date(Date.now() + 3600_000).toISOString();
  db.prepare(
    `INSERT INTO mta_sts_policies (domain, policy_json, expires_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET policy_json = excluded.policy_json, expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`
  ).run(domain, toJSON(policy), expires, now());
  return policy;
}

export const mxAllowedByPolicy = (mx: string, policy: MtaStsPolicy) =>
  !policy.mx?.length || validateMx(mx, policy as never).valid;

/** PKIX check MTA-STS requires: a publicly trusted chain whose leaf names the MX host. */
export const pkixValid = (socket: TLSSocket, mxHost: string) =>
  socket.authorized && !tls.checkServerIdentity(mxHost, socket.getPeerCertificate());
