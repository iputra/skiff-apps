import { randomBytes, randomUUID } from 'crypto';

import nacl from 'tweetnacl';

import { DB, fromJSON, now, toJSON } from './db';

// ---------------------------------------------------------------------------
// Sessions and SRP challenges
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SRP_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createSession(db: DB, userID: string): string {
  const sessionID = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    sessionID,
    userID,
    now(),
    new Date(Date.now() + SESSION_TTL_MS).toISOString()
  );
  return sessionID;
}

export function getSessionUserID(db: DB, sessionID: string): string | null {
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE session_id = ?').get(sessionID) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row.user_id;
}

export const deleteSession = (db: DB, sessionID: string) =>
  db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionID);

export function saveSrpChallenge(db: DB, username: string, serverSecretEphemeral: string) {
  db.prepare(
    'INSERT OR REPLACE INTO srp_challenges (username, server_secret_ephemeral, expires_at) VALUES (?, ?, ?)'
  ).run(username, serverSecretEphemeral, new Date(Date.now() + SRP_CHALLENGE_TTL_MS).toISOString());
}

/** Returns and consumes the pending challenge, so each step-1 response can be used once. */
export function takeSrpChallenge(db: DB, username: string): string | null {
  const row = db.prepare('SELECT * FROM srp_challenges WHERE username = ?').get(username) as
    | { server_secret_ephemeral: string; expires_at: string }
    | undefined;
  db.prepare('DELETE FROM srp_challenges WHERE username = ?').run(username);
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row.server_secret_ephemeral;
}

// ---------------------------------------------------------------------------
// Drafts, contacts, preferences
// ---------------------------------------------------------------------------

export function upsertDraft(
  db: DB,
  userID: string,
  d: { draftID: string; encryptedDraft: string; encryptedKey: string }
) {
  db.prepare(
    `INSERT INTO drafts (draft_id, user_id, encrypted_draft, encrypted_key, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(draft_id, user_id) DO UPDATE SET encrypted_draft = excluded.encrypted_draft,
       encrypted_key = excluded.encrypted_key, updated_at = excluded.updated_at`
  ).run(d.draftID, userID, d.encryptedDraft, d.encryptedKey, now());
}

export function listDrafts(db: DB, userID: string) {
  return (
    db.prepare('SELECT * FROM drafts WHERE user_id = ? ORDER BY updated_at DESC').all(userID) as {
      draft_id: string;
      encrypted_draft: string;
      encrypted_key: string;
      updated_at: string;
    }[]
  ).map((r) => ({
    draftID: r.draft_id,
    encryptedDraft: r.encrypted_draft,
    encryptedKey: r.encrypted_key,
    updatedAt: new Date(r.updated_at)
  }));
}

export const deleteDraft = (db: DB, userID: string, draftID: string) =>
  db.prepare('DELETE FROM drafts WHERE user_id = ? AND draft_id = ?').run(userID, draftID);

interface ContactRow {
  contact_id: string;
  email_address: string | null;
  first_name: string | null;
  last_name: string | null;
  encrypted_contact_data: string | null;
  encrypted_session_key: string | null;
  encrypted_by_key: string | null;
  display_picture_json: string | null;
}

const toGraphQLContact = (r: ContactRow) => ({
  contactID: r.contact_id,
  emailAddress: r.email_address,
  firstName: r.first_name,
  lastName: r.last_name,
  encryptedContactData: r.encrypted_contact_data,
  encryptedSessionKey: r.encrypted_session_key,
  encryptedByKey: r.encrypted_by_key,
  displayPictureData: fromJSON<Record<string, unknown> | null>(r.display_picture_json, null)
});

export function listContacts(db: DB, userID: string, emailAddresses?: string[]) {
  const rows = db
    .prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY email_address')
    .all(userID) as ContactRow[];
  const filter = emailAddresses?.map((a) => a.toLowerCase());
  return rows.filter((r) => !filter || (r.email_address && filter.includes(r.email_address))).map(toGraphQLContact);
}

export interface ContactInput {
  contactID?: string | null;
  emailAddress?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  encryptedContactData?: string | null;
  encryptedSessionKey?: string | null;
  encryptedByKey?: string | null;
  displayPictureData?: unknown;
}

export function upsertContact(db: DB, userID: string, c: ContactInput) {
  const email = c.emailAddress?.toLowerCase() ?? null;
  const existing = (
    c.contactID
      ? db.prepare('SELECT contact_id FROM contacts WHERE user_id = ? AND contact_id = ?').get(userID, c.contactID)
      : email
      ? db.prepare('SELECT contact_id FROM contacts WHERE user_id = ? AND email_address = ?').get(userID, email)
      : undefined
  ) as { contact_id: string } | undefined;
  const contactID = existing?.contact_id ?? c.contactID ?? randomUUID();
  db.prepare(
    `INSERT INTO contacts (contact_id, user_id, email_address, first_name, last_name, encrypted_contact_data,
       encrypted_session_key, encrypted_by_key, display_picture_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(contact_id) DO UPDATE SET email_address = excluded.email_address, first_name = excluded.first_name,
       last_name = excluded.last_name, encrypted_contact_data = excluded.encrypted_contact_data,
       encrypted_session_key = excluded.encrypted_session_key, encrypted_by_key = excluded.encrypted_by_key,
       display_picture_json = excluded.display_picture_json`
  ).run(
    contactID,
    userID,
    email,
    c.firstName ?? null,
    c.lastName ?? null,
    c.encryptedContactData ?? null,
    c.encryptedSessionKey ?? null,
    c.encryptedByKey ?? null,
    c.displayPictureData ? toJSON(c.displayPictureData) : null
  );
}

export function deleteContacts(db: DB, userID: string, by: { contactIDs?: string[]; emailAddress?: string | null }) {
  if (by.emailAddress) {
    db.prepare('DELETE FROM contacts WHERE user_id = ? AND email_address = ?').run(
      userID,
      by.emailAddress.toLowerCase()
    );
  }
  const stmt = db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?');
  for (const id of by.contactIDs ?? []) stmt.run(userID, id);
}

export function getPreferences(db: DB, userID: string): Record<string, unknown> {
  const row = db.prepare('SELECT preferences_json FROM user_preferences WHERE user_id = ?').get(userID) as
    | { preferences_json: string }
    | undefined;
  return fromJSON(row?.preferences_json, {});
}

export function setPreferences(db: DB, userID: string, patch: Record<string, unknown>) {
  const merged = { ...getPreferences(db, userID) };
  // Only fields the client actually sent overwrite stored values.
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) merged[k] = v;
  db.prepare(
    `INSERT INTO user_preferences (user_id, preferences_json) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET preferences_json = excluded.preferences_json`
  ).run(userID, toJSON(merged));
  return merged;
}

// ---------------------------------------------------------------------------
// Server keypairs
// ---------------------------------------------------------------------------

/** Keypair used later to decrypt session keys for external (SMTP) delivery. Created once and persisted. */
export function getOrCreateServerKey(db: DB, name: string): { publicKey: string; secretKey: string } {
  const row = db.prepare('SELECT public_key, secret_key FROM server_keys WHERE name = ?').get(name) as
    | { public_key: string; secret_key: string }
    | undefined;
  if (row) return { publicKey: row.public_key, secretKey: row.secret_key };
  const kp = nacl.box.keyPair();
  const keys = {
    publicKey: Buffer.from(kp.publicKey).toString('base64'),
    secretKey: Buffer.from(kp.secretKey).toString('base64')
  };
  db.prepare('INSERT INTO server_keys (name, public_key, secret_key) VALUES (?, ?, ?)').run(
    name,
    keys.publicKey,
    keys.secretKey
  );
  return keys;
}
