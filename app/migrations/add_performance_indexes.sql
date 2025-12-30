-- Performance indexes for transactions_normalized table
-- Run this on production database

CREATE INDEX IF NOT EXISTS idx_tx_artist_name ON transactions_normalized(artist_name);
CREATE INDEX IF NOT EXISTS idx_tx_period ON transactions_normalized(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tx_isrc ON transactions_normalized(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_upc ON transactions_normalized(upc) WHERE upc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tx_artist_period ON transactions_normalized(artist_name, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_tx_import_id ON transactions_normalized(import_id);

-- Analyze table to update statistics
ANALYZE transactions_normalized;
