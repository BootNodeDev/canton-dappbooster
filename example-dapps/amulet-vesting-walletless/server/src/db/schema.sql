-- Rerun on every server start, so it stays idempotent. Times are epoch milliseconds.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  party_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS escrow_disclosures (
  contract_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  blob TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
