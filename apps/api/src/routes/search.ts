import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { searchQuerySchema } from "../schemas/search";
import { SearchService, type SearchResultType } from "../services/SearchService";

const router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/search?q=...
// Spans multiple entity types in one call — each type is gated by its own
// read permission (not a single requirePermission(), since a result set can
// legitimately mix types a user has partial access to).
router.get("/", async (req, res) => {
  const { q } = searchQuerySchema.parse(req.query);
  const perms = req.user!.permissions ?? [];

  const allowed = new Set<SearchResultType>();
  if (perms.includes("GUEST_READ"))       allowed.add("guest");
  if (perms.includes("RESERVATION_READ")) allowed.add("reservation");
  if (perms.includes("ROOM_READ"))        allowed.add("room");
  if (perms.includes("groups:read") || perms.includes("RESERVATION_READ")) allowed.add("group");
  if (perms.includes("FOLIO_READ"))       allowed.add("folio");
  if (perms.includes("USER_READ"))        allowed.add("staff");

  const data = allowed.size > 0 ? await SearchService.search(req.withTenant, q, allowed) : [];
  res.json({ data });
});

export default router;
