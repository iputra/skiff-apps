-- TOTP two-factor authentication. The secret has to be readable by the server to check codes, as with any TOTP
-- service; mail content stays end-to-end encrypted regardless.
CREATE TABLE user_mfa (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  totp_secret TEXT NOT NULL,
  -- Highest TOTP time step accepted so far: a code cannot be used twice.
  totp_last_step INTEGER NOT NULL DEFAULT 0,
  enabled_at TEXT NOT NULL,
  -- Wrong codes in a row; too many lock second-factor checks for a while (someone who knows the password could
  -- otherwise try all 10^6 codes).
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

-- Single-use backup codes, stored as SHA-256 hashes (they are random, so no slow hash is needed).
CREATE TABLE mfa_backup_codes (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  PRIMARY KEY (user_id, code_hash)
);

-- SRP proofs that already passed. skemail-web re-sends the same proof for a confirmation step (for example,
-- the password dialog checks it, then enabling 2FA sends it again), so a proof may be checked again for a few
-- minutes, but only from a session of the same user.
CREATE TABLE srp_verified (
  username TEXT NOT NULL,
  client_ephemeral_public TEXT NOT NULL,
  client_session_proof TEXT NOT NULL,
  server_session_proof TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (username, client_ephemeral_public)
);
