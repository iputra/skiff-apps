import { randomUUID } from 'crypto';

import { DB, fromJSON, toJSON } from './db';
import { PublicKey } from './users';

/** Mailboxes a thread can only be in one of at a time. */
const EXCLUSIVE_LABELS = ['INBOX', 'ARCHIVE', 'TRASH', 'SPAM'];
/** Threads with these labels are hidden from every other mailbox. */
const HIDING_LABELS = ['TRASH', 'SPAM'];

export interface Address {
  address: string;
  name?: string | null;
  blocked?: boolean | null;
}

interface ThreadRow {
  thread_id: string;
  user_id: string;
  read: number;
  system_labels_json: string;
  emails_updated_at: string;
  sent_label_updated_at: string | null;
  thread_content_updated_at: string;
  deleted_at: string | null;
}

interface EmailRow {
  email_id: string;
  thread_id: string;
  user_id: string;
  from_json: string;
  to_json: string;
  cc_json: string;
  bcc_json: string;
  reply_to_json: string | null;
  encrypted_subject: string;
  encrypted_text: string;
  encrypted_html: string;
  encrypted_text_as_html: string;
  encrypted_text_snippet: string | null;
  encrypted_session_key: string;
  encrypted_by_json: string;
  schedule_send_at: string | null;
  created_at: string;
}

export interface UserLabelRow {
  label_id: string;
  user_id: string;
  label_name: string;
  color: string;
  variant: string;
}

export interface NewEmail {
  emailID: string;
  threadID: string;
  userID: string;
  from: Address;
  to: Address[];
  cc: Address[];
  bcc: Address[];
  replyTo?: Address | null;
  encryptedSubject: string;
  encryptedText: string;
  encryptedHtml: string;
  encryptedTextAsHtml: string;
  encryptedTextSnippet?: string | null;
  encryptedSessionKey: string;
  encryptedBy: PublicKey;
  scheduleSendAt?: Date | null;
  createdAt: string;
}

const labelsOf = (row: ThreadRow) => fromJSON<string[]>(row.system_labels_json, []);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Adds an email to the user's copy of a thread, creating the thread if needed. */
export function deliverEmail(
  db: DB,
  email: NewEmail,
  options: { addLabels: string[]; read: boolean },
  attachments: { attachmentID: string; encryptedMetadata: string; blobPath: string }[]
) {
  db.transaction(() => {
    const existing = getThreadRow(db, email.userID, email.threadID);
    const isSent = options.addLabels.includes('SENT');
    if (existing) {
      const labels = new Set(labelsOf(existing));
      // A new message brings an archived/trashed thread back to the inbox.
      if (options.addLabels.includes('INBOX')) EXCLUSIVE_LABELS.forEach((l) => labels.delete(l));
      options.addLabels.forEach((l) => labels.add(l));
      db.prepare(
        `UPDATE threads SET system_labels_json = ?, read = ?, emails_updated_at = ?, thread_content_updated_at = ?,
           sent_label_updated_at = COALESCE(?, sent_label_updated_at), deleted_at = NULL
         WHERE thread_id = ? AND user_id = ?`
      ).run(
        toJSON([...labels]),
        options.read ? 1 : 0,
        email.createdAt,
        email.createdAt,
        isSent ? email.createdAt : null,
        email.threadID,
        email.userID
      );
    } else {
      db.prepare(
        `INSERT INTO threads (thread_id, user_id, read, system_labels_json, emails_updated_at,
           sent_label_updated_at, thread_content_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        email.threadID,
        email.userID,
        options.read ? 1 : 0,
        toJSON(options.addLabels),
        email.createdAt,
        isSent ? email.createdAt : null,
        email.createdAt
      );
    }
    db.prepare(
      `INSERT INTO emails (email_id, thread_id, user_id, from_json, to_json, cc_json, bcc_json, reply_to_json,
         encrypted_subject, encrypted_text, encrypted_html, encrypted_text_as_html, encrypted_text_snippet,
         encrypted_session_key, encrypted_by_json, schedule_send_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      email.emailID,
      email.threadID,
      email.userID,
      toJSON(email.from),
      toJSON(email.to),
      toJSON(email.cc),
      toJSON(email.bcc),
      email.replyTo ? toJSON(email.replyTo) : null,
      email.encryptedSubject,
      email.encryptedText,
      email.encryptedHtml,
      email.encryptedTextAsHtml,
      email.encryptedTextSnippet ?? null,
      email.encryptedSessionKey,
      toJSON(email.encryptedBy),
      email.scheduleSendAt ? email.scheduleSendAt.toISOString() : null,
      email.createdAt
    );
    const insertAttachment = db.prepare(
      'INSERT INTO attachments (attachment_id, email_id, user_id, encrypted_metadata, blob_path) VALUES (?, ?, ?, ?, ?)'
    );
    for (const a of attachments)
      insertAttachment.run(a.attachmentID, email.emailID, email.userID, a.encryptedMetadata, a.blobPath);
  })();
}

export function setRead(db: DB, userID: string, threadIDs: string[], read: boolean): string[] {
  const stmt = db.prepare('UPDATE threads SET read = ? WHERE user_id = ? AND thread_id = ?');
  return threadIDs.filter((id) => stmt.run(read ? 1 : 0, userID, id).changes > 0);
}

export function setReadForLabel(db: DB, userID: string, label: string, read: boolean) {
  const ids = listThreadIDs(db, userID, { label });
  setRead(db, userID, ids, read);
}

export function modifySystemLabels(db: DB, userID: string, threadIDs: string[], add: string[], remove: string[]) {
  const update = db.prepare('UPDATE threads SET system_labels_json = ? WHERE user_id = ? AND thread_id = ?');
  db.transaction(() => {
    for (const id of threadIDs) {
      const row = getThreadRow(db, userID, id);
      if (!row) continue;
      const labels = new Set(labelsOf(row));
      if (add.some((l) => EXCLUSIVE_LABELS.includes(l))) EXCLUSIVE_LABELS.forEach((l) => labels.delete(l));
      add.forEach((l) => labels.add(l));
      remove.forEach((l) => labels.delete(l));
      update.run(toJSON([...labels]), userID, id);
    }
  })();
}

export function modifyUserLabels(db: DB, userID: string, threadIDs: string[], add: string[], remove: string[]) {
  const ins = db.prepare('INSERT OR IGNORE INTO thread_user_labels (thread_id, user_id, label_id) VALUES (?, ?, ?)');
  const del = db.prepare('DELETE FROM thread_user_labels WHERE thread_id = ? AND user_id = ? AND label_id = ?');
  const owned = new Set(listUserLabels(db, userID).map((l) => l.label_id));
  db.transaction(() => {
    for (const id of threadIDs) {
      add.filter((l) => owned.has(l)).forEach((l) => ins.run(id, userID, l));
      remove.forEach((l) => del.run(id, userID, l));
    }
  })();
}

export function deleteThreads(db: DB, userID: string, threadIDs: string[]) {
  db.transaction(() => {
    for (const id of threadIDs) {
      db.prepare(
        'DELETE FROM attachments WHERE user_id = ? AND email_id IN (SELECT email_id FROM emails WHERE user_id = ? AND thread_id = ?)'
      ).run(userID, userID, id);
      db.prepare('DELETE FROM emails WHERE user_id = ? AND thread_id = ?').run(userID, id);
      db.prepare('DELETE FROM thread_user_labels WHERE user_id = ? AND thread_id = ?').run(userID, id);
      db.prepare('DELETE FROM threads WHERE user_id = ? AND thread_id = ?').run(userID, id);
    }
  })();
}

// ---------------------------------------------------------------------------
// User labels
// ---------------------------------------------------------------------------

export const listUserLabels = (db: DB, userID: string) =>
  db.prepare('SELECT * FROM user_labels WHERE user_id = ? ORDER BY label_name').all(userID) as UserLabelRow[];

export function createUserLabel(db: DB, userID: string, input: { labelName: string; color: string; variant: string }) {
  const labelID = randomUUID();
  db.prepare('INSERT INTO user_labels (label_id, user_id, label_name, color, variant) VALUES (?, ?, ?, ?, ?)').run(
    labelID,
    userID,
    input.labelName,
    input.color,
    input.variant
  );
  return toGraphQLLabel(db.prepare('SELECT * FROM user_labels WHERE label_id = ?').get(labelID) as UserLabelRow);
}

export function editUserLabel(
  db: DB,
  userID: string,
  input: { labelID: string; labelName?: string | null; color?: string | null; variant?: string | null }
) {
  db.prepare(
    `UPDATE user_labels SET label_name = COALESCE(?, label_name), color = COALESCE(?, color), variant = COALESCE(?, variant)
     WHERE label_id = ? AND user_id = ?`
  ).run(input.labelName ?? null, input.color ?? null, input.variant ?? null, input.labelID, userID);
  const row = db.prepare('SELECT * FROM user_labels WHERE label_id = ? AND user_id = ?').get(input.labelID, userID) as
    | UserLabelRow
    | undefined;
  return row ? toGraphQLLabel(row) : null;
}

export const deleteUserLabel = (db: DB, userID: string, labelID: string) =>
  db.prepare('DELETE FROM user_labels WHERE label_id = ? AND user_id = ?').run(labelID, userID);

export const toGraphQLLabel = (row: UserLabelRow) => ({
  labelID: row.label_id,
  labelName: row.label_name,
  color: row.color,
  variant: row.variant
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const getThreadRow = (db: DB, userID: string, threadID: string) =>
  db.prepare('SELECT * FROM threads WHERE user_id = ? AND thread_id = ?').get(userID, threadID) as
    | ThreadRow
    | undefined;

export function threadUserLabelIDs(db: DB, userID: string, threadID: string): string[] {
  return (
    db.prepare('SELECT label_id FROM thread_user_labels WHERE user_id = ? AND thread_id = ?').all(userID, threadID) as {
      label_id: string;
    }[]
  ).map((r) => r.label_id);
}

export interface MailboxQuery {
  label?: string | null;
  userLabels?: string[] | null;
  read?: boolean | null;
  before?: { date: Date; threadID: string } | null;
  updatedAfter?: Date | null;
  limit?: number | null;
  sortBySent?: boolean;
}

/** Thread IDs in a mailbox, newest first. `label` is a system label (e.g. INBOX) or a user labelID. */
export function listThreadIDs(db: DB, userID: string, q: MailboxQuery): string[] {
  const userLabelIDs = new Set(listUserLabels(db, userID).map((l) => l.label_id));
  const sortCol = q.sortBySent ? 'COALESCE(sent_label_updated_at, emails_updated_at)' : 'emails_updated_at';
  let rows = db
    .prepare(
      `SELECT *, ${sortCol} AS sort_at FROM threads WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_at DESC, thread_id DESC`
    )
    .all(userID) as (ThreadRow & { sort_at: string })[];

  const wanted = [q.label, ...(q.userLabels ?? [])].filter((l): l is string => !!l);
  rows = rows.filter((row) => {
    const sys = labelsOf(row);
    const userLabels = threadUserLabelIDs(db, userID, row.thread_id);
    for (const label of wanted) {
      const matches = userLabelIDs.has(label) ? userLabels.includes(label) : sys.includes(label);
      if (!matches) return false;
    }
    if (!wanted.some((l) => HIDING_LABELS.includes(l)) && sys.some((l) => HIDING_LABELS.includes(l))) return false;
    if (q.read !== null && q.read !== undefined && !!row.read !== q.read) return false;
    if (q.updatedAfter && new Date(row.emails_updated_at) <= q.updatedAfter) return false;
    if (q.before) {
      const at = new Date(row.sort_at).getTime();
      const cursorAt = q.before.date.getTime();
      if (at > cursorAt || (at === cursorAt && row.thread_id >= q.before.threadID)) return false;
    }
    return true;
  });
  const ids = rows.map((r) => r.thread_id);
  return q.limit ? ids.slice(0, q.limit) : ids;
}

export function countUnread(db: DB, userID: string, label: string): number {
  return listThreadIDs(db, userID, { label, read: false }).length;
}

const emailAddressObjects = (json: string) => fromJSON<Address[]>(json, []);

function toGraphQLEmail(db: DB, row: EmailRow, viewerIsSender: boolean) {
  const attachments = db
    .prepare('SELECT attachment_id, encrypted_metadata FROM attachments WHERE user_id = ? AND email_id = ?')
    .all(row.user_id, row.email_id) as { attachment_id: string; encrypted_metadata: string }[];
  return {
    id: row.email_id,
    createdAt: new Date(row.created_at),
    from: fromJSON<Address>(row.from_json, { address: '' }),
    to: emailAddressObjects(row.to_json),
    cc: emailAddressObjects(row.cc_json),
    // Only the sender's copy reveals BCC recipients.
    bcc: viewerIsSender ? emailAddressObjects(row.bcc_json) : [],
    replyTo: row.reply_to_json ? fromJSON<Address>(row.reply_to_json, { address: '' }) : null,
    encryptedSubject: { encryptedData: row.encrypted_subject },
    encryptedText: { encryptedData: row.encrypted_text },
    encryptedHtml: { encryptedData: row.encrypted_html },
    encryptedTextAsHtml: { encryptedData: row.encrypted_text_as_html },
    encryptedTextSnippet: row.encrypted_text_snippet ? { encryptedData: row.encrypted_text_snippet } : null,
    encryptedSessionKey: {
      encryptedSessionKey: row.encrypted_session_key,
      encryptedBy: fromJSON<PublicKey>(row.encrypted_by_json, { key: '' })
    },
    attachmentMetadata: attachments.map((a) => ({
      attachmentID: a.attachment_id,
      encryptedData: { encryptedData: a.encrypted_metadata }
    })),
    scheduleSendAt: row.schedule_send_at ? new Date(row.schedule_send_at) : null,
    notificationsTurnedOffForSender: false,
    encryptedRawMimeUrl: null
  };
}

export function getThread(db: DB, userID: string, threadID: string, viewerAliases: string[], includeDeleted = false) {
  const row = getThreadRow(db, userID, threadID);
  if (!row || (row.deleted_at && !includeDeleted)) return null;
  const emails = db
    .prepare('SELECT * FROM emails WHERE user_id = ? AND thread_id = ? ORDER BY created_at ASC')
    .all(userID, threadID) as EmailRow[];
  const labelIDs = new Set(threadUserLabelIDs(db, userID, threadID));
  return {
    threadID: row.thread_id,
    attributes: {
      read: !!row.read,
      systemLabels: labelsOf(row),
      userLabels: listUserLabels(db, userID)
        .filter((l) => labelIDs.has(l.label_id))
        .map(toGraphQLLabel)
    },
    emails: emails.map((e) =>
      toGraphQLEmail(
        db,
        e,
        viewerAliases.includes(fromJSON<Address>(e.from_json, { address: '' }).address.toLowerCase())
      )
    ),
    emailsUpdatedAt: new Date(row.emails_updated_at),
    sentLabelUpdatedAt: row.sent_label_updated_at ? new Date(row.sent_label_updated_at) : null,
    threadContentUpdatedAt: new Date(row.thread_content_updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    senderToSilence: null,
    senderToSilenceMessageCounter: null,
    senderToSilenceTotalBytes: null
  };
}

export function findThreadIDForEmail(db: DB, userID: string, emailID: string): string | null {
  const row = db.prepare('SELECT thread_id FROM emails WHERE user_id = ? AND email_id = ?').get(userID, emailID) as
    | { thread_id: string }
    | undefined;
  return row?.thread_id ?? null;
}

export function getAttachment(db: DB, userID: string, attachmentID: string) {
  return db
    .prepare(
      `SELECT a.attachment_id, a.blob_path, e.encrypted_session_key, e.encrypted_by_json
       FROM attachments a JOIN emails e ON e.email_id = a.email_id AND e.user_id = a.user_id
       WHERE a.user_id = ? AND a.attachment_id = ?`
    )
    .get(userID, attachmentID) as
    | { attachment_id: string; blob_path: string; encrypted_session_key: string; encrypted_by_json: string }
    | undefined;
}
