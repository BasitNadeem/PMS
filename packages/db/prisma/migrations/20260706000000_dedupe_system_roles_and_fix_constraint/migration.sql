-- ============================================================================
-- Fix: duplicate system roles (hotel_id IS NULL)
--
-- Root cause: @@unique([hotelId, name]) compiles to a plain composite unique
-- index. Postgres never treats two NULLs as equal in a unique index, so it
-- never rejected a second ('MANAGER', hotel_id=NULL) row, etc. rls_and_triggers.sql
-- re-inserts the 7 system roles with `ON CONFLICT (hotel_id, name) DO NOTHING`
-- every time it runs (it's meant to be re-run after every migration deploy),
-- and that guard silently never fired for these rows — each re-run added a
-- fresh set of duplicates with new UUIDs.
--
-- Consequence beyond the duplicated sidebar entries: hotel_users.role_id is a
-- required FK to a specific roles.id. Different staff could end up pointing
-- at different duplicate rows for the same role name depending on which row
-- existed when they were invited, while an admin editing "permissions" in the
-- UI could easily be editing a different duplicate than the one their staff
-- actually reference — i.e. toggles that appear to do nothing.
--
-- This migration is data-safe: it merges everything onto one canonical row
-- per role name (the oldest one) before deleting the extras, so no staff
-- member's effective permissions change as a result.
-- ============================================================================

CREATE TEMP TABLE _role_dedup AS
WITH ranked AS (
  SELECT id, name,
         ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn
  FROM roles
  WHERE hotel_id IS NULL
),
canonical AS (
  SELECT name, id AS canonical_id FROM ranked WHERE rn = 1
)
SELECT r.id AS dupe_id, c.canonical_id
FROM ranked r
JOIN canonical c ON c.name = r.name
WHERE r.rn > 1;

-- Repoint any staff assigned to a duplicate row onto the canonical row.
UPDATE hotel_users hu
SET role_id = d.canonical_id
FROM _role_dedup d
WHERE hu.role_id = d.dupe_id;

-- Merge permission grants from duplicate rows onto the canonical row
-- (union, not overwrite — a permission granted on either row survives).
INSERT INTO role_permissions (role_id, permission_id, granted_at, granted_by)
SELECT d.canonical_id, rp.permission_id, rp.granted_at, rp.granted_by
FROM role_permissions rp
JOIN _role_dedup d ON d.dupe_id = rp.role_id
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Delete the now-unreferenced duplicate rows. Their own role_permissions rows
-- cascade-delete automatically (Role -> RolePermission is ON DELETE CASCADE).
DELETE FROM roles r
USING _role_dedup d
WHERE r.id = d.dupe_id;

DROP TABLE _role_dedup;

-- Prevent this from ever happening again: a partial unique index that
-- actually enforces "one system role per name", which the plain composite
-- index above could not do for NULL hotel_id. Custom per-hotel roles
-- (hotel_id IS NOT NULL) keep relying on the existing roles_hotel_id_name_key
-- index, which works correctly for non-null values.
CREATE UNIQUE INDEX IF NOT EXISTS roles_system_name_key
  ON roles (name)
  WHERE hotel_id IS NULL;
