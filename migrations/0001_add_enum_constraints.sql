-- Migration: Add CHECK constraints for enum-like text columns
-- These constraints enforce at the database level the same values
-- that are validated by Zod schemas in the application layer.

-- chat_messages.role: validated by z.enum(["user", "assistant", "system"]) in shared/schema.ts
ALTER TABLE chat_messages
  ADD CONSTRAINT chk_chat_role
  CHECK (role IN ('user', 'assistant', 'system'));

-- validation_issues.severity: validated by z.enum(["error", "warning", "info"]) in shared/schema.ts
ALTER TABLE validation_issues
  ADD CONSTRAINT chk_validation_severity
  CHECK (severity IN ('error', 'warning', 'info'));

-- bom_items.status: validated by z.enum(["In Stock", "Low Stock", "Out of Stock", "On Order"]) in shared/schema.ts
ALTER TABLE bom_items
  ADD CONSTRAINT chk_bom_status
  CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock', 'On Order'));
