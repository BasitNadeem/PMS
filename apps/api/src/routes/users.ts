import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { createUserSchema, updateUserSchema, resetPasswordSchema } from "../schemas/users";
import { UserService } from "../services/UserService";

const router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/users/roles — BEFORE /:id
router.get("/roles", requirePermission("USER_READ"), async (req, res) => {
  const roles = await UserService.listRoles();
  res.json({ data: roles });
});

// GET /api/users
router.get("/", requirePermission("USER_READ"), async (req, res) => {
  const users = await UserService.listUsers(req.user!.hotelId);
  res.json({ data: users });
});

// POST /api/users
router.post("/", requirePermission("USER_CREATE"), async (req, res) => {
  const body = createUserSchema.parse(req.body);
  const user = await UserService.createUser(req.withTenant, req.user!, body);
  res.status(201).json({ data: user });
});

// PATCH /api/users/:id
router.patch("/:id", requirePermission("USER_UPDATE"), async (req, res) => {
  const id   = req.params.id as string;
  const body = updateUserSchema.parse(req.body);
  const user = await UserService.updateUser(req.withTenant, req.user!, id, body);
  res.json({ data: user });
});

// PATCH /api/users/:id/password
router.patch("/:id/password", requirePermission("USER_UPDATE"), async (req, res) => {
  const id   = req.params.id as string;
  const body = resetPasswordSchema.parse(req.body);
  await UserService.resetPassword(req.withTenant, req.user!, id, body);
  res.status(204).send();
});

export default router;
