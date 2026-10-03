import { randomUUID } from 'crypto';

import { DB, fromJSON, now, toJSON } from './db';

export interface PublicKey {
  key: string;
  signature?: string | null;
}

export interface UserRow {
  user_id: string;
  username: string;
  salt: string;
  verifier: string;
  encrypted_user_data: string;
  encrypted_document_data: string | null;
  public_key_json: string;
  signing_public_key: string;
  public_data_json: string;
  root_org_id: string;
  created_at: string;
}

export interface NewUser {
  username: string;
  salt: string;
  verifier: string;
  encryptedUserData: string;
  publicKey: PublicKey;
  signingPublicKey: string;
  displayName?: string;
}

export const normalizeAddress = (address: string) => address.trim().toLowerCase();

export function createUser(db: DB, input: NewUser): UserRow {
  const userID = randomUUID();
  const username = normalizeAddress(input.username);
  const createdAt = now();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO users (user_id, username, salt, verifier, encrypted_user_data, public_key_json,
         signing_public_key, public_data_json, root_org_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userID,
      username,
      input.salt,
      input.verifier,
      input.encryptedUserData,
      toJSON(input.publicKey),
      input.signingPublicKey,
      toJSON(input.displayName ? { displayName: input.displayName } : {}),
      randomUUID(),
      createdAt
    );
    // The username of a mail account is its first email alias.
    db.prepare('INSERT INTO email_aliases (alias, user_id, is_default, created_at) VALUES (?, ?, 1, ?)').run(
      username,
      userID,
      createdAt
    );
  })();
  return getUserByID(db, userID)!;
}

export const getUserByID = (db: DB, userID: string) =>
  db.prepare('SELECT * FROM users WHERE user_id = ?').get(userID) as UserRow | undefined;

export const getUserByUsername = (db: DB, username: string) =>
  db.prepare('SELECT * FROM users WHERE username = ?').get(normalizeAddress(username)) as UserRow | undefined;

export function getUserByAlias(db: DB, alias: string): UserRow | undefined {
  return db
    .prepare('SELECT u.* FROM users u JOIN email_aliases a ON a.user_id = u.user_id WHERE a.alias = ?')
    .get(normalizeAddress(alias)) as UserRow | undefined;
}

export function getAliases(
  db: DB,
  userID: string
): { alias: string; is_default: number; display_name: string | null }[] {
  return db
    .prepare('SELECT alias, is_default, display_name FROM email_aliases WHERE user_id = ? ORDER BY created_at, alias')
    .all(userID) as { alias: string; is_default: number; display_name: string | null }[];
}

export function getDefaultAlias(db: DB, userID: string): string | null {
  const aliases = getAliases(db, userID);
  return (aliases.find((a) => a.is_default) ?? aliases[0])?.alias ?? null;
}

export function setDefaultAlias(db: DB, userID: string, alias: string): boolean {
  const owned = getAliases(db, userID).some((a) => a.alias === normalizeAddress(alias));
  if (!owned) return false;
  db.transaction(() => {
    db.prepare('UPDATE email_aliases SET is_default = 0 WHERE user_id = ?').run(userID);
    db.prepare('UPDATE email_aliases SET is_default = 1 WHERE alias = ?').run(normalizeAddress(alias));
  })();
  return true;
}

export function updateSrp(
  db: DB,
  userID: string,
  input: { salt: string; verifier: string; encryptedUserData: string }
) {
  db.prepare('UPDATE users SET salt = ?, verifier = ?, encrypted_user_data = ? WHERE user_id = ?').run(
    input.salt,
    input.verifier,
    input.encryptedUserData,
    userID
  );
}

/** Shape shared by every `User` field resolver. */
export function toGraphQLUser(db: DB, row: UserRow) {
  const aliases = getAliases(db, row.user_id).map((a) => a.alias);
  return {
    userID: row.user_id,
    username: row.username,
    publicKey: fromJSON<PublicKey>(row.public_key_json, { key: '' }),
    signingPublicKey: row.signing_public_key,
    publicData: fromJSON<Record<string, unknown>>(row.public_data_json, {}),
    rootOrgID: row.root_org_id,
    emailAliases: aliases,
    defaultEmailAlias: getDefaultAlias(db, row.user_id),
    // Always ask for the current password (and 2FA code) before changing it; see updateSrp.
    canDirectlyUpdateSrp: false,
    storageUsed: '0',
    accountTags: [],
    quickAliases: [],
    anonymousSubdomains: [],
    customDomainSubscriptionsInfo: [],
    numDeactivatedAnonymousSubdomains: 0,
    paidUpStatus: { paidUp: true, downgradeProgress: {} },
    skemailStorageUsage: { attachmentUsageBytes: '0', messageUsageBytes: '0' },
    invoiceHistory: { invoiceHistory: [] },
    subscriptionInfo: {
      // A TierName ('Free'), not the SubscriptionPlan enum: see useSubscriptionPlan in skiff-front-graphql.
      subscriptionPlan: 'Free',
      cancelAtPeriodEnd: false,
      isAppleSubscription: false,
      isCryptoSubscription: false,
      isGoogleSubscription: false,
      billingInterval: null,
      supposedEndDate: null,
      stripeStatus: null
    },
    rootOrganization: {
      orgID: row.root_org_id,
      name: row.username,
      hasCustomized: false,
      rootDocID: '',
      displayPictureData: {},
      teams: []
    },
    subscribedToPD: false,
    autoSyncContactsSetting: false
  };
}
