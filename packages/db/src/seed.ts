import "dotenv/config";
import bcrypt from "bcryptjs";
import { adminPrisma, UserRole } from "./index";

const DEMO_SLUG     = "demo-hotel";
const DEMO_EMAIL    = "admin@demo-hotel.com";
const DEMO_PASSWORD = "Admin1234!";

// ── Permission catalogue ─────────────────────────────────────────────────────
// Keys must match the strings passed to requirePermission() in route files.
// module + action are for UI grouping (Phase 2 permission editor).

const ALL_PERMISSIONS: { key: string; module: string; action: string; displayName: string }[] = [
  // Hotel
  { key: "HOTEL_READ",           module: "hotel",        action: "read",     displayName: "View Hotel Details" },
  { key: "HOTEL_UPDATE",         module: "hotel",        action: "update",   displayName: "Edit Hotel Details" },
  { key: "HOTEL_SETTINGS",       module: "hotel",        action: "settings", displayName: "Manage Hotel Settings" },
  // Room types
  { key: "ROOM_TYPE_READ",       module: "room_type",    action: "read",     displayName: "View Room Types" },
  { key: "ROOM_TYPE_CREATE",     module: "room_type",    action: "create",   displayName: "Create Room Types" },
  { key: "ROOM_TYPE_UPDATE",     module: "room_type",    action: "update",   displayName: "Edit Room Types" },
  { key: "ROOM_TYPE_DELETE",     module: "room_type",    action: "delete",   displayName: "Delete Room Types" },
  // Rooms
  { key: "ROOM_READ",            module: "room",         action: "read",     displayName: "View Rooms" },
  { key: "ROOM_CREATE",          module: "room",         action: "create",   displayName: "Create Rooms" },
  { key: "ROOM_UPDATE",          module: "room",         action: "update",   displayName: "Edit Rooms" },
  { key: "ROOM_DELETE",          module: "room",         action: "delete",   displayName: "Delete Rooms" },
  // Guests
  { key: "GUEST_READ",           module: "guest",        action: "read",     displayName: "View Guests" },
  { key: "GUEST_CREATE",         module: "guest",        action: "create",   displayName: "Create Guests" },
  { key: "GUEST_UPDATE",         module: "guest",        action: "update",   displayName: "Edit Guests" },
  { key: "GUEST_DELETE",         module: "guest",        action: "delete",   displayName: "Delete Guests" },
  // Reservations
  { key: "RESERVATION_READ",     module: "reservation",  action: "read",     displayName: "View Reservations" },
  { key: "RESERVATION_CREATE",   module: "reservation",  action: "create",   displayName: "Create Reservations" },
  { key: "RESERVATION_UPDATE",   module: "reservation",  action: "update",   displayName: "Edit Reservations" },
  { key: "RESERVATION_CANCEL",   module: "reservation",  action: "cancel",   displayName: "Cancel Reservations" },
  { key: "RESERVATION_CHECKIN",  module: "reservation",  action: "checkin",  displayName: "Check In Guests" },
  { key: "RESERVATION_CHECKOUT", module: "reservation",  action: "checkout", displayName: "Check Out Guests" },
  // Folios
  { key: "FOLIO_READ",           module: "folio",        action: "read",     displayName: "View Folios" },
  { key: "FOLIO_UPDATE",         module: "folio",        action: "update",   displayName: "Edit Folios" },
  // Payments
  { key: "PAYMENT_READ",         module: "payment",      action: "read",     displayName: "View Payments" },
  { key: "PAYMENT_CREATE",       module: "payment",      action: "create",   displayName: "Record Payments" },
  { key: "PAYMENT_REFUND",       module: "payment",      action: "refund",   displayName: "Issue Refunds" },
  // Invoices
  { key: "INVOICE_READ",         module: "invoice",      action: "read",     displayName: "View Invoices" },
  { key: "INVOICE_CREATE",       module: "invoice",      action: "create",   displayName: "Create Invoices" },
  { key: "INVOICE_UPDATE",       module: "invoice",      action: "update",   displayName: "Edit Invoices" },
  // Housekeeping
  { key: "HOUSEKEEPING_READ",    module: "housekeeping", action: "read",     displayName: "View Housekeeping Tasks" },
  { key: "HOUSEKEEPING_CREATE",  module: "housekeeping", action: "create",   displayName: "Create Housekeeping Tasks" },
  { key: "HOUSEKEEPING_UPDATE",  module: "housekeeping", action: "update",   displayName: "Update Housekeeping Tasks" },
  // Maintenance
  { key: "MAINTENANCE_READ",     module: "maintenance",  action: "read",     displayName: "View Maintenance Tickets" },
  { key: "MAINTENANCE_CREATE",   module: "maintenance",  action: "create",   displayName: "Create Maintenance Tickets" },
  { key: "MAINTENANCE_UPDATE",   module: "maintenance",  action: "update",   displayName: "Update Maintenance Tickets" },
  // POS
  { key: "POS_READ",             module: "pos",          action: "read",     displayName: "View POS" },
  { key: "POS_CREATE",           module: "pos",          action: "create",   displayName: "Create POS Orders" },
  { key: "POS_UPDATE",           module: "pos",          action: "update",   displayName: "Edit POS Orders" },
  // Inventory
  { key: "INVENTORY_READ",       module: "inventory",    action: "read",     displayName: "View Inventory" },
  { key: "INVENTORY_UPDATE",     module: "inventory",    action: "update",   displayName: "Update Inventory" },
  // Rate plans
  { key: "RATE_READ",            module: "rate",         action: "read",     displayName: "View Rate Plans" },
  { key: "RATE_CREATE",          module: "rate",         action: "create",   displayName: "Create Rate Plans" },
  { key: "RATE_UPDATE",          module: "rate",         action: "update",   displayName: "Edit Rate Plans" },
  { key: "RATE_DELETE",          module: "rate",         action: "delete",   displayName: "Delete Rate Plans" },
  // Channel manager
  { key: "CHANNEL_READ",         module: "channel",      action: "read",     displayName: "View Channel Config" },
  { key: "CHANNEL_UPDATE",       module: "channel",      action: "update",   displayName: "Edit Channel Config" },
  // Staff
  { key: "STAFF_READ",           module: "staff",        action: "read",     displayName: "View Staff" },
  { key: "STAFF_CREATE",         module: "staff",        action: "create",   displayName: "Create Staff" },
  { key: "STAFF_UPDATE",         module: "staff",        action: "update",   displayName: "Edit Staff" },
  { key: "STAFF_DELETE",         module: "staff",        action: "delete",   displayName: "Remove Staff" },
  // Users
  { key: "USER_READ",            module: "user",         action: "read",     displayName: "View Users" },
  { key: "USER_CREATE",          module: "user",         action: "create",   displayName: "Invite Users" },
  { key: "USER_UPDATE",          module: "user",         action: "update",   displayName: "Edit Users" },
  { key: "USER_DELETE",          module: "user",         action: "delete",   displayName: "Remove Users" },
  // Reports & audit
  { key: "REPORT_READ",          module: "report",       action: "read",     displayName: "View Reports" },
  { key: "AUDIT_READ",           module: "audit",        action: "read",     displayName: "View Audit Log" },
];

const ALL_KEYS = ALL_PERMISSIONS.map((p) => p.key);

// Permissions granted to each system role.
// FRONT_DESK deliberately excludes PAYMENT_REFUND — refunds require ACCOUNTANT or higher.
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ALL_KEYS,

  MANAGER: ALL_KEYS.filter((k) => k !== "HOTEL_SETTINGS"),

  FRONT_DESK: [
    "HOTEL_READ",
    "ROOM_TYPE_READ",
    "ROOM_READ",
    "GUEST_READ", "GUEST_CREATE", "GUEST_UPDATE",
    "RESERVATION_READ", "RESERVATION_CREATE", "RESERVATION_UPDATE",
    "RESERVATION_CANCEL", "RESERVATION_CHECKIN", "RESERVATION_CHECKOUT",
    "FOLIO_READ", "FOLIO_UPDATE",
    "PAYMENT_READ", "PAYMENT_CREATE",
  ],

  HOUSEKEEPING: [
    "ROOM_READ",
    "HOUSEKEEPING_READ", "HOUSEKEEPING_CREATE", "HOUSEKEEPING_UPDATE",
    "MAINTENANCE_READ", "MAINTENANCE_CREATE",
  ],

  KITCHEN: [
    "POS_READ", "POS_CREATE", "POS_UPDATE",
    "INVENTORY_READ",
  ],

  MAINTENANCE: [
    "ROOM_READ",
    "MAINTENANCE_READ", "MAINTENANCE_CREATE", "MAINTENANCE_UPDATE",
  ],

  ACCOUNTANT: [
    "HOTEL_READ",
    "RESERVATION_READ",
    "GUEST_READ",
    "FOLIO_READ", "FOLIO_UPDATE",
    "PAYMENT_READ", "PAYMENT_CREATE", "PAYMENT_REFUND",
    "INVOICE_READ", "INVOICE_CREATE", "INVOICE_UPDATE",
    "REPORT_READ",
  ],
};

// ── Module-based permission catalogue (module:action format) ────────────────
// Used by the admin app / frontend feature gating. Distinct from the
// RESOURCE_ACTION permission keys above, which gate individual API routes.

const MODULE_KEYS = [
  "dashboard", "rooms", "guests", "reservations", "groups",
  "billing", "expenses", "cashbook", "housekeeping", "maintenance", "pos",
  "rates", "team", "reports", "settings", "notifications",
] as const;

const ACTION_KEYS = ["read", "create", "update", "delete", "manage"] as const;

// housekeeping/maintenance/pos each already have a RESOURCE_ACTION permission
// above (HOUSEKEEPING_READ, POS_CREATE, ...) that gates the API route. Their
// module:action combos here are a genuinely separate, real permission that
// gates app menu/button visibility instead (see apps/web's usePermissions()
// and AppLayout's nav-item `permission` field) — not a duplicate to remove.
// But left under the same module name they render as if they were the exact
// same toggle repeated twice in the Settings permissions UI, which is the bug
// this fixes: same key (so usePermissions().has(key) keeps working exactly as
// before), different module/displayName so they group separately instead.
const DUAL_PURPOSE_MODULE = "app_access";
const DUAL_PURPOSE_DISPLAY_NAMES: Partial<Record<string, string>> = {
  "housekeeping:read":   "Show Housekeeping in Menu",
  "housekeeping:create": "Show 'Add Task' Button (Housekeeping)",
  "housekeeping:update": "Show Status Controls (Housekeeping)",
  "maintenance:read":    "Show Maintenance in Menu",
  "maintenance:create":  "Show 'Report Issue' Button (Maintenance)",
  "maintenance:update":  "Show Status Controls (Maintenance)",
  "pos:read":            "Show POS in Menu",
  "pos:create":          "Show 'New Order' Button (POS)",
  "pos:update":          "Show Order Controls (POS)",
};

// (module, action) combos that were generated here historically but are
// checked nowhere — neither by any requirePermission() call in apps/api nor
// any usePermissions().has() call in apps/web. Confirmed by exhaustive grep
// before removing; excluded so re-seeding can't bring them back.
const MODULE_ACTION_EXCLUSIONS = new Set<string>([
  "housekeeping:delete", "housekeeping:manage",
  "maintenance:delete", "maintenance:manage",
  "pos:delete",
]);

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MODULE_PERMISSIONS: { key: string; module: string; action: string; displayName: string }[] =
  MODULE_KEYS.flatMap((module) =>
    ACTION_KEYS
      .filter((action) => !MODULE_ACTION_EXCLUSIONS.has(`${module}:${action}`))
      .map((action) => {
        const key = `${module}:${action}`;
        return {
          key,
          module: DUAL_PURPOSE_DISPLAY_NAMES[key] ? DUAL_PURPOSE_MODULE : module,
          action,
          displayName: DUAL_PURPOSE_DISPLAY_NAMES[key] ?? `${titleCase(action)} ${titleCase(module)}`,
        };
      })
  );

const MODULE_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: MODULE_PERMISSIONS.map((p) => p.key),

  MANAGER: [
    "dashboard:read",
    "rooms:read", "rooms:create", "rooms:update",
    "guests:read", "guests:create", "guests:update",
    "reservations:read", "reservations:create", "reservations:update",
    "groups:read", "groups:create", "groups:update",
    "billing:read", "billing:create", "billing:update",
    "expenses:read", "expenses:create", "expenses:update", "expenses:delete",
    "cashbook:read", "cashbook:create",
    "housekeeping:read", "housekeeping:create", "housekeeping:update",
    "maintenance:read", "maintenance:create", "maintenance:update",
    "pos:read", "pos:create", "pos:manage",
    "rates:read", "rates:create", "rates:update",
    "team:read", "team:create", "team:update",
    "reports:read",
    "settings:read", "settings:update",
  ],

  FRONT_DESK: [
    "dashboard:read",
    "rooms:read",
    "guests:read", "guests:create", "guests:update",
    "reservations:read", "reservations:create", "reservations:update",
    "groups:read", "groups:create", "groups:update",
    "billing:read", "billing:create", "billing:update",
    "housekeeping:read",
    "pos:read", "pos:create",
  ],

  HOUSEKEEPING: [
    "dashboard:read",
    "rooms:read",
    "housekeeping:read", "housekeeping:update",
    "maintenance:read", "maintenance:create",
  ],

  KITCHEN: [
    "pos:read", "pos:create", "pos:manage",
  ],

  MAINTENANCE: [
    "dashboard:read",
    "rooms:read",
    "housekeeping:read",
    "maintenance:read", "maintenance:create", "maintenance:update",
  ],

  ACCOUNTANT: [
    "dashboard:read",
    "billing:read", "billing:create", "billing:update",
    "expenses:read", "expenses:create", "expenses:update", "expenses:delete",
    "cashbook:read", "cashbook:create",
    "reports:read",
  ],
};

async function main() {
  // ── 1. System roles ─────────────────────────────────────────────────────────
  console.log("🌱  Seeding system roles…");

  const systemRoles: { name: UserRole; displayName: string; sortOrder: number; color: string }[] = [
    { name: "OWNER",        displayName: "Owner",        sortOrder: 1, color: "#7C3AED" },
    { name: "MANAGER",      displayName: "Manager",      sortOrder: 2, color: "#2563EB" },
    { name: "FRONT_DESK",   displayName: "Front Desk",   sortOrder: 3, color: "#0891B2" },
    { name: "HOUSEKEEPING", displayName: "Housekeeping", sortOrder: 4, color: "#16A34A" },
    { name: "KITCHEN",      displayName: "Kitchen",      sortOrder: 5, color: "#D97706" },
    { name: "MAINTENANCE",  displayName: "Maintenance",  sortOrder: 6, color: "#DC2626" },
    { name: "ACCOUNTANT",   displayName: "Accountant",   sortOrder: 7, color: "#0F766E" },
  ];

  // Prisma upsert rejects null in compound unique keys — use findFirst + create/update instead
  for (const r of systemRoles) {
    const existing = await adminPrisma.role.findFirst({ where: { name: r.name, hotelId: null } });
    if (existing) {
      await adminPrisma.role.update({
        where: { id: existing.id },
        data:  { displayName: r.displayName, sortOrder: r.sortOrder, color: r.color },
      });
    } else {
      await adminPrisma.role.create({
        data: {
          name:        r.name,
          displayName: r.displayName,
          color:       r.color,
          isSystem:    true,
          isCustom:    false,
          sortOrder:   r.sortOrder,
        },
      });
    }
  }

  // ── 2. Permissions ───────────────────────────────────────────────────────────
  console.log("🔐  Seeding permissions…");

  for (const p of ALL_PERMISSIONS) {
    await adminPrisma.permission.upsert({
      where:  { key: p.key },
      update: { module: p.module, action: p.action, displayName: p.displayName },
      create: { key: p.key, module: p.module, action: p.action, displayName: p.displayName },
    });
  }

  // ── 3. Role → permission assignments ────────────────────────────────────────
  console.log("🔗  Assigning permissions to roles…");

  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await adminPrisma.role.findFirst({ where: { name: roleName, hotelId: null } });
    if (!role) continue;

    const permissions = await adminPrisma.permission.findMany({
      where:  { key: { in: permKeys } },
      select: { id: true },
    });

    // Delete-then-recreate makes this idempotent on re-runs
    await adminPrisma.$transaction([
      adminPrisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      adminPrisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      }),
    ]);
  }

  // ── 3b. Module-based permissions (module:action format) ─────────────────────
  console.log("🧩  Seeding module permissions…");

  for (const p of MODULE_PERMISSIONS) {
    await adminPrisma.permission.upsert({
      where:  { key: p.key },
      update: { module: p.module, action: p.action, displayName: p.displayName },
      create: { key: p.key, module: p.module, action: p.action, displayName: p.displayName },
    });
  }

  for (const [roleName, permKeys] of Object.entries(MODULE_ROLE_PERMISSIONS)) {
    const role = await adminPrisma.role.findFirst({ where: { name: roleName, hotelId: null } });
    if (!role) continue;

    const permissions = await adminPrisma.permission.findMany({
      where:  { key: { in: permKeys } },
      select: { id: true },
    });

    for (const permission of permissions) {
      await adminPrisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  // ── 4. Demo hotel ────────────────────────────────────────────────────────────
  console.log("🏨  Seeding demo hotel…");

  const hotel = await adminPrisma.hotel.upsert({
    where:  { slug: DEMO_SLUG },
    update: { subdomain: DEMO_SLUG },
    create: {
      name:           "Demo Hotel",
      slug:           DEMO_SLUG,
      subdomain:      DEMO_SLUG,
      propertyType:   "HOTEL",
      city:           "Karachi",
      country:        "PK",
      isActive:       true,
      isTrialAccount: true,
      trialEndsAt:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ── 5. Demo owner user ───────────────────────────────────────────────────────
  console.log("👤  Seeding demo owner user…");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await adminPrisma.user.upsert({
    where:  { email: DEMO_EMAIL },
    update: {},
    create: {
      email:         DEMO_EMAIL,
      name:          "Admin User",
      passwordHash,
      emailVerified: true,
      isFirstLogin:  false,
    },
  });

  // ── 6. Link user → hotel as OWNER ────────────────────────────────────────────
  const ownerRole = await adminPrisma.role.findFirstOrThrow({
    where: { name: "OWNER", hotelId: null },
  });

  await adminPrisma.hotelUser.upsert({
    where:  { hotelId_userId: { hotelId: hotel.id, userId: user.id } },
    update: {},
    create: {
      hotelId:    hotel.id,
      userId:     user.id,
      role:       UserRole.OWNER,
      roleId:     ownerRole.id,
      isActive:   true,
      acceptedAt: new Date(),
    },
  });

  // ── Ensure demo hotel subdomain is set (covers rows seeded before this field existed) ──
  await adminPrisma.hotel.update({
    where: { slug: DEMO_SLUG },
    data:  { subdomain: DEMO_SLUG },
  });
  console.log("✅ Demo hotel subdomain set to: demo-hotel");

  // ── 7. Subscription plans ────────────────────────────────────────────────────
  console.log("💳  Seeding subscription plans…");

  const trialFeatures = {
    whatsappBriefing: true,
    reportsExport: true,
    inventoryManagement: true,
    groupBookings: true,
    maintenanceTickets: true,
    housekeepingPWA: true,
    posModule: true,
    qrOrdering: true,
    kitchenDisplay: true,
    nightAudit: true,
    auditLog: true,
    ratePlans: true,
    bookingEngine: true,
    channelManager: true,
    customDomain: true,
    corporateBilling: true,
  };

  const trialPlan = await adminPrisma.subscriptionPlan.upsert({
    where: { slug: "trial" },
    update: {
      name: "Trial",
      priceMonthly: 0,
      maxRooms: 999,
      maxUsers: 999,
      features: trialFeatures,
      isActive: true,
      displayOrder: 0,
    },
    create: {
      name: "Trial",
      slug: "trial",
      priceMonthly: 0,
      maxRooms: 999,
      maxUsers: 999,
      features: trialFeatures,
      isActive: true,
      displayOrder: 0,
    },
  });

  // Backfill existing hotels that have no plan
  await adminPrisma.hotel.updateMany({
    where: { subscriptionPlanId: null },
    data: { subscriptionPlanId: trialPlan.id },
  });
  console.log(`✅ Trial plan seeded (id: ${trialPlan.id}), backfilled hotels with no plan`);

  // ── Done ─────────────────────────────────────────────────────────────────────
  console.log("\n✅  Seed complete.");
  console.log("──────────────────────────────────────");
  console.log("  Demo login credentials");
  console.log("──────────────────────────────────────");
  console.log(`  Hotel slug : ${DEMO_SLUG}`);
  console.log(`  Email      : ${DEMO_EMAIL}`);
  console.log(`  Password   : ${DEMO_PASSWORD}`);
  console.log("──────────────────────────────────────\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => adminPrisma.$disconnect());
