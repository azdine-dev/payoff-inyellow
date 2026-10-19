-- Shopify orders: one order = one unlock code, and refunds.

CREATE TABLE IF NOT EXISTS orders (
  order_id   TEXT PRIMARY KEY,          -- Shopify order id (the idempotency key)
  code_id    TEXT NOT NULL UNIQUE,      -- the id signed into the code, like shopify-1042
  code       TEXT NOT NULL,             -- the code that was made, so a retry sends the same one
  email      TEXT,
  total      REAL NOT NULL DEFAULT 0,   -- order total, to know when a refund covers all of it
  status     TEXT NOT NULL,             -- pending | sent | no_email
  created_at INTEGER NOT NULL,
  sent_at    INTEGER
);

-- Each refund is counted once, even if Shopify sends the webhook again.
CREATE TABLE IF NOT EXISTS refunds (
  refund_id  TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL,
  amount     REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS refunds_order ON refunds (order_id);
