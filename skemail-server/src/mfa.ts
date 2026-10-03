import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';

import { DB, now } from './db/db';

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) with the parameters skemail-web's otplib `authenticator` uses: base32 secret, HMAC-SHA1,
// 30-second steps, 6 digits.
// ---------------------------------------------------------------------------

const STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept the previous and next step too, for clock drift between phone and server. */
const DRIFT_STEPS = 1;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A TOTP secret as configureMFA creates it: base32, at least 80 bits. */
export const isValidTotpSecret = (secret: string) => /^[A-Z2-7]{16,128}=*$/i.test(secret);

export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return code.toString().padStart(DIGITS, '0');
}

const currentStep = (timeMs: number) => Math.floor(timeMs / 1000 / STEP_SECONDS);

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** The time step `code` belongs to, within the drift window and after `lastStep`; null when it does not match. */
export function matchTotp(secret: string, code: string, lastStep: number, timeMs = Date.now()): number | null {
  const step = currentStep(timeMs);
  for (let s = step - DRIFT_STEPS; s <= step + DRIFT_STEPS; s++) {
    if (s > lastStep && safeEqual(totpAt(secret, s), code)) return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Backup codes: 10 characters (skemail-web asks for a "10-character backup code"), single use.
// ---------------------------------------------------------------------------

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;
/** Lowercase letters and digits without look-alikes (0/o, 1/l/i). */
const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const normalizeBackupCode = (code: string) => code.toLowerCase().replace(/[\s-]/g, '');
const hashBackupCode = (code: string) => createHash('sha256').update(normalizeBackupCode(code)).digest('hex');

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    Array.from({ length: BACKUP_CODE_LENGTH }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join('')
  );
}

/** Replaces the user's backup codes with a fresh set and returns them; only hashes are stored. */
function replaceBackupCodes(db: DB, userID: string): string[] {
  const codes = generateBackupCodes();
  db.prepare('DELETE FROM mfa_backup_codes WHERE user_id = ?').run(userID);
  const insert = db.prepare('INSERT INTO mfa_backup_codes (user_id, code_hash) VALUES (?, ?)');
  for (const code of codes) insert.run(userID, hashBackupCode(code));
  return codes;
}

// ---------------------------------------------------------------------------
// Per-user state
// ---------------------------------------------------------------------------

/** Wrong second factors allowed in a row before checks are locked for LOCK_MS. */
export const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface MfaRow {
  totp_secret: string;
  totp_last_step: number;
  failed_attempts: number;
  locked_until: string | null;
}

const getMfaRow = (db: DB, userID: string) =>
  db.prepare('SELECT * FROM user_mfa WHERE user_id = ?').get(userID) as MfaRow | undefined;

export const isMfaEnabled = (db: DB, userID: string) => !!getMfaRow(db, userID);

/** Turns TOTP on with a secret the client generated (and checked against the user's app); returns backup codes. */
export function enableTotp(db: DB, userID: string, secret: string): string[] {
  return db.transaction(() => {
    db.prepare(
      'INSERT OR REPLACE INTO user_mfa (user_id, totp_secret, totp_last_step, enabled_at) VALUES (?, ?, 0, ?)'
    ).run(userID, secret.toUpperCase().replace(/=+$/, ''), now());
    return replaceBackupCodes(db, userID);
  })();
}

export function disableTotp(db: DB, userID: string) {
  db.transaction(() => {
    db.prepare('DELETE FROM user_mfa WHERE user_id = ?').run(userID);
    db.prepare('DELETE FROM mfa_backup_codes WHERE user_id = ?').run(userID);
  })();
}

export const regenerateBackupCodes = (db: DB, userID: string) => db.transaction(() => replaceBackupCodes(db, userID))();

/**
 * Checks a second factor: a 6-digit TOTP code (each code is accepted once) or an unused backup code (which is
 * then used up). Returns false when MFA is not enabled, and while checks are locked after too many wrong codes.
 */
export function verifyMfaToken(db: DB, userID: string, token: string, timeMs = Date.now()): boolean {
  const mfa = getMfaRow(db, userID);
  if (!mfa) return false;
  if (mfa.locked_until && new Date(mfa.locked_until).getTime() > timeMs) return false;

  const trimmed = token.trim();
  let ok = false;
  if (/^\d{6}$/.test(trimmed)) {
    const step = matchTotp(mfa.totp_secret, trimmed, mfa.totp_last_step, timeMs);
    if (step !== null) {
      db.prepare('UPDATE user_mfa SET totp_last_step = ? WHERE user_id = ?').run(step, userID);
      ok = true;
    }
  } else {
    const used = db
      .prepare('UPDATE mfa_backup_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL')
      .run(now(), userID, hashBackupCode(trimmed));
    ok = used.changes === 1;
  }

  if (ok) {
    db.prepare('UPDATE user_mfa SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?').run(userID);
  } else if (mfa.failed_attempts + 1 >= MAX_FAILED_ATTEMPTS) {
    db.prepare('UPDATE user_mfa SET failed_attempts = 0, locked_until = ? WHERE user_id = ?').run(
      new Date(timeMs + LOCK_MS).toISOString(),
      userID
    );
  } else {
    db.prepare('UPDATE user_mfa SET failed_attempts = failed_attempts + 1 WHERE user_id = ?').run(userID);
  }
  return ok;
}

/**
 * `User.mfa` for the user themselves. skemail-web only checks whether `totpData` is set and whether there are
 * backup codes, so neither the secret nor the codes ever leave the server again: a marker and one masked entry
 * per unused code stand in for them.
 */
export function mfaFactors(db: DB, userID: string) {
  if (!isMfaEnabled(db, userID)) return { totpData: null, backupCodes: [], webAuthnKeys: [] };
  const unused = db
    .prepare('SELECT COUNT(*) AS n FROM mfa_backup_codes WHERE user_id = ? AND used_at IS NULL')
    .get(userID) as { n: number };
  return {
    totpData: 'enabled',
    backupCodes: Array.from({ length: unused.n }, () => '*'.repeat(BACKUP_CODE_LENGTH)),
    webAuthnKeys: []
  };
}
