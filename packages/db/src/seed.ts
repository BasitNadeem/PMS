import "dotenv/config";
import bcrypt from "bcryptjs";
import { adminPrisma, UserRole } from "./index";

const DEMO_SLUG     = "demo-hotel";
const DEMO_EMAIL    = "admin@demo-hotel.com";
const DEMO_PASSWORD = "Admin1234!";

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
        where:  { id: existing.id },
        data:   { displayName: r.displayName, sortOrder: r.sortOrder, color: r.color },
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

  // ── 2. Demo hotel ────────────────────────────────────────────────────────────
  console.log("🏨  Seeding demo hotel…");

  const hotel = await adminPrisma.hotel.upsert({
    where:  { slug: DEMO_SLUG },
    update: {},
    create: {
      name:            "Demo Hotel",
      slug:            DEMO_SLUG,
      propertyType:    "HOTEL",
      city:            "Karachi",
      country:         "PK",
      isActive:        true,
      isTrialAccount:  true,
      trialEndsAt:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // ── 3. Demo owner user ───────────────────────────────────────────────────────
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
    },
  });

  // ── 4. Link user → hotel as OWNER ────────────────────────────────────────────
  const ownerRole = await adminPrisma.role.findFirstOrThrow({
    where: { name: "OWNER", hotelId: null },
  });

  await adminPrisma.hotelUser.upsert({
    where:  { hotelId_userId: { hotelId: hotel.id, userId: user.id } },
    update: {},
    create: {
      hotelId:     hotel.id,
      userId:      user.id,
      role:        UserRole.OWNER,
      roleId:      ownerRole.id,
      isActive:    true,
      acceptedAt:  new Date(),
    },
  });

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
