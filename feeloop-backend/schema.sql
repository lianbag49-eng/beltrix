-- FEELOOP PostgreSQL persistence layer.
-- The application stores its initial transactional state in a namespaced JSONB row.
-- This can later be normalized into dedicated relational tables without changing the public API.

CREATE SCHEMA IF NOT EXISTS feeloop;

CREATE TABLE IF NOT EXISTS feeloop.app_state (
  id SMALLINT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE feeloop.app_state IS 'Namespaced FEELOOP application state. Initial deployment persistence layer.';
