-- Migration 002: indexes and updated_at triggers

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id
  ON portfolios(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portfolios_guest_session_id
  ON portfolios(guest_session_id) WHERE guest_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id
  ON holdings(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_holdings_ticker
  ON holdings(ticker);

CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id
  ON transactions(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_transactions_holding_id
  ON transactions(holding_id);

CREATE INDEX IF NOT EXISTS idx_transactions_executed_at
  ON transactions(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires_at
  ON guest_sessions(expires_at);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
