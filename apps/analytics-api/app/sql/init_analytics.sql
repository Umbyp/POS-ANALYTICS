-- เปิด pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AI Insights (สร้างอัตโนมัติทุกวัน)
CREATE TABLE IF NOT EXISTS ai_insights (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id    TEXT NOT NULL,
  type        TEXT NOT NULL,          -- TREND, ANOMALY, FORECAST, INVENTORY, RECOMMENDATION
  severity    TEXT NOT NULL DEFAULT 'INFO',  -- INFO, WARNING, CRITICAL
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  metric      DOUBLE PRECISION,
  metadata    JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insights_store ON ai_insights(store_id, created_at DESC);

-- Chat sessions + messages
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id   TEXT NOT NULL,
  user_id    TEXT,
  title      TEXT DEFAULT 'New chat',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,           -- user, assistant
  content    TEXT NOT NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);

-- Forecast cache
CREATE TABLE IF NOT EXISTS forecast_cache (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id    TEXT NOT NULL,
  type        TEXT NOT NULL,          -- REVENUE, DEMAND, TRAFFIC
  target_date DATE NOT NULL,
  predicted   DOUBLE PRECISION NOT NULL,
  lower_bound DOUBLE PRECISION,
  upper_bound DOUBLE PRECISION,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forecast_store ON forecast_cache(store_id, type, target_date);

-- Knowledge embeddings สำหรับ RAG (pgvector)
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id   TEXT NOT NULL,
  content    TEXT NOT NULL,
  embedding  vector(768),
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
