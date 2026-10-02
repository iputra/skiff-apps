-- One row per sent message, to enforce per-account sending limits over rolling windows.
CREATE TABLE send_log (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipients INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX send_log_user_time ON send_log(user_id, created_at);

-- MTA-STS policies of recipient domains, cached for their max_age (RFC 8461).
CREATE TABLE mta_sts_policies (
  domain TEXT PRIMARY KEY,
  policy_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
