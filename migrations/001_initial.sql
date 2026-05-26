-- Migration 001: initial schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Guest Sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guest_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Portfolios ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  exchange         TEXT NOT NULL CHECK (exchange IN ('NSE','BSE','NSE_BSE')),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_has_one_owner CHECK (
    (user_id IS NOT NULL AND guest_session_id IS NULL) OR
    (user_id IS NULL     AND guest_session_id IS NOT NULL)
  )
);

-- ── Holdings (current aggregate position per ticker) ─────────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker       TEXT NOT NULL,
  name         TEXT NOT NULL,
  sector       TEXT NOT NULL,
  exchange     TEXT NOT NULL CHECK (exchange IN ('NSE','BSE','NSE_BSE')),
  shares       NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (shares >= 0),
  avg_cost     NUMERIC(18,4) NOT NULL CHECK (avg_cost > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, ticker)
);

-- ── Transactions (immutable ledger) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  holding_id   UUID NOT NULL REFERENCES holdings(id)  ON DELETE CASCADE,
  ticker       TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('BUY','SELL')),
  shares       NUMERIC(18,4) NOT NULL CHECK (shares > 0),
  price        NUMERIC(18,4) NOT NULL CHECK (price > 0),
  note         TEXT,
  executed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
