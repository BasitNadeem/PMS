-- ============================================================================
-- Fix: doubled Read/Create/Update toggles for Housekeeping, Maintenance, POS
-- in Settings > Role Permissions.
--
-- Root cause was NOT a simple duplicate — there are two real, independently
-- necessary permission systems in this codebase:
--   1. RESOURCE_ACTION keys (HOUSEKEEPING_READ, POS_CREATE, ...) — gate the
--      actual API route via apps/api's requirePermission() middleware.
--   2. module:action keys (housekeeping:read, pos:create, ...) — gate app
--      menu/button visibility via apps/web's usePermissions().has(), e.g.
--      AppLayout's sidebar nav items and HousekeepingPage/MaintenanceTicketsPage/
--      PosPage's create/update buttons. Confirmed live by grepping every
--      requirePermission() and has() call in the codebase before touching
--      anything — deleting these would have hidden real nav links and
--      buttons for anyone relying on them.
-- Both are real and both must keep working. The actual bug: for exactly
-- these 3 modules, both systems happened to use the identical module name
-- ("housekeeping", "maintenance", "pos"), so PermissionsService's flat,
-- ungrouped rendering showed them as if the same toggle were duplicated.
-- Every other module avoided this by accident of differing module-name
-- spelling (e.g. "guest" vs "guests", "room" vs "rooms").
--
-- Fix: move the module:action ones into their own "app_access" group instead
-- of deleting them — same `key`, so every has("housekeeping:read")-style
-- call keeps working unchanged; only where they're grouped/labeled in the
-- Settings UI changes.
--
-- Separately, a handful of permission rows really were never checked
-- anywhere (confirmed by exhaustive grep of apps/api and apps/web) — those
-- are deleted outright. None of them is the sole gate for anything real, so
-- no role_permissions repointing is needed before deleting.
-- ============================================================================

-- ── Reclassify: same key, new module + clearer, purpose-specific label ──────
UPDATE permissions SET module = 'app_access', display_name = 'Show Housekeeping in Menu'
  WHERE key = 'housekeeping:read';
UPDATE permissions SET module = 'app_access', display_name = 'Show ''Add Task'' Button (Housekeeping)'
  WHERE key = 'housekeeping:create';
UPDATE permissions SET module = 'app_access', display_name = 'Show Status Controls (Housekeeping)'
  WHERE key = 'housekeeping:update';

UPDATE permissions SET module = 'app_access', display_name = 'Show Maintenance in Menu'
  WHERE key = 'maintenance:read';
UPDATE permissions SET module = 'app_access', display_name = 'Show ''Report Issue'' Button (Maintenance)'
  WHERE key = 'maintenance:create';
UPDATE permissions SET module = 'app_access', display_name = 'Show Status Controls (Maintenance)'
  WHERE key = 'maintenance:update';

UPDATE permissions SET module = 'app_access', display_name = 'Show POS, Orders, Inventory & Kitchen in Menu'
  WHERE key = 'pos:read';
UPDATE permissions SET module = 'app_access', display_name = 'Show ''New Order'' Button (POS)'
  WHERE key = 'pos:create';
UPDATE permissions SET module = 'app_access', display_name = 'Show Order Controls (POS)'
  WHERE key = 'pos:update';

-- ── Delete: confirmed unused anywhere (frontend or backend) ─────────────────
-- role_permissions rows for these cascade-delete automatically
-- (RolePermission.role -> Role/Permission is ON DELETE CASCADE).
DELETE FROM permissions WHERE key IN (
  'housekeeping:view',
  'maintenance:view', 'maintenance:resolve',
  'pos:view-orders', 'pos:create-order', 'pos:manage-menu',
  'housekeeping:delete', 'housekeeping:manage',
  'maintenance:delete', 'maintenance:manage',
  'pos:delete'
);
