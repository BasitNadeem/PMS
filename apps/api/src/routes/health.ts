import { Router } from "express";
import { prisma } from "@pms/db";

const router = Router();

router.get("/", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", db: "connected", ts: new Date().toISOString() });
});

export default router;
