-- Unified inference records. Conversation/wake references are added in 0040.
CREATE TABLE agent_runs (
  run_id TEXT PRIMARY KEY NOT NULL,
  spec_id TEXT NOT NULL,
  spec_version TEXT NOT NULL,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  user_id TEXT,
  agent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('prepared','deciding','observing','generating','completed','no_output','failed','cancelled')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  error_code TEXT
);
CREATE INDEX ix_agent_runs_owner ON agent_runs(owner_kind, owner_id, started_at);
CREATE INDEX ix_agent_runs_user ON agent_runs(user_id, started_at);

CREATE TABLE agent_steps (
  step_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL CHECK (step_no > 0),
  model TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('leaf','next','generate','vision')),
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed','cancelled')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  error_code TEXT,
  decision TEXT,
  UNIQUE(run_id, step_no)
);
CREATE TABLE context_snapshots (
  step_id TEXT PRIMARY KEY NOT NULL REFERENCES agent_steps(step_id) ON DELETE CASCADE,
  source_refs TEXT NOT NULL CHECK (json_valid(source_refs)),
  layout TEXT NOT NULL CHECK (json_valid(layout)),
  expires_at TEXT,
  protected_messages TEXT CHECK (protected_messages IS NULL OR json_valid(protected_messages)),
  status TEXT NOT NULL CHECK (status IN ('exact','expired','revoked'))
);
CREATE INDEX ix_context_snapshots_expiry ON context_snapshots(expires_at);
CREATE TABLE run_events (
  run_id TEXT NOT NULL REFERENCES agent_runs(run_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq > 0),
  type TEXT NOT NULL,
  at TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  PRIMARY KEY(run_id, seq)
);
