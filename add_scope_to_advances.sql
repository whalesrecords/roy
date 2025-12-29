-- Add scope columns to advance_ledger table
ALTER TABLE advance_ledger 
ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'catalog' NOT NULL,
ADD COLUMN IF NOT EXISTS scope_id VARCHAR(50) DEFAULT NULL;

-- Create index for scope lookups
CREATE INDEX IF NOT EXISTS idx_advance_ledger_scope ON advance_ledger(scope, scope_id);
