import { Router } from "express";
import { z } from "zod";
import { adminPrisma } from "@pms/db";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { AppError } from "../utils/AppError";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

const createNoteSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

const NOTE_SELECT = {
  id: true,
  hotelId: true,
  text: true,
  isCompleted: true,
  completedAt: true,
  completedById: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy:   { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
} as const;

// GET /api/notes — active + completed-within-24h for this hotel
router.get("/", async (req, res) => {
  const hotelId = req.user!.hotelId;
  const cutoff  = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const notes = await adminPrisma.frontDeskNote.findMany({
    where: {
      hotelId,
      OR: [
        { isCompleted: false },
        { isCompleted: true, completedAt: { gte: cutoff } },
      ],
    },
    select: NOTE_SELECT,
    orderBy: [
      { isCompleted: "asc" },
      { createdAt: "desc" },
    ],
  });

  res.json({ data: notes });
});

// POST /api/notes — create note
router.post("/", async (req, res) => {
  const { text } = createNoteSchema.parse(req.body);
  const { hotelId, userId } = req.user!;

  const note = await adminPrisma.frontDeskNote.create({
    data: {
      hotelId,
      text,
      createdById: userId,
    },
    select: NOTE_SELECT,
  });

  res.status(201).json({ data: note });
});

// PATCH /api/notes/:id — toggle complete/uncomplete
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const hotelId = req.user!.hotelId;

  const existing = await adminPrisma.frontDeskNote.findFirst({
    where: { id, hotelId },
  });
  if (!existing) throw new AppError(404, "Note not found");

  const note = await adminPrisma.frontDeskNote.update({
    where: { id },
    data: existing.isCompleted
      ? { isCompleted: false, completedAt: null, completedById: null }
      : { isCompleted: true, completedAt: new Date(), completedById: req.user!.userId },
    select: NOTE_SELECT,
  });

  res.json({ data: note });
});

// DELETE /api/notes/:id — only creator can delete
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { hotelId, userId } = req.user!;

  const existing = await adminPrisma.frontDeskNote.findFirst({
    where: { id, hotelId },
  });
  if (!existing) throw new AppError(404, "Note not found");
  if (existing.createdById !== userId) throw new AppError(403, "Only the creator can delete this note");

  await adminPrisma.frontDeskNote.delete({ where: { id } });
  res.status(204).send();
});

export default router;
