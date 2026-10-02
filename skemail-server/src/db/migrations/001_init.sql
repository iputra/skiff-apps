-- Everything stored here is either metadata or ciphertext produced by the client.
-- The server never holds keys that can decrypt user content.

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  salt TEXT NOT NULL,
  verifier TEXT NOT NULL,
  encrypted_user_data TEXT NOT NULL,
  encrypted_document_data TEXT,
  public_key_json TEXT NOT NULL,
  signing_public_key TEXT NOT NULL,
  public_data_json TEXT NOT NULL DEFAULT '{}',
  root_org_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE email_aliases (
  alias TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_default INTEGER NOT NULL DEFAULT 0,
  display_name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX email_aliases_user ON email_aliases(user_id);

CREATE TABLE sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE srp_challenges (
  username TEXT PRIMARY KEY,
  server_secret_ephemeral TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- A thread exists once per participant: sender and every local recipient each own a copy.
CREATE TABLE threads (
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  read INTEGER NOT NULL DEFAULT 0,
  system_labels_json TEXT NOT NULL DEFAULT '[]',
  emails_updated_at TEXT NOT NULL,
  sent_label_updated_at TEXT,
  thread_content_updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX threads_user_updated ON threads(user_id, emails_updated_at);

CREATE TABLE emails (
  email_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  from_json TEXT NOT NULL,
  to_json TEXT NOT NULL,
  cc_json TEXT NOT NULL,
  bcc_json TEXT NOT NULL,
  reply_to_json TEXT,
  encrypted_subject TEXT NOT NULL,
  encrypted_text TEXT NOT NULL,
  encrypted_html TEXT NOT NULL,
  encrypted_text_as_html TEXT NOT NULL,
  encrypted_text_snippet TEXT,
  encrypted_session_key TEXT NOT NULL,
  encrypted_by_json TEXT NOT NULL,
  schedule_send_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (email_id, user_id)
);
CREATE INDEX emails_thread ON emails(user_id, thread_id, created_at);

CREATE TABLE attachments (
  attachment_id TEXT NOT NULL,
  email_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  encrypted_metadata TEXT NOT NULL,
  blob_path TEXT NOT NULL,
  PRIMARY KEY (attachment_id, user_id)
);
CREATE INDEX attachments_email ON attachments(user_id, email_id);

CREATE TABLE user_labels (
  label_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  label_name TEXT NOT NULL,
  color TEXT NOT NULL,
  variant TEXT NOT NULL
);

CREATE TABLE thread_user_labels (
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  label_id TEXT NOT NULL REFERENCES user_labels(label_id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, user_id, label_id)
);

CREATE TABLE drafts (
  draft_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  encrypted_draft TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (draft_id, user_id)
);

CREATE TABLE contacts (
  contact_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  email_address TEXT,
  first_name TEXT,
  last_name TEXT,
  encrypted_contact_data TEXT,
  encrypted_session_key TEXT,
  encrypted_by_key TEXT,
  display_picture_json TEXT
);
CREATE INDEX contacts_user ON contacts(user_id, email_address);

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL
);

CREATE TABLE server_keys (
  name TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  secret_key TEXT NOT NULL
);
