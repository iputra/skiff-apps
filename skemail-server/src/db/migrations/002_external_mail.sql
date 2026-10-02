-- RFC 5322 Message-ID of each email, used to thread replies that arrive from other mail servers.
ALTER TABLE emails ADD COLUMN message_id TEXT;
CREATE INDEX emails_message_id ON emails(user_id, message_id);

-- Outbound deliveries to other mail servers. Only references and ciphertext are stored: the MIME message is
-- rebuilt from the sender's encrypted copy on every attempt, so no plaintext rests on disk.
CREATE TABLE outbound_queue (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  email_id TEXT NOT NULL,
  -- Session key encrypted for the server's decryption-service key (SendEmailRequest.externalEncryptedSessionKey).
  external_session_key TEXT NOT NULL,
  external_session_key_by_json TEXT NOT NULL,
  -- Envelope recipients on one domain.
  recipients_json TEXT NOT NULL,
  domain TEXT NOT NULL,
  in_reply_to TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX outbound_queue_due ON outbound_queue(status, next_attempt_at);

-- Client-side mail filters run in the browser (the server cannot read E2EE mail). The client asks for threads
-- not yet filtered and then marks them; a new incoming email makes its thread unfiltered again.
ALTER TABLE threads ADD COLUMN clientside_filters_applied INTEGER NOT NULL DEFAULT 1;
