-- The Settings > Role Permissions UI now renders Permission.display_name
-- directly as the toggle label (see PermissionsService.getRolePermissions
-- and SettingsPage.tsx) instead of a generic action word. "Show POS, Orders,
-- Inventory & Kitchen in Menu" is far longer than every other label in the
-- catalogue and would visually stand out / wrap awkwardly next to its
-- siblings ("Show Housekeeping in Menu", "Show Maintenance in Menu").
-- Shortened to match that same pattern.
UPDATE permissions SET display_name = 'Show POS in Menu' WHERE key = 'pos:read';
